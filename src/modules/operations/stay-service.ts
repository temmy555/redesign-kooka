import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  checkinCaptureItems,
  checkinRegistrations,
  cleaningTasks,
  departureClearances,
  folios,
  folioStatusEvents,
  guestIdentityDetails,
  reservationGuests,
  reservationRooms,
  reservations,
  reservationStatusEvents,
  roomAssignmentNights,
  roomAssignments,
  roomStays,
  roomUnitNightClaims,
  roomUnitStates,
  stayStatusEvents,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { encryptSensitiveValue } from "../../platform/encryption";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import type { IdempotencyTransaction } from "../../platform/idempotency";
import { stableRequestHash } from "../booking/domain";
import type { StaffSessionLike, StayStatus } from "./contracts";
import { assertStayTransition, jakartaBusinessTimestamp } from "./contracts";

type StayAction =
  | "MARK_DUE_IN"
  | "CHECK_IN"
  | "MARK_DUE_OUT"
  | "CHECK_OUT"
  | "MARK_NO_SHOW"
  | "REOPEN_NO_SHOW"
  | "RELEASE_NO_SHOW";

const TO_STATUS: Record<Exclude<StayAction, "RELEASE_NO_SHOW">, StayStatus> = {
  MARK_DUE_IN: "DUE_IN",
  CHECK_IN: "IN_HOUSE",
  MARK_DUE_OUT: "DUE_OUT",
  CHECK_OUT: "CHECKED_OUT",
  MARK_NO_SHOW: "NO_SHOW",
  REOPEN_NO_SHOW: "DUE_IN",
};

async function releaseAssignmentInventory(
  tx: IdempotencyTransaction,
  assignmentId: string,
  releasedAt: Date,
) {
  const nights = await tx
    .select({
      id: roomAssignmentNights.id,
      claimId: roomAssignmentNights.roomUnitNightClaimId,
    })
    .from(roomAssignmentNights)
    .where(eq(roomAssignmentNights.roomAssignmentId, assignmentId));
  for (const night of nights) {
    await tx
      .update(roomAssignmentNights)
      .set({ releasedAt })
      .where(
        and(
          eq(roomAssignmentNights.id, night.id),
          isNull(roomAssignmentNights.releasedAt),
        ),
      );
    await tx
      .update(roomUnitNightClaims)
      .set({ claimStatus: "RELEASED", releasedAt })
      .where(
        and(
          eq(roomUnitNightClaims.id, night.claimId),
          eq(roomUnitNightClaims.claimStatus, "ACTIVE"),
        ),
      );
  }
}

