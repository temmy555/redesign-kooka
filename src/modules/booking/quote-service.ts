import "server-only";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import {
  bookingQuoteNights,
  bookingQuoteRooms,
  bookingQuotes,
  propertySettingSets,
  propertySettingVersions,
  resourceClaims,
  resourceInventoryDays,
  resourcePools,
  roomTypes,
  roomTypeVersions,
} from "../../db/schema";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import { enqueueOutboxEvent } from "../../platform/outbox";
import {
  assertInventoryAvailable,
  ensureInventoryDays,
  readInventoryAvailability,
} from "./availability";
import type { QuoteRequest, StaffSessionLike } from "./contracts";
import {
  calculateNightAmounts,
  enumerateStayDates,
  stableRequestHash,
} from "./domain";
import { resolveDisplayEstimate, resolveNightPrice } from "./pricing";

const QUOTE_VALIDITY_MS = 15 * 60 * 1000;
const MAX_ROOMS_PER_BOOKING = 15;

type ExtraBedPriceSnapshot =
  | (ReturnType<typeof calculateNightAmounts> & {
      resourcePoolId: string | null;
      quantity: number;
      unitPriceIdr: number;
      settingVersionId: string;
      taxConfiguration: {
        taxRate: number;
        serviceChargeRate: number;
        taxInclusive: boolean;
        serviceChargeInclusive: boolean;
        noTax: boolean;
      };
    })
  | null;

type PricedNight = Awaited<ReturnType<typeof resolveNightPrice>> & {
  extraBedSnapshot: ExtraBedPriceSnapshot;
};

