import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  bookingQuoteNights,
  bookingQuoteRooms,
  bookingQuotes,
  folioBillingBuckets,
  folioEntries,
  folios,
  guests,
  inventoryClaimEvents,
  inventoryClaims,
  inventoryDays,
  notificationMessages,
  paymentInstructionVersions,
  policyAcknowledgements,
  policySets,
  policyVersions,
  propertySettingSets,
  propertySettingVersions,
  ratePlanVersions,
  resourceClaims,
  reservationGuests,
  reservationAddons,
  reservationRoomNights,
  reservationRooms,
  reservations,
  reservationStatusEvents,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { decryptSensitiveValue } from "../../platform/encryption";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import type { IdempotencyTransaction } from "../../platform/idempotency";
import { enqueueOutboxEvent } from "../../platform/outbox";
import type { CreateReservationRequest, StaffSessionLike } from "./contracts";
import {
  calculateRequiredPayment,
  generateBookingCode,
  normalizeEmail,
  stableRequestHash,
} from "./domain";

const ONLINE_PAYMENT_MS = 2 * 60 * 60 * 1000;
const SAME_DAY_PAYMENT_MS = 60 * 60 * 1000;
const REMINDER_LEAD_MS = 30 * 60 * 1000;

interface ExtraBedSnapshot extends Record<string, unknown> {
  resourcePoolId: string | null;
  quantity: number;
  unitPriceIdr: number;
  netAmountIdr: number;
  serviceChargeIdr: number;
  taxIdr: number;
  totalIdr: number;
  settingVersionId: string;
  taxConfiguration: Record<string, unknown>;
}

function readExtraBedSnapshot(
  priceSnapshot: Record<string, unknown>,
): ExtraBedSnapshot | null {
  const value = priceSnapshot.extraBed;
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.quantity !== "number" ||
    typeof snapshot.unitPriceIdr !== "number" ||
    typeof snapshot.netAmountIdr !== "number" ||
    typeof snapshot.serviceChargeIdr !== "number" ||
    typeof snapshot.taxIdr !== "number" ||
    typeof snapshot.totalIdr !== "number" ||
    typeof snapshot.settingVersionId !== "string"
  ) {
    throw new AppError("CONFLICT", "Extra-bed price snapshot is invalid");
  }
  return {
    resourcePoolId:
      typeof snapshot.resourcePoolId === "string"
        ? snapshot.resourcePoolId
        : null,
    quantity: snapshot.quantity,
    unitPriceIdr: snapshot.unitPriceIdr,
    netAmountIdr: snapshot.netAmountIdr,
    serviceChargeIdr: snapshot.serviceChargeIdr,
    taxIdr: snapshot.taxIdr,
    totalIdr: snapshot.totalIdr,
    settingVersionId: snapshot.settingVersionId,
    taxConfiguration:
      snapshot.taxConfiguration && typeof snapshot.taxConfiguration === "object"
        ? (snapshot.taxConfiguration as Record<string, unknown>)
        : {},
  };
}

function isEffective(
  row: {
    effectiveFrom: Date;
    effectiveTo: Date | null;
    lifecycleStatus: string;
  },
  at: Date,
) {
  return (
    ["ACTIVE", "SCHEDULED"].includes(row.lifecycleStatus) &&
    row.effectiveFrom <= at &&
    (!row.effectiveTo || row.effectiveTo > at)
  );
}

async function paymentDeadline(
  tx: IdempotencyTransaction,
  propertyId: string,
  checkInDate: string,
  now: Date,
) {
  const rows = await tx
    .select({
      lifecycleStatus: propertySettingVersions.lifecycleStatus,
      effectiveFrom: propertySettingVersions.effectiveFrom,
      effectiveTo: propertySettingVersions.effectiveTo,
      values: propertySettingVersions.values,
    })
    .from(propertySettingSets)
    .innerJoin(
      propertySettingVersions,
      eq(propertySettingVersions.settingSetId, propertySettingSets.id),
    )
    .where(
      and(
        eq(propertySettingSets.propertyId, propertyId),
        eq(propertySettingSets.code, "BOOKING_PAYMENT"),
      ),
    )
    .orderBy(desc(propertySettingVersions.effectiveFrom));
  const setting = rows.find((row) => isEffective(row, now));
  const sameDay = checkInDate === now.toISOString().slice(0, 10);
  const defaultMinutes = sameDay ? 60 : 120;
  const configured = Number(
    setting?.values[
      sameDay ? "sameDayDeadlineMinutes" : "onlineDeadlineMinutes"
    ] ?? defaultMinutes,
  );
  const duration =
    Number.isFinite(configured) && configured >= 15 && configured <= 1_440
      ? configured * 60_000
      : sameDay
        ? SAME_DAY_PAYMENT_MS
        : ONLINE_PAYMENT_MS;
  return new Date(now.getTime() + duration);
}