export async function transitionStay(params: {
  propertyId: string;
  roomStayId: string;
  action: StayAction;
  reason: string;
  overrideReadiness?: boolean;
  departureOutcome?: "CLEARED" | "ISSUE_FOUND" | "SKIPPED";
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: `operations.stay.${params.action.toLowerCase()}`,
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [current] = await tx
        .select({
          status: roomStays.status,
          chargePrivilege: roomStays.chargePrivilege,
          reservationRoomId: roomStays.reservationRoomId,
          reservationId: reservationRooms.reservationId,
          reservationStatus: reservations.status,
        })
        .from(roomStays)
        .innerJoin(
          reservationRooms,
          eq(reservationRooms.id, roomStays.reservationRoomId),
        )
        .innerJoin(
          reservations,
          eq(reservations.id, reservationRooms.reservationId),
        )
        .where(
          and(
            eq(roomStays.id, params.roomStayId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update", { of: roomStays });
      if (!current) throw new AppError("NOT_FOUND", "Room stay not found");

      const [assignment] = await tx
        .select({
          id: roomAssignments.id,
          roomUnitId: roomAssignments.roomUnitId,
          effectiveFrom: roomAssignments.effectiveFrom,
          housekeepingStatus: roomUnitStates.housekeepingStatus,
          serviceabilityStatus: roomUnitStates.serviceabilityStatus,
        })
        .from(roomAssignments)
        .leftJoin(
          roomUnitStates,
          eq(roomUnitStates.roomUnitId, roomAssignments.roomUnitId),
        )
        .where(
          and(
            eq(roomAssignments.roomStayId, params.roomStayId),
            inArray(roomAssignments.status, ["PLANNED", "ACTIVE"]),
          ),
        )
        .limit(1)
        .for("update", { of: roomAssignments });

      if (params.action === "RELEASE_NO_SHOW") {
        if (current.status !== "NO_SHOW") {
          throw new AppError("CONFLICT", "Only a no-show stay can be released");
        }
        if (assignment) {
          const now = new Date();
          await releaseAssignmentInventory(tx, assignment.id, now);
          await tx
            .update(roomAssignments)
            .set({
              status: "RELEASED",
              effectiveTo: now,
              updatedByUserId: params.session.user.id,
            })
            .where(eq(roomAssignments.id, assignment.id));
        }
        await recordAuditEvent(
          {
            propertyId: params.propertyId,
            actorUserId: params.session.user.id,
            actorType: "user",
            action: "NO_SHOW_ROOM_RELEASED",
            targetType: "room_stay",
            targetId: params.roomStayId,
            reason: params.reason,
            result: "SUCCESS",
          },
          tx,
        );
        return {
          resultType: "room_stay",
          resultId: params.roomStayId,
          response: {
            roomStayId: params.roomStayId,
            status: "NO_SHOW",
            roomRetained: false,
          },
        };
      }

      const toStatus = TO_STATUS[params.action];
      assertStayTransition(current.status as StayStatus, toStatus);
      if (params.action === "CHECK_IN") {
        if (!assignment)
          throw new AppError(
            "CONFLICT",
            "Assign a physical room before check-in",
          );
        const ready =
          assignment.serviceabilityStatus === "IN_SERVICE" &&
          assignment.housekeepingStatus === "INSPECTED";
        if (!ready && !params.overrideReadiness) {
          throw new AppError(
            "CONFLICT",
            "Room must be in service and inspected before check-in",
          );
        }
        if (!ready && params.reason.trim().length < 5) {
          throw new AppError(
            "VALIDATION_ERROR",
            "A readiness override requires a reason",
          );
        }
      }

      let checkoutSettlement:
        | {
            folioId: string;
            folioStatus: string;
            balanceIdr: number;
          }
        | undefined;
      if (params.action === "CHECK_OUT") {
        const settlement = await tx.execute<{
          folioId: string;
          folioStatus: string;
          balanceIdr: string;
        }>(sql`
          select f.id as "folioId", f.status as "folioStatus",
            (select coalesce(sum(
                case when fe.entry_type = 'DEBIT'
                  then fe.total_amount_idr
                  else -fe.total_amount_idr
                end
              ), 0)::text
              from folio_entries fe
              where fe.folio_id = f.id
            ) as "balanceIdr"
          from folios f
          where f.reservation_id = ${current.reservationId}
          for update of f
        `);
        const folio = settlement.rows[0];
        if (!folio)
          throw new AppError(
            "CONFLICT",
            "Checkout tidak dapat diproses karena data tagihan booking tidak ditemukan",
          );
        const balanceIdr = Number(folio.balanceIdr);
        if (!Number.isFinite(balanceIdr))
          throw new AppError(
            "CONFLICT",
            "Checkout tidak dapat diproses karena sisa tagihan tidak valid",
          );
        if (Math.abs(balanceIdr) >= 0.5) {
          const amount = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          }).format(Math.abs(balanceIdr));
          throw new AppError(
            "CONFLICT",
            balanceIdr > 0
              ? `Checkout belum dapat diproses. Masih ada tagihan ${amount}. Lunasi tagihan terlebih dahulu.`
              : `Checkout belum dapat diproses. Terdapat kelebihan pembayaran ${amount}. Selesaikan refund atau penyesuaian tagihan terlebih dahulu.`,
          );
        }
        checkoutSettlement = {
          folioId: folio.folioId,
          folioStatus: folio.folioStatus,
          balanceIdr,
        };
      }

      const now = new Date();
      await tx
        .update(roomStays)
        .set({
          status: toStatus,
          actualCheckInAt: params.action === "CHECK_IN" ? now : undefined,
          actualCheckOutAt: params.action === "CHECK_OUT" ? now : undefined,
          chargePrivilege:
            params.action === "CHECK_IN"
              ? "ALLOWED"
              : params.action === "CHECK_OUT"
                ? "NOT_ALLOWED"
                : undefined,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomStays.id, params.roomStayId));
      await tx.insert(stayStatusEvents).values({
        roomStayId: params.roomStayId,
        action: params.action,
        fromStatus: current.status,
        toStatus,
        actorUserId: params.session.user.id,
        reason: params.reason,
        guardResult: {
          roomAssigned: Boolean(assignment),
          readinessOverride: Boolean(params.overrideReadiness),
          roomChargeAllowed: params.action === "CHECK_IN",
          guaranteedNoShowRoomRetained: params.action === "MARK_NO_SHOW",
          arrivalPolicy:
            params.action === "CHECK_IN" ? "FLEXIBLE_FRONT_OFFICE" : undefined,
          arrivalTimeCutoffEnforced:
            params.action === "CHECK_IN" ? false : undefined,
        },
      });

      if (assignment && params.action === "CHECK_IN") {
        await tx
          .update(roomAssignments)
          .set({
            status: "ACTIVE",
            effectiveFrom:
              assignment.effectiveFrom && assignment.effectiveFrom < now
                ? assignment.effectiveFrom
                : now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(roomAssignments.id, assignment.id));
        await tx
          .update(roomUnitStates)
          .set({
            occupancyStatus: "OCCUPIED",
            changedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(roomUnitStates.roomUnitId, assignment.roomUnitId));
      }

      if (params.action === "CHECK_OUT") {
        const outcome = params.departureOutcome ?? "SKIPPED";
        await tx
          .insert(departureClearances)
          .values({
            roomStayId: params.roomStayId,
            outcome,
            checkedByUserId: params.session.user.id,
            checkedAt: now,
            skipOrIssueReason: outcome === "CLEARED" ? null : params.reason,
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .onConflictDoUpdate({
            target: departureClearances.roomStayId,
            set: {
              outcome,
              checkedByUserId: params.session.user.id,
              checkedAt: now,
              skipOrIssueReason: outcome === "CLEARED" ? null : params.reason,
              updatedByUserId: params.session.user.id,
            },
          });
        if (assignment) {
          await tx.insert(cleaningTasks).values({
            propertyId: params.propertyId,
            roomUnitId: assignment.roomUnitId,
            roomStayId: params.roomStayId,
            taskType: "CHECKOUT",
            priority: "HIGH",
            status: "REQUESTED",
            requestedEntryPermission: "GRANTED",
            notes: "Automatically created at checkout",
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          });
          await tx
            .update(roomAssignments)
            .set({
              status: "RELEASED",
              effectiveTo: now,
              updatedByUserId: params.session.user.id,
            })
            .where(eq(roomAssignments.id, assignment.id));
          await tx
            .update(roomUnitStates)
            .set({
              occupancyStatus: "VACANT",
              housekeepingStatus: "DIRTY",
              changedAt: now,
              updatedByUserId: params.session.user.id,
            })
            .where(eq(roomUnitStates.roomUnitId, assignment.roomUnitId));
          await releaseAssignmentInventory(tx, assignment.id, now);
        }
        await tx
          .update(reservationRooms)
          .set({
            lineStatus: "COMPLETED",
            updatedByUserId: params.session.user.id,
          })
          .where(eq(reservationRooms.id, current.reservationRoomId));
        const remaining = await tx.execute<{ count: string }>(
          sql`select count(*)::text as count from reservation_rooms where reservation_id = ${current.reservationId} and line_status = 'ACTIVE' and id <> ${current.reservationRoomId}`,
        );
        if (Number(remaining.rows[0]?.count ?? 0) === 0) {
          if (checkoutSettlement && checkoutSettlement.folioStatus === "OPEN") {
            await tx
              .update(folios)
              .set({
                status: "CLOSED",
                closedAt: now,
                closedByUserId: params.session.user.id,
                updatedByUserId: params.session.user.id,
              })
              .where(eq(folios.id, checkoutSettlement.folioId));
            await tx.insert(folioStatusEvents).values({
              folioId: checkoutSettlement.folioId,
              action: "CLOSE_AT_FINAL_CHECKOUT",
              fromStatus: "OPEN",
              toStatus: "CLOSED",
              reason: params.reason,
              guardResult: { balanceIdr: checkoutSettlement.balanceIdr },
              actorUserId: params.session.user.id,
              createdByUserId: params.session.user.id,
            });
          }
          await tx
            .update(reservations)
            .set({
              status: "COMPLETED",
              completedAt: now,
              updatedByUserId: params.session.user.id,
            })
            .where(eq(reservations.id, current.reservationId));
          await tx.insert(reservationStatusEvents).values({
            reservationId: current.reservationId,
            action: "ALL_STAYS_CHECKED_OUT",
            fromStatus: current.reservationStatus,
            toStatus: "COMPLETED",
            actorUserId: params.session.user.id,
            reason: params.reason,
          });
        }
      }

      if (params.action === "MARK_NO_SHOW") {
        await tx
          .update(reservations)
          .set({ status: "NO_SHOW", updatedByUserId: params.session.user.id })
          .where(eq(reservations.id, current.reservationId));
        await tx.insert(reservationStatusEvents).values({
          reservationId: current.reservationId,
          action: "MARK_NO_SHOW",
          fromStatus: current.reservationStatus,
          toStatus: "NO_SHOW",
          actorUserId: params.session.user.id,
          reason: params.reason,
          guardResult: {
            inventoryReleased: false,
            guaranteedArrivalRetained: true,
          },
        });
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: `STAY_${params.action}`,
          targetType: "room_stay",
          targetId: params.roomStayId,
          before: {
            status: current.status,
            chargePrivilege: current.chargePrivilege,
          },
          after: {
            status: toStatus,
            chargePrivilege:
              params.action === "CHECK_IN"
                ? "ALLOWED"
                : current.chargePrivilege,
            arrivalPolicy:
              params.action === "CHECK_IN"
                ? "FLEXIBLE_FRONT_OFFICE"
                : undefined,
            arrivalTimeCutoffEnforced:
              params.action === "CHECK_IN" ? false : undefined,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_stay",
        resultId: params.roomStayId,
        response: {
          roomStayId: params.roomStayId,
          status: toStatus,
          roomRetained: params.action === "MARK_NO_SHOW",
        },
      };
    },
  );
}

async function resolveCheckinCaptureStay(
  tx: IdempotencyTransaction,
  params: {
    propertyId: string;
    roomStayId?: string;
    reservationRoomId?: string;
    actorUserId: string;
  },
): Promise<{ roomStayId: string; bookerGuestId: string | null }> {
  const target = params.roomStayId
    ? eq(roomStays.id, params.roomStayId)
    : params.reservationRoomId
      ? eq(reservationRooms.id, params.reservationRoomId)
      : null;
  if (!target)
    throw new AppError(
      "VALIDATION_ERROR",
      "A room stay or reservation room is required",
    );
  const [candidate] = await tx
    .select({
      roomStayId: roomStays.id,
      reservationRoomId: reservationRooms.id,
      reservationId: reservations.id,
      reservationStatus: reservations.status,
      checkInDate: reservationRooms.checkInDate,
      checkoutDate: reservationRooms.checkoutDate,
      bookerGuestId: reservationGuests.guestId,
    })
    .from(reservationRooms)
    .innerJoin(
      reservations,
      eq(reservations.id, reservationRooms.reservationId),
    )
    .leftJoin(roomStays, eq(roomStays.reservationRoomId, reservationRooms.id))
    .leftJoin(
      reservationGuests,
      and(
        eq(reservationGuests.reservationId, reservations.id),
        eq(reservationGuests.role, "BOOKER"),
      ),
    )
    .where(and(eq(reservations.propertyId, params.propertyId), target))
    .limit(1)
    .for("update", { of: reservationRooms });
  if (!candidate) throw new AppError("NOT_FOUND", "Reservation room not found");
  if (candidate.roomStayId)
    return {
      roomStayId: candidate.roomStayId,
      bookerGuestId: candidate.bookerGuestId,
    };
  if (!["CONFIRMED", "ON_HOLD"].includes(candidate.reservationStatus))
    throw new AppError(
      "CONFLICT",
      "Reservation room is not available for guest registration",
    );
  const [created] = await tx
    .insert(roomStays)
    .values({
      reservationRoomId: candidate.reservationRoomId,
      status: "DUE_IN",
      leadGuestId: candidate.bookerGuestId,
      plannedArrivalAt: jakartaBusinessTimestamp(
        candidate.checkInDate,
        "14:00",
      ),
      plannedDepartureAt: jakartaBusinessTimestamp(
        candidate.checkoutDate,
        "12:00",
      ),
      createdByUserId: params.actorUserId,
      updatedByUserId: params.actorUserId,
    })
    .onConflictDoNothing({ target: roomStays.reservationRoomId })
    .returning({ id: roomStays.id });
  if (created)
    return {
      roomStayId: created.id,
      bookerGuestId: candidate.bookerGuestId,
    };
  const [existing] = await tx
    .select({ roomStayId: roomStays.id })
    .from(roomStays)
    .where(eq(roomStays.reservationRoomId, candidate.reservationRoomId))
    .limit(1);
  if (!existing) throw new Error("Failed to create room stay");
  return {
    roomStayId: existing.roomStayId,
    bookerGuestId: candidate.bookerGuestId,
  };
}

export async function recordCheckinCapture(params: {
  propertyId: string;
  roomStayId?: string;
  reservationRoomId?: string;
  guestId?: string;
  captureType: "IDENTITY_DOCUMENT" | "GUEST_PHOTO" | "SIGNATURE";
  outcome: "CAPTURED" | "DECLINED" | "SKIPPED" | "FAILED";
  fileId?: string;
  reason?: string;
  identity?: {
    type: string;
    number: string;
    nameOnIdentity?: string;
    expiresOn?: string;
  };
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  if (params.outcome === "CAPTURED" && !params.fileId)
    throw new AppError(
      "VALIDATION_ERROR",
      "Captured items require a stored file",
    );
  return withIdempotency(
    {
      scope: "operations.checkin.capture",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({
        ...params,
        identity: params.identity
          ? { ...params.identity, number: "[redacted]" }
          : undefined,
      }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const stay = await resolveCheckinCaptureStay(tx, {
        propertyId: params.propertyId,
        roomStayId: params.roomStayId,
        reservationRoomId: params.reservationRoomId,
        actorUserId: params.session.user.id,
      });
      const captureGuestId = params.guestId ?? stay.bookerGuestId ?? undefined;
      const [registration] = await tx
        .insert(checkinRegistrations)
        .values({
          roomStayId: stay.roomStayId,
          status: params.outcome === "CAPTURED" ? "PARTIAL" : "SKIPPED",
          operatedByUserId: params.session.user.id,
          skippedAt:
            params.outcome === "SKIPPED" || params.outcome === "DECLINED"
              ? new Date()
              : null,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .onConflictDoUpdate({
          target: checkinRegistrations.roomStayId,
          set: {
            status: params.outcome === "CAPTURED" ? "PARTIAL" : "SKIPPED",
            operatedByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          },
        })
        .returning({ id: checkinRegistrations.id });
      if (!registration)
        throw new Error("Failed to create check-in registration");
      const [item] = await tx
        .insert(checkinCaptureItems)
        .values({
          registrationId: registration.id,
          guestId: captureGuestId,
          captureType: params.captureType,
          outcome: params.outcome,
          fileId: params.fileId,
          capturedAt: params.outcome === "CAPTURED" ? new Date() : null,
          declineOrSkipReason: params.reason,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .onConflictDoUpdate({
          target: [
            checkinCaptureItems.registrationId,
            checkinCaptureItems.guestId,
            checkinCaptureItems.captureType,
          ],
          set: {
            outcome: params.outcome,
            fileId: params.fileId,
            capturedAt: params.outcome === "CAPTURED" ? new Date() : null,
            declineOrSkipReason: params.reason,
            updatedByUserId: params.session.user.id,
          },
        })
        .returning({ id: checkinCaptureItems.id });
      if (!item) throw new Error("Failed to record check-in capture");
      if (params.identity && !captureGuestId)
        throw new AppError("CONFLICT", "Guest profile not found");
      if (params.identity && captureGuestId) {
        await tx
          .insert(guestIdentityDetails)
          .values({
            registrationId: registration.id,
            guestId: captureGuestId,
            identityType: params.identity.type,
            identityNumberCiphertext: encryptSensitiveValue(
              params.identity.number,
            ),
            identityNumberLast4: params.identity.number.slice(-4),
            nameOnIdentityCiphertext: params.identity.nameOnIdentity
              ? encryptSensitiveValue(params.identity.nameOnIdentity)
              : null,
            expiresOnCiphertext: params.identity.expiresOn
              ? encryptSensitiveValue(params.identity.expiresOn)
              : null,
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .onConflictDoUpdate({
            target: [
              guestIdentityDetails.registrationId,
              guestIdentityDetails.guestId,
            ],
            set: {
              identityType: params.identity.type,
              identityNumberCiphertext: encryptSensitiveValue(
                params.identity.number,
              ),
              identityNumberLast4: params.identity.number.slice(-4),
              updatedByUserId: params.session.user.id,
            },
          });
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "CHECKIN_CAPTURE_RECORDED",
          targetType: "checkin_capture_item",
          targetId: item.id,
          after: {
            captureType: params.captureType,
            outcome: params.outcome,
            hasFile: Boolean(params.fileId),
            identityLast4: params.identity?.number.slice(-4),
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "checkin_capture_item",
        resultId: item.id,
        response: {
          captureItemId: item.id,
          registrationId: registration.id,
          roomStayId: stay.roomStayId,
          outcome: params.outcome,
        },
      };
    },
  );
}

export async function decideStayTiming(params: {
  propertyId: string;
  roomStayId: string;
  decision: "APPROVE_EARLY_CHECKIN" | "APPROVE_LATE_CHECKOUT" | "DECLINE";
  approvedUntil?: Date;
  reason: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: "operations.stay.timing",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [stay] = await tx
        .select({ id: roomStays.id, status: roomStays.status })
        .from(roomStays)
        .innerJoin(
          reservationRooms,
          eq(reservationRooms.id, roomStays.reservationRoomId),
        )
        .innerJoin(
          reservations,
          eq(reservations.id, reservationRooms.reservationId),
        )
        .where(
          and(
            eq(roomStays.id, params.roomStayId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!stay) throw new AppError("NOT_FOUND", "Room stay not found");
      if (params.decision === "APPROVE_LATE_CHECKOUT" && !params.approvedUntil)
        throw new AppError(
          "VALIDATION_ERROR",
          "Late checkout approval requires approvedUntil",
        );
      await tx
        .update(roomStays)
        .set({
          earlyCheckInApprovedAt:
            params.decision === "APPROVE_EARLY_CHECKIN"
              ? new Date()
              : undefined,
          lateCheckoutApprovedUntil:
            params.decision === "APPROVE_LATE_CHECKOUT"
              ? params.approvedUntil
              : undefined,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomStays.id, params.roomStayId));
      await tx.insert(stayStatusEvents).values({
        roomStayId: params.roomStayId,
        action: params.decision,
        fromStatus: stay.status,
        toStatus: stay.status,
        actorUserId: params.session.user.id,
        reason: params.reason,
        guardResult: {
          approvedUntil: params.approvedUntil?.toISOString() ?? null,
        },
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: `STAY_TIMING_${params.decision}`,
          targetType: "room_stay",
          targetId: params.roomStayId,
          after: { approvedUntil: params.approvedUntil?.toISOString() ?? null },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_stay",
        resultId: params.roomStayId,
        response: { roomStayId: params.roomStayId, decision: params.decision },
      };
    },
  );
}