export async function createBookingQuote(params: {
  propertyId: string;
  input: QuoteRequest;
  idempotencyKey: string;
  source?: "ONLINE" | "ADMIN_MANUAL";
  session?: StaffSessionLike;
}) {
  const input = params.input;
  const source = params.source ?? "ONLINE";
  if (source === "ADMIN_MANUAL") {
    if (!params.session) throw new AppError("UNAUTHORIZED", "Unauthenticated");
    await requirePermission(
      params.session,
      params.propertyId,
      "booking.manage",
    );
  }
  const stayDates = enumerateStayDates(input.checkInDate, input.checkoutDate);
  if (input.rooms.length < 1 || input.rooms.length > MAX_ROOMS_PER_BOOKING) {
    throw new AppError("VALIDATION_ERROR", "Invalid room count");
  }
  for (const room of input.rooms) {
    if (
      !Number.isInteger(room.adults) ||
      room.adults < 1 ||
      !Number.isInteger(room.children) ||
      room.children < 0 ||
      !Number.isInteger(room.infants) ||
      room.infants < 0 ||
      !Number.isInteger(room.extraBedQuantity) ||
      room.extraBedQuantity < 0
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid guest or extra-bed count",
      );
    }
  }
  const requestHash = stableRequestHash({
    propertyId: params.propertyId,
    source,
    input,
  });
  return withIdempotency(
    {
      scope: "booking.quote.create",
      key: params.idempotencyKey,
      requestHash,
      ownerUserId: params.session?.user.id ?? null,
      ttlMs: 60 * 60 * 1000,
    },
    async (tx) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + QUOTE_VALIDITY_MS);
      const roomTypeIds = [
        ...new Set(input.rooms.map((room) => room.roomTypeId)),
      ];
      const versions = await tx
        .select({
          roomTypeId: roomTypes.id,
          lifecycleStatus: roomTypeVersions.lifecycleStatus,
          effectiveFrom: roomTypeVersions.effectiveFrom,
          effectiveTo: roomTypeVersions.effectiveTo,
          maximumAdults: roomTypeVersions.maximumAdults,
          maximumChildren: roomTypeVersions.maximumChildren,
          maximumTotalGuests: roomTypeVersions.maximumTotalGuests,
          extraBedAllowed: roomTypeVersions.extraBedAllowed,
          maximumExtraBeds: roomTypeVersions.maximumExtraBeds,
          extraBedCapacityIncrement: roomTypeVersions.extraBedCapacityIncrement,
        })
        .from(roomTypes)
        .innerJoin(
          roomTypeVersions,
          eq(roomTypeVersions.roomTypeId, roomTypes.id),
        )
        .where(
          and(
            eq(roomTypes.propertyId, params.propertyId),
            eq(roomTypes.status, "ACTIVE"),
            inArray(roomTypes.id, roomTypeIds),
            inArray(roomTypeVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          ),
        );
      const activeVersions = new Map(
        versions
          .filter(
            (version) =>
              version.effectiveFrom <= now &&
              (!version.effectiveTo || version.effectiveTo > now),
          )
          .map((version) => [version.roomTypeId, version]),
      );
      for (const room of input.rooms) {
        const version = activeVersions.get(room.roomTypeId);
        if (!version)
          throw new AppError("NOT_FOUND", "Room type is unavailable");
        const capacityIncrement =
          room.extraBedQuantity * version.extraBedCapacityIncrement;
        if (
          room.adults > version.maximumAdults + capacityIncrement ||
          room.children > version.maximumChildren ||
          room.adults + room.children >
            version.maximumTotalGuests + capacityIncrement ||
          room.extraBedQuantity > version.maximumExtraBeds ||
          (room.extraBedQuantity > 0 && !version.extraBedAllowed)
        ) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Guest or extra-bed count exceeds room capacity",
          );
        }
      }

      await ensureInventoryDays(tx, params.propertyId, roomTypeIds, stayDates);
      const inventory = await readInventoryAvailability(
        tx,
        params.propertyId,
        roomTypeIds,
        stayDates,
        { lock: true, now },
      );
      const quantities = new Map<string, number>();
      for (const room of input.rooms) {
        quantities.set(
          room.roomTypeId,
          (quantities.get(room.roomTypeId) ?? 0) + 1,
        );
      }
      assertInventoryAvailable(inventory, quantities, stayDates);

      const requestedExtraBeds = input.rooms.reduce(
        (total, room) => total + room.extraBedQuantity,
        0,
      );
      let extraBedPoolId: string | null = null;
      let extraBedPricing:
        | {
            nightlyRateIdr: number;
            taxRate: number;
            serviceChargeRate: number;
            taxInclusive: boolean;
            serviceChargeInclusive: boolean;
            noTax: boolean;
            settingVersionId: string;
          }
        | undefined;
      if (requestedExtraBeds > 0) {
        const [pool] = await tx
          .select()
          .from(resourcePools)
          .where(
            and(
              eq(resourcePools.propertyId, params.propertyId),
              eq(resourcePools.code, "EXTRA_BED"),
              eq(resourcePools.status, "ACTIVE"),
            ),
          )
          .limit(1);
        if (!pool) {
          throw new AppError(
            "CONFLICT",
            "Extra-bed inventory is not configured",
          );
        }
        const pricingRows = await tx
          .select({
            id: propertySettingVersions.id,
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
              eq(propertySettingSets.propertyId, params.propertyId),
              eq(propertySettingSets.code, "EXTRA_BED_PRICING"),
              inArray(propertySettingVersions.lifecycleStatus, [
                "ACTIVE",
                "SCHEDULED",
              ]),
            ),
          )
          .orderBy(propertySettingVersions.effectiveFrom);
        const pricing = pricingRows
          .filter(
            (row) =>
              row.effectiveFrom <= now &&
              (!row.effectiveTo || row.effectiveTo > now),
          )
          .at(-1);
        const nightlyRateIdr = Number(pricing?.values.nightlyRateIdr);
        const taxRate = Number(pricing?.values.taxRate ?? 0);
        const serviceChargeRate = Number(
          pricing?.values.serviceChargeRate ?? 0,
        );
        if (
          !pricing ||
          !Number.isInteger(nightlyRateIdr) ||
          nightlyRateIdr <= 0 ||
          !Number.isFinite(taxRate) ||
          taxRate < 0 ||
          !Number.isFinite(serviceChargeRate) ||
          serviceChargeRate < 0 ||
          typeof pricing.values.noTax !== "boolean" ||
          (pricing.values.noTax && (taxRate !== 0 || serviceChargeRate !== 0))
        ) {
          throw new AppError("CONFLICT", "Extra-bed pricing is not configured");
        }
        extraBedPricing = {
          nightlyRateIdr,
          taxRate,
          serviceChargeRate,
          taxInclusive: Boolean(pricing.values.taxInclusive),
          serviceChargeInclusive: Boolean(
            pricing.values.serviceChargeInclusive,
          ),
          noTax: pricing.values.noTax,
          settingVersionId: pricing.id,
        };
        extraBedPoolId = pool.id;
        if (!pool.inventoryTracked) {
          extraBedPoolId = null;
        } else {
          await tx
            .insert(resourceInventoryDays)
            .values(
              stayDates.map((stayDate) => ({
                resourcePoolId: pool.id,
                stayDate,
                physicalCapacity: pool.physicalCapacity,
              })),
            )
            .onConflictDoUpdate({
              target: [
                resourceInventoryDays.resourcePoolId,
                resourceInventoryDays.stayDate,
              ],
              set: { physicalCapacity: pool.physicalCapacity, updatedAt: now },
            });
          const resourceDays = await tx
            .select()
            .from(resourceInventoryDays)
            .where(
              and(
                eq(resourceInventoryDays.resourcePoolId, pool.id),
                inArray(resourceInventoryDays.stayDate, stayDates),
              ),
            )
            .orderBy(resourceInventoryDays.stayDate)
            .for("update");
          const activeResourceClaims = await tx
            .select({
              resourceInventoryDayId: resourceClaims.resourceInventoryDayId,
              quantity: resourceClaims.quantity,
            })
            .from(resourceClaims)
            .where(
              and(
                inArray(
                  resourceClaims.resourceInventoryDayId,
                  resourceDays.map((day) => day.id),
                ),
                eq(resourceClaims.claimStatus, "ACTIVE"),
                isNotNull(resourceClaims.reservationRoomId),
                sql`(${resourceClaims.expiresAt} is null or ${resourceClaims.expiresAt} > ${now})`,
              ),
            );
          const usedByDay = new Map<string, number>();
          for (const claim of activeResourceClaims) {
            usedByDay.set(
              claim.resourceInventoryDayId,
              (usedByDay.get(claim.resourceInventoryDayId) ?? 0) +
                claim.quantity,
            );
          }
          for (const day of resourceDays) {
            if (
              day.physicalCapacity - (usedByDay.get(day.id) ?? 0) <
              requestedExtraBeds
            ) {
              throw new AppError(
                "CONFLICT",
                "Requested extra beds are no longer available",
              );
            }
          }
        }
      }

      const pricedRooms: {
        room: QuoteRequest["rooms"][number];
        nights: PricedNight[];
        totalIdr: number;
      }[] = [];
      for (const room of input.rooms) {
        const nights: PricedNight[] = [];
        for (const stayDate of stayDates) {
          const roomNight = await resolveNightPrice(tx, {
            propertyId: params.propertyId,
            ratePlanCode: room.ratePlanCode ?? input.ratePlanCode,
            roomTypeId: room.roomTypeId,
            stayDate,
            checkInDate: input.checkInDate,
            checkoutDate: input.checkoutDate,
            at: now,
            source,
          });
          const extraBedAmounts =
            room.extraBedQuantity > 0 && extraBedPricing
              ? calculateNightAmounts({
                  roomRateIdr:
                    extraBedPricing.nightlyRateIdr * room.extraBedQuantity,
                  taxRate: extraBedPricing.taxRate,
                  serviceChargeRate: extraBedPricing.serviceChargeRate,
                  taxInclusive: extraBedPricing.taxInclusive,
                  serviceChargeInclusive:
                    extraBedPricing.serviceChargeInclusive,
                  noTax: extraBedPricing.noTax,
                })
              : null;
          nights.push({
            ...roomNight,
            taxIdr: roomNight.taxIdr + (extraBedAmounts?.taxIdr ?? 0),
            serviceChargeIdr:
              roomNight.serviceChargeIdr +
              (extraBedAmounts?.serviceChargeIdr ?? 0),
            totalIdr: roomNight.totalIdr + (extraBedAmounts?.totalIdr ?? 0),
            extraBedSnapshot:
              extraBedAmounts && extraBedPricing
                ? {
                    resourcePoolId: extraBedPoolId,
                    quantity: room.extraBedQuantity,
                    unitPriceIdr: extraBedPricing.nightlyRateIdr,
                    settingVersionId: extraBedPricing.settingVersionId,
                    ...extraBedAmounts,
                    taxConfiguration: {
                      taxRate: extraBedPricing.taxRate,
                      serviceChargeRate: extraBedPricing.serviceChargeRate,
                      taxInclusive: extraBedPricing.taxInclusive,
                      serviceChargeInclusive:
                        extraBedPricing.serviceChargeInclusive,
                      noTax: extraBedPricing.noTax,
                    },
                  }
                : null,
          });
        }
        pricedRooms.push({
          room,
          nights,
          totalIdr: nights.reduce((total, night) => total + night.totalIdr, 0),
        });
      }
      const totalIdr = pricedRooms.reduce(
        (total, room) => total + room.totalIdr,
        0,
      );
      const taxIdr = pricedRooms.reduce(
        (roomTotal, room) =>
          roomTotal +
          room.nights.reduce(
            (nightTotal, night) => nightTotal + night.taxIdr,
            0,
          ),
        0,
      );
      const serviceChargeIdr = pricedRooms.reduce(
        (roomTotal, room) =>
          roomTotal +
          room.nights.reduce(
            (nightTotal, night) => nightTotal + night.serviceChargeIdr,
            0,
          ),
        0,
      );
      const netAmountIdr = totalIdr - taxIdr - serviceChargeIdr;
      const display = await resolveDisplayEstimate(
        tx,
        params.propertyId,
        input.displayCurrency,
        totalIdr,
        now,
      );
      const [quote] = await tx
        .insert(bookingQuotes)
        .values({
          propertyId: params.propertyId,
          language: input.language,
          displayCurrency: input.displayCurrency,
          exchangeRateSnapshotId: display.exchangeRateSnapshotId,
          totalIdr: String(totalIdr),
          displayTotal: String(display.displayTotal),
          expiresAt,
        })
        .returning({ id: bookingQuotes.id });
      if (!quote) throw new Error("Failed to create booking quote");

      const quoteRooms = [];
      for (const [index, priced] of pricedRooms.entries()) {
        const firstNight = priced.nights[0]!;
        const [quoteRoom] = await tx
          .insert(bookingQuoteRooms)
          .values({
            quoteId: quote.id,
            roomTypeId: priced.room.roomTypeId,
            ratePlanVersionId: firstNight.ratePlanVersionId,
            checkInDate: input.checkInDate,
            checkoutDate: input.checkoutDate,
            adults: priced.room.adults,
            children: priced.room.children,
            infants: priced.room.infants,
            extraBedQuantity: priced.room.extraBedQuantity,
            totalIdr: String(priced.totalIdr),
          })
          .returning({ id: bookingQuoteRooms.id });
        if (!quoteRoom) throw new Error("Failed to create quoted room");
        await tx.insert(bookingQuoteNights).values(
          priced.nights.map((night, nightIndex) => ({
            quoteRoomId: quoteRoom.id,
            stayDate: stayDates[nightIndex]!,
            rateRuleId: night.rateRuleId,
            roomRateIdr: String(night.roomRateIdr),
            discountIdr: "0",
            taxIdr: String(night.taxIdr),
            serviceChargeIdr: String(night.serviceChargeIdr),
            totalIdr: String(night.totalIdr),
            taxSnapshot: night.taxSnapshot,
            priceSnapshot: {
              ratePlanVersionId: night.ratePlanVersionId,
              ratePlanVersionNumber: night.ratePlanVersionNumber,
              rateRuleId: night.rateRuleId,
              rateRuleType: night.rateRuleType,
              roomTotalIdr:
                night.totalIdr - (night.extraBedSnapshot?.totalIdr ?? 0),
              extraBed: night.extraBedSnapshot,
              resolvedAt: now.toISOString(),
            },
          })),
        );
        quoteRooms.push({
          id: quoteRoom.id,
          lineNumber: index + 1,
          totalIdr: priced.totalIdr,
        });
      }

      await enqueueOutboxEvent(
        {
          topic: "booking.quote-expire",
          aggregateType: "booking_quote",
          aggregateId: quote.id,
          payload: { quoteId: quote.id },
          availableAt: expiresAt,
        },
        tx,
      );
      return {
        resultType: "booking_quote",
        resultId: quote.id,
        response: {
          quoteId: quote.id,
          netAmountIdr,
          serviceChargeIdr,
          taxIdr,
          totalIdr,
          displayCurrency: input.displayCurrency,
          displayTotal: display.displayTotal,
          displayEstimated: input.displayCurrency !== "IDR",
          expiresAt: expiresAt.toISOString(),
          rooms: quoteRooms,
        },
      };
    },
  );
}