async function createEmailMessage(
  tx: IdempotencyTransaction,
  input: {
    propertyId: string;
    reservationId: string;
    recipient: string;
    subject: string;
    body: string;
    scheduledAt: Date;
    idempotencyKey: string;
  },
) {
  const [message] = await tx
    .insert(notificationMessages)
    .values({
      propertyId: input.propertyId,
      reservationId: input.reservationId,
      channel: "EMAIL",
      recipient: input.recipient,
      status: "QUEUED",
      renderedSubject: input.subject,
      renderedBody: input.body,
      scheduledAt: input.scheduledAt,
      idempotencyKey: input.idempotencyKey,
    })
    .returning({ id: notificationMessages.id });
  if (!message) throw new Error("Failed to create notification message");
  await enqueueOutboxEvent(
    {
      topic: "notification.email",
      aggregateType: "notification_message",
      aggregateId: message.id,
      payload: {
        messageId: message.id,
        to: input.recipient,
        subject: input.subject,
        text: input.body,
      },
      availableAt: input.scheduledAt,
    },
    tx,
  );
  return message.id;
}

export async function createReservation(params: {
  propertyId: string;
  input: CreateReservationRequest;
  idempotencyKey: string;
  session?: StaffSessionLike;
}) {
  const { input } = params;
  if (input.source === "ADMIN_MANUAL") {
    if (!params.session) throw new AppError("UNAUTHORIZED", "Unauthenticated");
    await requirePermission(
      params.session,
      params.propertyId,
      "booking.manage",
    );
  }
  if (
    input.source === "ONLINE" &&
    input.paymentMode &&
    input.paymentMode !== "FULL"
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Online booking requires full payment",
    );
  }
  const email = normalizeEmail(input.booker.email);
  if (!email.includes("@") || input.booker.name.trim().length < 2) {
    throw new AppError("VALIDATION_ERROR", "Invalid booker details");
  }
  return withIdempotency(
    {
      scope: `booking.reservation.create.${input.source.toLowerCase()}`,
      key: params.idempotencyKey,
      requestHash: stableRequestHash({ propertyId: params.propertyId, input }),
      ownerUserId: params.session?.user.id ?? null,
      ttlMs: 24 * 60 * 60 * 1000,
    },
    async (tx) => {
      const now = new Date();
      const [quote] = await tx
        .select()
        .from(bookingQuotes)
        .where(
          and(
            eq(bookingQuotes.id, input.quoteId),
            eq(bookingQuotes.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!quote || quote.status !== "ACTIVE" || quote.expiresAt <= now) {
        throw new AppError("CONFLICT", "Quote has expired or is unavailable");
      }
      const quoteRooms = await tx
        .select()
        .from(bookingQuoteRooms)
        .where(eq(bookingQuoteRooms.quoteId, quote.id))
        .orderBy(asc(bookingQuoteRooms.createdAt), asc(bookingQuoteRooms.id));
      if (quoteRooms.length === 0)
        throw new AppError("CONFLICT", "Quote has no rooms");
      const quoteNights = await tx
        .select()
        .from(bookingQuoteNights)
        .where(
          inArray(
            bookingQuoteNights.quoteRoomId,
            quoteRooms.map((room) => room.id),
          ),
        )
        .orderBy(bookingQuoteNights.stayDate);
      const checkoutClaims = await tx
        .select()
        .from(inventoryClaims)
        .where(
          and(
            eq(inventoryClaims.sourceType, "BOOKING_QUOTE"),
            eq(inventoryClaims.sourceId, quote.id),
            eq(inventoryClaims.claimStatus, "ACTIVE"),
          ),
        )
        .orderBy(inventoryClaims.inventoryDayId)
        .for("update");
      if (
        checkoutClaims.length === 0 ||
        checkoutClaims.some(
          (claim) => claim.expiresAt && claim.expiresAt <= now,
        )
      ) {
        throw new AppError("CONFLICT", "Checkout inventory hold has expired");
      }

      const [ratePlan] = await tx
        .select()
        .from(ratePlanVersions)
        .where(eq(ratePlanVersions.id, quoteRooms[0]!.ratePlanVersionId))
        .limit(1);
      if (!ratePlan)
        throw new AppError("CONFLICT", "Rate plan snapshot is missing");
      let paymentInstruction:
        typeof paymentInstructionVersions.$inferSelect | undefined;
      if (ratePlan.paymentInstructionSetId) {
        const versions = await tx
          .select()
          .from(paymentInstructionVersions)
          .where(
            and(
              eq(
                paymentInstructionVersions.instructionSetId,
                ratePlan.paymentInstructionSetId,
              ),
              inArray(paymentInstructionVersions.lifecycleStatus, [
                "ACTIVE",
                "SCHEDULED",
              ]),
            ),
          )
          .orderBy(desc(paymentInstructionVersions.effectiveFrom));
        paymentInstruction = versions.find((version) =>
          isEffective(version, now),
        );
      }
      if (input.source === "ONLINE" && !paymentInstruction) {
        throw new AppError("CONFLICT", "Payment instruction is not configured");
      }
      let cancellationPolicy: typeof policyVersions.$inferSelect | undefined;
      if (ratePlan.cancellationPolicySetId) {
        const versions = await tx
          .select()
          .from(policyVersions)
          .where(
            and(
              eq(policyVersions.policySetId, ratePlan.cancellationPolicySetId),
              inArray(policyVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
            ),
          )
          .orderBy(desc(policyVersions.effectiveFrom));
        cancellationPolicy = versions.find((version) =>
          isEffective(version, now),
        );
      }
      if (
        cancellationPolicy &&
        !input.acknowledgedPolicyVersionIds.includes(cancellationPolicy.id)
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "The active cancellation policy must be acknowledged",
        );
      }
      const houseRuleRows = await tx
        .select({
          id: policyVersions.id,
          lifecycleStatus: policyVersions.lifecycleStatus,
          effectiveFrom: policyVersions.effectiveFrom,
          effectiveTo: policyVersions.effectiveTo,
        })
        .from(policySets)
        .innerJoin(
          policyVersions,
          eq(policyVersions.policySetId, policySets.id),
        )
        .where(
          and(
            eq(policySets.propertyId, params.propertyId),
            eq(policySets.policyType, "HOUSE_RULES"),
            inArray(policyVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          ),
        )
        .orderBy(desc(policyVersions.effectiveFrom));
      const houseRules = houseRuleRows.find((row) => isEffective(row, now));
      if (
        houseRules &&
        !input.acknowledgedPolicyVersionIds.includes(houseRules.id)
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "The active house rules must be acknowledged",
        );
      }

      const totalIdr = Number(quote.totalIdr);
      const paymentMode =
        input.source === "ONLINE" ? "FULL" : (input.paymentMode ?? "FULL");
      const requiredPaymentIdr = calculateRequiredPayment(
        input.source,
        totalIdr,
        paymentMode,
        input.depositValue,
      );
      const deadline =
        input.source === "ONLINE"
          ? await paymentDeadline(
              tx,
              params.propertyId,
              quoteRooms[0]!.checkInDate,
              now,
            )
          : null;
      let bookingCode = generateBookingCode(now);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const [collision] = await tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(eq(reservations.bookingCode, bookingCode))
          .limit(1);
        if (!collision) break;
        bookingCode = generateBookingCode(now);
      }
      const reservationStatus =
        input.source === "ONLINE" ? "ON_HOLD" : "CONFIRMED";
      const [reservation] = await tx
        .insert(reservations)
        .values({
          propertyId: params.propertyId,
          bookingCode,
          source: input.source,
          status: reservationStatus,
          bookerName: input.booker.name.trim(),
          bookerEmail: input.booker.email.trim(),
          bookerEmailNormalized: email,
          bookerPhone: input.booker.phone?.trim() || null,
          language: quote.language,
          displayCurrency: quote.displayCurrency,
          exchangeRateSnapshotId: quote.exchangeRateSnapshotId,
          exchangeRate: null,
          quoteId: quote.id,
          paymentInstructionVersionId: paymentInstruction?.id ?? null,
          cancellationPolicyVersionId: cancellationPolicy?.id ?? null,
          houseRulesVersionId: houseRules?.id ?? null,
          paymentDeadlineAt: deadline,
          paymentMode,
          requiredPaymentIdr: String(requiredPaymentIdr),
          guaranteed: false,
          internalNotes:
            input.source === "ADMIN_MANUAL"
              ? input.internalNotes?.trim() || null
              : null,
          createdByUserId: params.session?.user.id ?? null,
          updatedByUserId: params.session?.user.id ?? null,
        })
        .returning({ id: reservations.id });
      if (!reservation) throw new Error("Failed to create reservation");
      await tx.insert(reservationStatusEvents).values({
        reservationId: reservation.id,
        action: "CREATE",
        toStatus: reservationStatus,
        actorUserId: params.session?.user.id ?? null,
        reason:
          input.source === "ONLINE"
            ? "Awaiting full payment verification"
            : "Front Office manual booking",
        guardResult: { source: input.source, requiredPaymentIdr },
      });
      const [guest] = await tx
        .insert(guests)
        .values({
          propertyId: params.propertyId,
          fullName: input.booker.name.trim(),
          email: input.booker.email.trim(),
          phone: input.booker.phone?.trim() || null,
          createdByUserId: params.session?.user.id ?? null,
          updatedByUserId: params.session?.user.id ?? null,
        })
        .returning({ id: guests.id });
      if (!guest) throw new Error("Failed to create booker guest");
      await tx.insert(reservationGuests).values({
        reservationId: reservation.id,
        guestId: guest.id,
        role: "BOOKER",
        createdByUserId: params.session?.user.id ?? null,
        updatedByUserId: params.session?.user.id ?? null,
      });
      for (const policyVersionId of input.acknowledgedPolicyVersionIds) {
        await tx.insert(policyAcknowledgements).values({
          reservationId: reservation.id,
          guestId: guest.id,
          policyVersionId,
          language: quote.language,
          channel: input.source === "ONLINE" ? "WEB_BOOKING" : "FRONT_OFFICE",
          outcome: "ACCEPTED",
          acknowledgedAt: now,
          actorUserId: params.session?.user.id ?? null,
          createdByUserId: params.session?.user.id ?? null,
        });
      }

      const inventoryRows = await tx
        .select({
          id: inventoryDays.id,
          roomTypeId: inventoryDays.roomTypeId,
          stayDate: inventoryDays.stayDate,
        })
        .from(inventoryDays)
        .where(
          inArray(
            inventoryDays.id,
            checkoutClaims.map((claim) => claim.inventoryDayId),
          ),
        );
      const inventoryByTypeDate = new Map(
        inventoryRows.map((row) => [
          `${row.roomTypeId}:${row.stayDate}`,
          row.id,
        ]),
      );
      const heldInventoryDayIds = new Set(
        checkoutClaims.map((claim) => claim.inventoryDayId),
      );
      const quotedResourceClaims = await tx
        .select()
        .from(resourceClaims)
        .where(
          and(
            inArray(
              resourceClaims.bookingQuoteRoomId,
              quoteRooms.map((room) => room.id),
            ),
            eq(resourceClaims.claimStatus, "ACTIVE"),
          ),
        )
        .orderBy(resourceClaims.resourceInventoryDayId)
        .for("update");
      if (
        quotedResourceClaims.some(
          (claim) => claim.expiresAt && claim.expiresAt <= now,
        )
      ) {
        throw new AppError("CONFLICT", "Extra-bed inventory hold has expired");
      }
      const reservationRoomResults = [];
      const extraBedAddonByRoom = new Map<string, string>();
      for (const [index, quoteRoom] of quoteRooms.entries()) {
        const [reservationRoom] = await tx
          .insert(reservationRooms)
          .values({
            reservationId: reservation.id,
            lineNumber: index + 1,
            bookedRoomTypeId: quoteRoom.roomTypeId,
            fulfilledRoomTypeId: quoteRoom.roomTypeId,
            ratePlanVersionId: quoteRoom.ratePlanVersionId,
            checkInDate: quoteRoom.checkInDate,
            checkoutDate: quoteRoom.checkoutDate,
            adults: quoteRoom.adults,
            children: quoteRoom.children,
            infants: quoteRoom.infants,
            extraBedQuantity: quoteRoom.extraBedQuantity,
            createdByUserId: params.session?.user.id ?? null,
            updatedByUserId: params.session?.user.id ?? null,
          })
          .returning({ id: reservationRooms.id });
        if (!reservationRoom)
          throw new Error("Failed to create reservation room");
        const roomResourceClaims = quotedResourceClaims.filter(
          (claim) => claim.bookingQuoteRoomId === quoteRoom.id,
        );
        for (const sourceClaim of roomResourceClaims) {
          await tx.insert(resourceClaims).values({
            resourceInventoryDayId: sourceClaim.resourceInventoryDayId,
            reservationRoomId: reservationRoom.id,
            quantity: sourceClaim.quantity,
            expiresAt: input.source === "ONLINE" ? deadline : null,
            idempotencyKey: `reservation-resource:${reservation.id}:${reservationRoom.id}:${sourceClaim.resourceInventoryDayId}`,
          });
          await tx
            .update(resourceClaims)
            .set({ claimStatus: "RELEASED", releasedAt: now, updatedAt: now })
            .where(eq(resourceClaims.id, sourceClaim.id));
        }
        const nights = quoteNights.filter(
          (night) => night.quoteRoomId === quoteRoom.id,
        );
        const nightlyExtraBeds = nights
          .map((night) => readExtraBedSnapshot(night.priceSnapshot))
          .filter((snapshot): snapshot is ExtraBedSnapshot =>
            Boolean(snapshot),
          );
        if (nightlyExtraBeds.length > 0) {
          const first = nightlyExtraBeds[0]!;
          const [addon] = await tx
            .insert(reservationAddons)
            .values({
              reservationRoomId: reservationRoom.id,
              resourcePoolId: first.resourcePoolId,
              addonType: "EXTRA_BED",
              quantity: String(first.quantity),
              chargeBasis: "PER_NIGHT",
              unitPriceIdr: String(first.unitPriceIdr),
              totalIdr: String(
                nightlyExtraBeds.reduce(
                  (total, snapshot) => total + snapshot.totalIdr,
                  0,
                ),
              ),
              taxSnapshot: {
                settingVersionId: first.settingVersionId,
                taxConfiguration: first.taxConfiguration,
              },
              createdByUserId: params.session?.user.id ?? null,
              updatedByUserId: params.session?.user.id ?? null,
            })
            .returning({ id: reservationAddons.id });
          if (!addon) throw new Error("Failed to create extra-bed add-on");
          extraBedAddonByRoom.set(reservationRoom.id, addon.id);
        }
        await tx.insert(reservationRoomNights).values(
          nights.map((night) => ({
            reservationRoomId: reservationRoom.id,
            stayDate: night.stayDate,
            roomRateIdr: night.roomRateIdr,
            discountIdr: night.discountIdr,
            taxIdr: night.taxIdr,
            serviceChargeIdr: night.serviceChargeIdr,
            totalIdr: night.totalIdr,
            taxProfileVersionId:
              typeof night.taxSnapshot?.versionId === "string"
                ? night.taxSnapshot.versionId
                : null,
            priceSnapshot: {
              ...night.priceSnapshot,
              quoteId: quote.id,
              quoteNightId: night.id,
              taxSnapshot: night.taxSnapshot,
            },
            createdByUserId: params.session?.user.id ?? null,
            updatedByUserId: params.session?.user.id ?? null,
          })),
        );
        for (const night of nights) {
          const inventoryDayId = inventoryByTypeDate.get(
            `${quoteRoom.roomTypeId}:${night.stayDate}`,
          );
          if (!inventoryDayId || !heldInventoryDayIds.has(inventoryDayId)) {
            throw new AppError("CONFLICT", "Inventory hold is incomplete");
          }
          const [claim] = await tx
            .insert(inventoryClaims)
            .values({
              inventoryDayId,
              claimType:
                input.source === "ONLINE" ? "PAYMENT_HOLD" : "COMMITTED",
              sourceType: "RESERVATION",
              sourceId: reservation.id,
              reservationRoomId: reservationRoom.id,
              quantity: 1,
              expiresAt: input.source === "ONLINE" ? deadline : null,
              idempotencyKey: `reservation:${reservation.id}:${reservationRoom.id}:${night.stayDate}`,
            })
            .returning({ id: inventoryClaims.id });
          if (!claim)
            throw new Error("Failed to create reservation inventory claim");
          await tx.insert(inventoryClaimEvents).values({
            inventoryClaimId: claim.id,
            action:
              input.source === "ONLINE" ? "CREATE_PAYMENT_HOLD" : "COMMIT",
            toStatus: "ACTIVE",
            reason: `Reservation ${bookingCode}`,
          });
        }
        reservationRoomResults.push({
          id: reservationRoom.id,
          lineNumber: index + 1,
        });
      }
      for (const claim of checkoutClaims) {
        await tx
          .update(inventoryClaims)
          .set({ claimStatus: "RELEASED", releasedAt: now, updatedAt: now })
          .where(eq(inventoryClaims.id, claim.id));
        await tx.insert(inventoryClaimEvents).values({
          inventoryClaimId: claim.id,
          action: "CONVERT_TO_RESERVATION",
          fromStatus: "ACTIVE",
          toStatus: "RELEASED",
          reason: `Converted to reservation ${bookingCode}`,
        });
      }
      await tx
        .update(bookingQuotes)
        .set({ status: "CONVERTED", updatedAt: now })
        .where(eq(bookingQuotes.id, quote.id));

      const [folio] = await tx
        .insert(folios)
        .values({
          reservationId: reservation.id,
          createdByUserId: params.session?.user.id ?? null,
          updatedByUserId: params.session?.user.id ?? null,
        })
        .returning({ id: folios.id });
      if (!folio) throw new Error("Failed to create reservation folio");
      const [bucket] = await tx
        .insert(folioBillingBuckets)
        .values({
          folioId: folio.id,
          code: "MASTER",
          name: "Master Folio",
          payerGuestId: guest.id,
          createdByUserId: params.session?.user.id ?? null,
          updatedByUserId: params.session?.user.id ?? null,
        })
        .returning({ id: folioBillingBuckets.id });
      if (!bucket) throw new Error("Failed to create master billing bucket");
      const reservationRoomByLine = new Map(
        reservationRoomResults.map((room) => [room.lineNumber, room.id]),
      );
      for (const [roomIndex, quoteRoom] of quoteRooms.entries()) {
        const reservationRoomId = reservationRoomByLine.get(roomIndex + 1)!;
        for (const night of quoteNights.filter(
          (candidate) => candidate.quoteRoomId === quoteRoom.id,
        )) {
          const extraBed = readExtraBedSnapshot(night.priceSnapshot);
          const roomServiceCharge =
            Number(night.serviceChargeIdr) - (extraBed?.serviceChargeIdr ?? 0);
          const roomTax = Number(night.taxIdr) - (extraBed?.taxIdr ?? 0);
          const roomTotal = Number(night.totalIdr) - (extraBed?.totalIdr ?? 0);
          await tx.insert(folioEntries).values({
            folioId: folio.id,
            billingBucketId: bucket.id,
            entryType: "DEBIT",
            category: "ROOM",
            description: `Room charge ${night.stayDate}`,
            sourceType: "RESERVATION_ROOM_NIGHT",
            sourceId: reservation.id,
            sourceLineId: night.id,
            reservationRoomId,
            serviceDate: night.stayDate,
            quantity: "1",
            unitAmountIdr: night.roomRateIdr,
            netAmountIdr: String(
              Number(night.roomRateIdr) - Number(night.discountIdr),
            ),
            discountAmountIdr: night.discountIdr,
            serviceChargeAmountIdr: String(roomServiceCharge),
            taxAmountIdr: String(roomTax),
            totalAmountIdr: String(roomTotal),
            pricingSnapshot: {
              quoteNightId: night.id,
              price: night.priceSnapshot,
              tax: night.taxSnapshot,
            },
            idempotencyKey: `room-night:${reservation.id}:${reservationRoomId}:${night.stayDate}`,
            postedByUserId: params.session?.user.id ?? null,
            createdByUserId: params.session?.user.id ?? null,
          });
          if (extraBed) {
            const addonId = extraBedAddonByRoom.get(reservationRoomId);
            if (!addonId) throw new Error("Extra-bed folio source is missing");
            await tx.insert(folioEntries).values({
              folioId: folio.id,
              billingBucketId: bucket.id,
              entryType: "DEBIT",
              category: "EXTRA_BED",
              description: `Extra bed ${night.stayDate}`,
              sourceType: "RESERVATION_ADDON",
              sourceId: addonId,
              sourceLineId: night.id,
              reservationRoomId,
              serviceDate: night.stayDate,
              quantity: String(extraBed.quantity),
              unitAmountIdr: String(extraBed.unitPriceIdr),
              netAmountIdr: String(extraBed.netAmountIdr),
              serviceChargeAmountIdr: String(extraBed.serviceChargeIdr),
              taxAmountIdr: String(extraBed.taxIdr),
              totalAmountIdr: String(extraBed.totalIdr),
              pricingSnapshot: extraBed,
              idempotencyKey: `extra-bed:${reservation.id}:${reservationRoomId}:${night.stayDate}`,
              postedByUserId: params.session?.user.id ?? null,
              createdByUserId: params.session?.user.id ?? null,
            });
          }
        }
      }

      if (input.source === "ONLINE" && deadline && paymentInstruction) {
        const instructionText =
          quote.language === "en"
            ? paymentInstruction.instructionEn
            : paymentInstruction.instructionId;
        const baseUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
        const body = `${quote.language === "en" ? "Complete your KOOKA Residence booking" : "Selesaikan booking KOOKA Residence"}\n\nBooking code: ${bookingCode}\nOfficial total: IDR ${totalIdr.toLocaleString("id-ID")}\nDeadline: ${deadline.toISOString()}\nBank: ${paymentInstruction.bankName}\nAccount holder: ${paymentInstruction.accountHolder}\n${instructionText}\n\nOpen: ${baseUrl}/booking/lookup?code=${encodeURIComponent(bookingCode)}`;
        await createEmailMessage(tx, {
          propertyId: params.propertyId,
          reservationId: reservation.id,
          recipient: email,
          subject:
            quote.language === "en"
              ? `Complete booking ${bookingCode}`
              : `Selesaikan booking ${bookingCode}`,
          body,
          scheduledAt: now,
          idempotencyKey: `reservation:${reservation.id}:payment-instruction`,
        });
        const reminderAt = new Date(
          Math.max(now.getTime(), deadline.getTime() - REMINDER_LEAD_MS),
        );
        await createEmailMessage(tx, {
          propertyId: params.propertyId,
          reservationId: reservation.id,
          recipient: email,
          subject:
            quote.language === "en"
              ? `Payment deadline reminder ${bookingCode}`
              : `Pengingat batas pembayaran ${bookingCode}`,
          body: `${body}\n\n${quote.language === "en" ? "This is a payment-deadline reminder." : "Ini adalah pengingat batas waktu pembayaran."}`,
          scheduledAt: reminderAt,
          idempotencyKey: `reservation:${reservation.id}:payment-reminder`,
        });
        await enqueueOutboxEvent(
          {
            topic: "booking.reservation-expire",
            aggregateType: "reservation",
            aggregateId: reservation.id,
            payload: { reservationId: reservation.id },
            availableAt: deadline,
          },
          tx,
        );
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session?.user.id ?? null,
          actorType: input.source === "ONLINE" ? "customer" : "user",
          action: "booking.reservation.create",
          targetType: "reservation",
          targetId: reservation.id,
          after: {
            bookingCode,
            source: input.source,
            status: reservationStatus,
            roomCount: quoteRooms.length,
            totalIdr,
            requiredPaymentIdr,
          },
          reason:
            input.source === "ONLINE"
              ? "Public online booking"
              : "Front Office manual booking",
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "reservation",
        resultId: reservation.id,
        response: {
          reservationId: reservation.id,
          bookingCode,
          status: reservationStatus,
          totalIdr,
          requiredPaymentIdr,
          paymentDeadlineAt: deadline?.toISOString() ?? null,
          paymentInstruction: paymentInstruction
            ? {
                bankName: paymentInstruction.bankName,
                accountHolder: paymentInstruction.accountHolder,
                accountNumber: decryptSensitiveValue(
                  paymentInstruction.accountNumberCiphertext,
                ),
                accountNumberLast4: paymentInstruction.accountNumberLast4,
                instruction:
                  quote.language === "en"
                    ? paymentInstruction.instructionEn
                    : paymentInstruction.instructionId,
              }
            : null,
          rooms: reservationRoomResults,
        },
      };
    },
  );
}

