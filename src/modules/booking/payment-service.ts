import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import {
  folioEntries,
  folios,
  inventoryClaimEvents,
  inventoryClaims,
  notificationMessages,
  paymentProofs,
  payments,
  paymentStatusEvents,
  reservations,
  reservationRooms,
  reservationStatusEvents,
  resourceClaims,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import type { IdempotencyTransaction } from "../../platform/idempotency";
import { enqueueOutboxEvent } from "../../platform/outbox";
import type { StaffSessionLike } from "./contracts";
import { stableRequestHash } from "./domain";

function paymentCode(now = new Date()) {
  return `PAY-${now.toISOString().slice(2, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function queuePaymentEmail(
  tx: IdempotencyTransaction,
  input: {
    propertyId: string;
    reservationId: string;
    recipient: string;
    subject: string;
    body: string;
    key: string;
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
      scheduledAt: new Date(),
      idempotencyKey: input.key,
    })
    .returning({ id: notificationMessages.id });
  if (!message) throw new Error("Failed to queue payment email");
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
    },
    tx,
  );
}

export async function recordPaymentForReview(params: {
  propertyId: string;
  session: StaffSessionLike;
  reservationId: string;
  amountIdr: number;
  method:
    "BANK_TRANSFER" | "CASH" | "PAY_AT_CHECKIN" | "PAY_AT_CHECKOUT" | "OTHER";
  receivedAt: Date;
  reference?: string | null;
  proofFileId?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  if (!Number.isInteger(params.amountIdr) || params.amountIdr <= 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Payment amount must be whole positive IDR",
    );
  }
  return withIdempotency(
    {
      scope: "booking.payment.record",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({
        reservationId: params.reservationId,
        amountIdr: params.amountIdr,
        method: params.method,
        receivedAt: params.receivedAt.toISOString(),
        reference: params.reference ?? null,
        proofFileId: params.proofFileId ?? null,
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
        !["ON_HOLD", "CONFIRMED"].includes(reservation.status)
      ) {
        throw new AppError("CONFLICT", "Reservation cannot accept a payment");
      }
      if (
        reservation.source === "ONLINE" &&
        reservation.paymentDeadlineAt &&
        params.receivedAt > reservation.paymentDeadlineAt
      ) {
        throw new AppError(
          "CONFLICT",
          "Payment evidence was received after the booking deadline",
        );
      }
      const [folio] = await tx
        .select({ id: folios.id })
        .from(folios)
        .where(eq(folios.reservationId, reservation.id))
        .limit(1)
        .for("update");
      if (!folio)
        throw new AppError("CONFLICT", "Reservation folio is missing");
      const [payment] = await tx
        .insert(payments)
        .values({
          folioId: folio.id,
          paymentCode: paymentCode(),
          method: params.method,
          amountIdr: String(params.amountIdr),
          status: "PENDING_VERIFICATION",
          receivedAt: params.receivedAt,
          reference: params.reference?.trim() || null,
          paymentInstructionVersionId: reservation.paymentInstructionVersionId,
          destinationSnapshot: { reservationId: reservation.id },
          idempotencyKey: params.idempotencyKey,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: payments.id, paymentCode: payments.paymentCode });
      if (!payment) throw new Error("Failed to record payment");
      if (params.proofFileId) {
        await tx.insert(paymentProofs).values({
          paymentId: payment.id,
          fileId: params.proofFileId,
          submittedVia: "WHATSAPP_FRONT_OFFICE",
          notes: params.notes?.trim() || null,
          createdByUserId: params.session.user.id,
        });
      }
      await tx.insert(paymentStatusEvents).values({
        paymentId: payment.id,
        action: "RECORD_FOR_REVIEW",
        toStatus: "PENDING_VERIFICATION",
        reason: "Evidence/reference received by Front Office",
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      await queuePaymentEmail(tx, {
        propertyId: params.propertyId,
        reservationId: reservation.id,
        recipient: reservation.bookerEmailNormalized,
        subject:
          reservation.language === "en"
            ? `Payment is being reviewed ${reservation.bookingCode}`
            : `Pembayaran sedang diverifikasi ${reservation.bookingCode}`,
        body:
          reservation.language === "en"
            ? `We recorded payment evidence for booking ${reservation.bookingCode}. Your room inventory remains held while Front Office verifies it.`
            : `Bukti pembayaran untuk booking ${reservation.bookingCode} telah dicatat. Inventori kamar tetap ditahan selama Front Office melakukan verifikasi.`,
        key: `payment:${payment.id}:review`,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "payment.record_for_review",
          targetType: "payment",
          targetId: payment.id,
          after: {
            reservationId: reservation.id,
            amountIdr: params.amountIdr,
            method: params.method,
            hasProof: Boolean(params.proofFileId),
          },
          reason: "Manual payment evidence intake",
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "payment",
        resultId: payment.id,
        response: {
          paymentId: payment.id,
          paymentCode: payment.paymentCode,
          status: "PENDING_VERIFICATION",
        },
      };
    },
  );
}

export async function reviewPayment(params: {
  propertyId: string;
  session: StaffSessionLike;
  paymentId: string;
  decision: "VERIFY" | "REJECT";
  reason: string;
  idempotencyKey: string;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  const reason = params.reason.trim();
  if (reason.length < 3)
    throw new AppError("VALIDATION_ERROR", "A reason is required");
  return withIdempotency(
    {
      scope: "booking.payment.review",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({
        paymentId: params.paymentId,
        decision: params.decision,
        reason,
      }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, params.paymentId))
        .limit(1)
        .for("update");
      if (!payment || payment.status !== "PENDING_VERIFICATION") {
        throw new AppError("CONFLICT", "Payment is not pending verification");
      }
      const [folio] = await tx
        .select()
        .from(folios)
        .where(eq(folios.id, payment.folioId))
        .limit(1)
        .for("update");
      if (!folio) throw new AppError("CONFLICT", "Payment folio is missing");
      const [reservation] = await tx
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.id, folio.reservationId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!reservation)
        throw new AppError("NOT_FOUND", "Reservation not found");
      const now = new Date();
      if (params.decision === "REJECT") {
        await tx
          .update(payments)
          .set({
            status: "REJECTED",
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(payments.id, payment.id));
        await tx.insert(paymentStatusEvents).values({
          paymentId: payment.id,
          action: "REJECT",
          fromStatus: payment.status,
          toStatus: "REJECTED",
          reason,
          actorUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        });
        if (
          reservation.status === "ON_HOLD" &&
          reservation.paymentDeadlineAt &&
          reservation.paymentDeadlineAt <= now
        ) {
          await expireReservationInTransaction(
            tx,
            reservation.id,
            params.session.user.id,
            "Payment rejected after deadline",
          );
        }
        await queuePaymentEmail(tx, {
          propertyId: params.propertyId,
          reservationId: reservation.id,
          recipient: reservation.bookerEmailNormalized,
          subject:
            reservation.language === "en"
              ? `Payment review update ${reservation.bookingCode}`
              : `Pembaruan verifikasi pembayaran ${reservation.bookingCode}`,
          body:
            reservation.language === "en"
              ? `The payment for booking ${reservation.bookingCode} could not be verified. Please contact Front Office.`
              : `Pembayaran untuk booking ${reservation.bookingCode} belum dapat diverifikasi. Silakan hubungi Front Office.`,
          key: `payment:${payment.id}:rejected`,
        });
      } else {
        const [entry] = await tx
          .insert(folioEntries)
          .values({
            folioId: folio.id,
            entryType: "CREDIT",
            category: "PAYMENT",
            description: `Payment ${payment.paymentCode}`,
            sourceType: "PAYMENT",
            sourceId: payment.id,
            serviceDate: now.toISOString().slice(0, 10),
            quantity: "1",
            unitAmountIdr: payment.amountIdr,
            netAmountIdr: payment.amountIdr,
            totalAmountIdr: payment.amountIdr,
            pricingSnapshot: {
              method: payment.method,
              verifiedAt: now.toISOString(),
            },
            idempotencyKey: `payment-verify:${payment.id}`,
            postedByUserId: params.session.user.id,
            createdByUserId: params.session.user.id,
          })
          .returning({ id: folioEntries.id });
        if (!entry) throw new Error("Failed to post payment to folio");
        await tx
          .update(payments)
          .set({
            status: "VERIFIED",
            verifiedAt: now,
            verifiedByUserId: params.session.user.id,
            folioEntryId: entry.id,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(payments.id, payment.id));
        await tx.insert(paymentStatusEvents).values({
          paymentId: payment.id,
          action: "VERIFY",
          fromStatus: payment.status,
          toStatus: "VERIFIED",
          reason,
          actorUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        });
        const verified = await tx
          .select({ amountIdr: payments.amountIdr })
          .from(payments)
          .where(
            and(
              eq(payments.folioId, folio.id),
              eq(payments.status, "VERIFIED"),
            ),
          );
        const verifiedTotal = verified.reduce(
          (total, row) => total + Number(row.amountIdr),
          0,
        );
        const fullyPaid =
          verifiedTotal >= Number(reservation.requiredPaymentIdr);
        if (
          reservation.source === "ONLINE" &&
          fullyPaid &&
          reservation.status === "ON_HOLD"
        ) {
          await tx
            .update(reservations)
            .set({
              status: "CONFIRMED",
              guaranteed: true,
              updatedAt: now,
              updatedByUserId: params.session.user.id,
            })
            .where(eq(reservations.id, reservation.id));
          await tx.insert(reservationStatusEvents).values({
            reservationId: reservation.id,
            action: "CONFIRM_AFTER_FULL_PAYMENT",
            fromStatus: "ON_HOLD",
            toStatus: "CONFIRMED",
            actorUserId: params.session.user.id,
            reason,
            guardResult: {
              requiredPaymentIdr: reservation.requiredPaymentIdr,
              verifiedTotal,
            },
            createdByUserId: params.session.user.id,
          });
          const claims = await tx
            .update(inventoryClaims)
            .set({ claimType: "COMMITTED", expiresAt: null, updatedAt: now })
            .where(
              and(
                eq(inventoryClaims.sourceType, "RESERVATION"),
                eq(inventoryClaims.sourceId, reservation.id),
                eq(inventoryClaims.claimStatus, "ACTIVE"),
                eq(inventoryClaims.claimType, "PAYMENT_HOLD"),
              ),
            )
            .returning({ id: inventoryClaims.id });
          if (claims.length) {
            await tx.insert(inventoryClaimEvents).values(
              claims.map((claim) => ({
                inventoryClaimId: claim.id,
                action: "COMMIT_AFTER_FULL_PAYMENT",
                fromStatus: "ACTIVE",
                toStatus: "ACTIVE",
                reason: `Payment ${payment.paymentCode} verified`,
                createdByUserId: params.session.user.id,
              })),
            );
          }
          await tx
            .update(resourceClaims)
            .set({ expiresAt: null, updatedAt: now })
            .where(
              and(
                inArray(
                  resourceClaims.reservationRoomId,
                  tx
                    .select({ id: reservationRooms.id })
                    .from(reservationRooms)
                    .where(eq(reservationRooms.reservationId, reservation.id)),
                ),
                eq(resourceClaims.claimStatus, "ACTIVE"),
              ),
            );
        }
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
              sql`${notificationMessages.scheduledAt} > ${now}`,
            ),
          );
        await queuePaymentEmail(tx, {
          propertyId: params.propertyId,
          reservationId: reservation.id,
          recipient: reservation.bookerEmailNormalized,
          subject: fullyPaid
            ? `Booking confirmed ${reservation.bookingCode}`
            : `Payment verified ${reservation.bookingCode}`,
          body: fullyPaid
            ? `Payment has been verified and booking ${reservation.bookingCode} is confirmed.`
            : `Payment has been verified for booking ${reservation.bookingCode}. An outstanding balance remains.`,
          key: `payment:${payment.id}:verified`,
        });
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action:
            params.decision === "VERIFY" ? "payment.verify" : "payment.reject",
          targetType: "payment",
          targetId: payment.id,
          before: { status: payment.status },
          after: {
            status: params.decision === "VERIFY" ? "VERIFIED" : "REJECTED",
          },
          reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "payment",
        resultId: payment.id,
        response: {
          paymentId: payment.id,
          status: params.decision === "VERIFY" ? "VERIFIED" : "REJECTED",
        },
      };
    },
  );
}

export async function voidPayment(params: {
  propertyId: string;
  session: StaffSessionLike;
  paymentId: string;
  reason: string;
  idempotencyKey: string;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  const reason = params.reason.trim();
  if (reason.length < 3)
    throw new AppError("VALIDATION_ERROR", "A reason is required");
  return withIdempotency(
    {
      scope: "booking.payment.void",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({ paymentId: params.paymentId, reason }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, params.paymentId))
        .limit(1)
        .for("update");
      if (
        !payment ||
        !["PENDING_VERIFICATION", "VERIFIED"].includes(payment.status)
      ) {
        throw new AppError("CONFLICT", "Payment cannot be voided");
      }
      const [folio] = await tx
        .select()
        .from(folios)
        .where(eq(folios.id, payment.folioId))
        .limit(1)
        .for("update");
      if (!folio) throw new AppError("CONFLICT", "Payment folio is missing");
      const [reservation] = await tx
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.id, folio.reservationId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!reservation)
        throw new AppError("NOT_FOUND", "Reservation not found");
      const now = new Date();
      if (payment.status === "VERIFIED") {
        if (!payment.folioEntryId) {
          throw new AppError("CONFLICT", "Verified payment has no folio entry");
        }
        await tx.insert(folioEntries).values({
          folioId: folio.id,
          entryType: "DEBIT",
          category: "PAYMENT_REVERSAL",
          description: `Void payment ${payment.paymentCode}`,
          sourceType: "PAYMENT_VOID",
          sourceId: payment.id,
          serviceDate: now.toISOString().slice(0, 10),
          quantity: "1",
          unitAmountIdr: payment.amountIdr,
          netAmountIdr: payment.amountIdr,
          totalAmountIdr: payment.amountIdr,
          pricingSnapshot: { reason, voidedAt: now.toISOString() },
          reversalOfEntryId: payment.folioEntryId,
          idempotencyKey: `payment-void:${payment.id}`,
          postedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        });
      }
      await tx
        .update(payments)
        .set({
          status: "VOIDED",
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(payments.id, payment.id));
      await tx.insert(paymentStatusEvents).values({
        paymentId: payment.id,
        action: "VOID",
        fromStatus: payment.status,
        toStatus: "VOIDED",
        reason,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      const remaining = await tx
        .select({ amountIdr: payments.amountIdr })
        .from(payments)
        .where(
          and(eq(payments.folioId, folio.id), eq(payments.status, "VERIFIED")),
        );
      const verifiedTotal = remaining.reduce(
        (total, row) => total + Number(row.amountIdr),
        0,
      );
      if (
        reservation.source === "ONLINE" &&
        reservation.status === "CONFIRMED" &&
        verifiedTotal < Number(reservation.requiredPaymentIdr)
      ) {
        await tx
          .update(reservations)
          .set({
            status: "ON_HOLD",
            guaranteed: false,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(reservations.id, reservation.id));
        await tx.insert(reservationStatusEvents).values({
          reservationId: reservation.id,
          action: "REOPEN_PAYMENT_HOLD_AFTER_VOID",
          fromStatus: "CONFIRMED",
          toStatus: "ON_HOLD",
          actorUserId: params.session.user.id,
          reason,
          guardResult: {
            requiredPaymentIdr: reservation.requiredPaymentIdr,
            verifiedTotal,
          },
          createdByUserId: params.session.user.id,
        });
        await tx
          .update(inventoryClaims)
          .set({
            claimType: "PAYMENT_HOLD",
            expiresAt: reservation.paymentDeadlineAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(inventoryClaims.sourceType, "RESERVATION"),
              eq(inventoryClaims.sourceId, reservation.id),
              eq(inventoryClaims.claimStatus, "ACTIVE"),
              eq(inventoryClaims.claimType, "COMMITTED"),
            ),
          );
        await tx.execute(sql`
          update resource_claims
          set expires_at = ${reservation.paymentDeadlineAt}, updated_at = now(),
              version = version + 1
          where reservation_room_id in (
            select id from reservation_rooms where reservation_id = ${reservation.id}
          ) and claim_status = 'ACTIVE'
        `);
        if (
          reservation.paymentDeadlineAt &&
          reservation.paymentDeadlineAt > now
        ) {
          await enqueueOutboxEvent(
            {
              topic: "booking.reservation-expire",
              aggregateType: "reservation",
              aggregateId: reservation.id,
              payload: { reservationId: reservation.id },
              availableAt: reservation.paymentDeadlineAt,
            },
            tx,
          );
        } else {
          await expireReservationInTransaction(
            tx,
            reservation.id,
            params.session.user.id,
            "Verified payment voided after deadline",
          );
        }
      }
      await queuePaymentEmail(tx, {
        propertyId: params.propertyId,
        reservationId: reservation.id,
        recipient: reservation.bookerEmailNormalized,
        subject: `Payment update ${reservation.bookingCode}`,
        body: `Payment ${payment.paymentCode} for booking ${reservation.bookingCode} was voided. Please contact Front Office for the current balance.`,
        key: `payment:${payment.id}:voided`,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "payment.void",
          targetType: "payment",
          targetId: payment.id,
          before: { status: payment.status },
          after: { status: "VOIDED" },
          reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "payment",
        resultId: payment.id,
        response: { paymentId: payment.id, status: "VOIDED" },
      };
    },
  );
}

async function expireReservationInTransaction(
  tx: IdempotencyTransaction,
  reservationId: string,
  actorUserId: string | null,
  reason: string,
) {
  const now = new Date();
  await tx
    .update(reservations)
    .set({ status: "EXPIRED", updatedAt: now, updatedByUserId: actorUserId })
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.status, "ON_HOLD"),
      ),
    );
  await tx.insert(reservationStatusEvents).values({
    reservationId,
    action: "EXPIRE",
    fromStatus: "ON_HOLD",
    toStatus: "EXPIRED",
    actorUserId,
    reason,
    createdByUserId: actorUserId,
  });
  const claims = await tx
    .update(inventoryClaims)
    .set({
      claimStatus: "EXPIRED",
      releasedAt: now,
      updatedAt: now,
      updatedByUserId: actorUserId,
    })
    .where(
      and(
        eq(inventoryClaims.sourceType, "RESERVATION"),
        eq(inventoryClaims.sourceId, reservationId),
        eq(inventoryClaims.claimStatus, "ACTIVE"),
        eq(inventoryClaims.claimType, "PAYMENT_HOLD"),
      ),
    )
    .returning({ id: inventoryClaims.id });
  if (claims.length) {
    await tx.insert(inventoryClaimEvents).values(
      claims.map((claim) => ({
        inventoryClaimId: claim.id,
        action: "EXPIRE",
        fromStatus: "ACTIVE",
        toStatus: "EXPIRED",
        reason,
        createdByUserId: actorUserId,
      })),
    );
  }
  await tx.execute(sql`
    update resource_claims
    set claim_status = 'EXPIRED', released_at = ${now}, updated_at = ${now},
        version = version + 1
    where reservation_room_id in (
      select id from reservation_rooms where reservation_id = ${reservationId}
    ) and claim_status = 'ACTIVE'
  `);
}