export async function cancelReservation(params: {
  propertyId: string;
  reservationId: string;
  reason: string;
  session: StaffSessionLike;
  idempotencyKey: string;
}) {
  await requirePermission(params.session, params.propertyId, "booking.manage");
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new AppError("VALIDATION_ERROR", "A cancellation reason is required");
  }
  return withIdempotency(
    {
      scope: "booking.reservation.cancel",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({
        reservationId: params.reservationId,
        reason,
      }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [reservation] = await tx
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.id, params.reservationId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (
        !reservation ||
        !["DRAFT", "ON_HOLD", "CONFIRMED"].includes(reservation.status)
      ) {
        throw new AppError("CONFLICT", "Reservation cannot be cancelled");
      }
      const now = new Date();
      await tx
        .update(reservations)
        .set({
          status: "CANCELLED",
          cancelledAt: now,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(reservations.id, reservation.id));
      await tx.insert(reservationStatusEvents).values({
        reservationId: reservation.id,
        action: "CANCEL",
        fromStatus: reservation.status,
        toStatus: "CANCELLED",
        actorUserId: params.session.user.id,
        reason,
        createdByUserId: params.session.user.id,
      });
      const claims = await tx
        .update(inventoryClaims)
        .set({
          claimStatus: "RELEASED",
          releasedAt: now,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(
          and(
            eq(inventoryClaims.sourceType, "RESERVATION"),
            eq(inventoryClaims.sourceId, reservation.id),
            eq(inventoryClaims.claimStatus, "ACTIVE"),
          ),
        )
        .returning({ id: inventoryClaims.id });
      if (claims.length) {
        await tx.insert(inventoryClaimEvents).values(
          claims.map((claim) => ({
            inventoryClaimId: claim.id,
            action: "RELEASE_AFTER_CANCELLATION",
            fromStatus: "ACTIVE",
            toStatus: "RELEASED",
            reason,
            createdByUserId: params.session.user.id,
          })),
        );
      }
      await tx.execute(sql`
        update resource_claims
        set claim_status = 'RELEASED', released_at = ${now}, updated_at = ${now},
            updated_by_user_id = ${params.session.user.id}::uuid,
            version = version + 1
        where reservation_room_id in (
          select id from reservation_rooms where reservation_id = ${reservation.id}
        ) and claim_status = 'ACTIVE'
      `);
      await tx
        .update(notificationMessages)
        .set({
          status: "CANCELLED",
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(
          and(
            eq(notificationMessages.reservationId, reservation.id),
            eq(notificationMessages.status, "QUEUED"),
          ),
        );
      await createEmailMessage(tx, {
        propertyId: params.propertyId,
        reservationId: reservation.id,
        recipient: reservation.bookerEmailNormalized,
        subject:
          reservation.language === "en"
            ? `Booking cancelled ${reservation.bookingCode}`
            : `Booking dibatalkan ${reservation.bookingCode}`,
        body:
          reservation.language === "en"
            ? `Booking ${reservation.bookingCode} has been cancelled by Front Office. Any refund amount is handled manually according to the applicable policy.`
            : `Booking ${reservation.bookingCode} telah dibatalkan oleh Front Office. Nominal refund ditangani manual sesuai kebijakan yang berlaku.`,
        scheduledAt: now,
        idempotencyKey: `reservation:${reservation.id}:cancelled`,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "booking.reservation.cancel",
          targetType: "reservation",
          targetId: reservation.id,
          before: { status: reservation.status },
          after: { status: "CANCELLED", releasedClaimCount: claims.length },
          reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "reservation",
        resultId: reservation.id,
        response: { reservationId: reservation.id, status: "CANCELLED" },
      };
    },
  );
}
