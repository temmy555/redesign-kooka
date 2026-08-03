import "server-only";

import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  cleaningTasks,
  folioEntries,
  folios,
  reservationRooms,
  reservations,
  roomAssignmentNights,
  roomAssignments,
  roomBlockNights,
  roomBlocks,
  roomMoves,
  roomMoveEvents,
  roomStays,
  roomUnitNightClaims,
  roomUnits,
  roomUnitStates,
  roomUnitTypePeriods,
} from "../../db/schema";
import { getDatabase } from "../../db";
import { recordAuditEvent } from "../../platform/audit";
import { hasPermission, requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import type { IdempotencyTransaction } from "../../platform/idempotency";
import { enumerateStayDates, stableRequestHash } from "../booking/domain";
import type { StaffSessionLike } from "./contracts";
import { jakartaBusinessTimestamp, maskGuestName } from "./contracts";

export async function getRoomBoard(params: {
  propertyId: string;
  session: StaffSessionLike;
  sharedDisplay: boolean;
  asOf?: Date;
}) {
  const canViewGuestDetails = await hasPermission(
    params.session.user.id,
    params.propertyId,
    "stay.manage",
  );
  await requirePermission(
    params.session,
    params.propertyId,
    canViewGuestDetails ? "stay.manage" : "room.board.view",
  );
  const db = getDatabase();
  const at = params.asOf ?? new Date();
  const sharedDisplay = params.sharedDisplay || !canViewGuestDetails;
  const result = await db.execute<{
    roomUnitId: string;
    roomNumber: string;
    roomTypeId: string | null;
    occupancyStatus: string;
    housekeepingStatus: string;
    serviceabilityStatus: string;
    assignmentId: string | null;
    roomStayId: string | null;
    stayStatus: string | null;
    bookingCode: string | null;
    guestName: string | null;
    nextArrivalAt: Date | null;
    updatedAt: Date;
  }>(sql`
    select
      u.id as "roomUnitId", u.room_number as "roomNumber",
      tp.room_type_id as "roomTypeId",
      coalesce(s.occupancy_status, 'VACANT') as "occupancyStatus",
      coalesce(s.housekeeping_status, 'DIRTY') as "housekeepingStatus",
      coalesce(s.serviceability_status, 'IN_SERVICE') as "serviceabilityStatus",
      current_assignment.id as "assignmentId",
      current_assignment.room_stay_id as "roomStayId",
      current_assignment.stay_status as "stayStatus",
      current_assignment.booking_code as "bookingCode",
      current_assignment.guest_name as "guestName",
      next_arrival.planned_arrival_at as "nextArrivalAt",
      greatest(u.updated_at, coalesce(s.changed_at, u.updated_at)) as "updatedAt"
    from room_units u
    left join room_unit_states s on s.room_unit_id = u.id
    left join lateral (
      select p.room_type_id
      from room_unit_type_periods p
      where p.room_unit_id = u.id
        and p.effective_from <= ${at}
        and (p.effective_to is null or p.effective_to > ${at})
      order by p.effective_from desc limit 1
    ) tp on true
    left join lateral (
      select a.id, a.room_stay_id, st.status as stay_status,
             r.booking_code, g.full_name as guest_name
      from room_assignments a
      join room_stays st on st.id = a.room_stay_id
      join reservation_rooms rr on rr.id = st.reservation_room_id
      join reservations r on r.id = rr.reservation_id
      left join guests g on g.id = st.lead_guest_id
      where a.room_unit_id = u.id
        and a.status in ('PLANNED', 'ACTIVE')
        and a.effective_from <= ${at}
        and (a.effective_to is null or a.effective_to > ${at})
      order by a.effective_from desc limit 1
    ) current_assignment on true
    left join lateral (
      select st.planned_arrival_at
      from room_assignments a
      join room_stays st on st.id = a.room_stay_id
      where a.room_unit_id = u.id and a.status in ('PLANNED', 'ACTIVE')
        and st.planned_arrival_at > ${at}
      order by st.planned_arrival_at asc limit 1
    ) next_arrival on true
    where u.property_id = ${params.propertyId} and u.status = 'ACTIVE'
    order by u.sort_order, u.room_number
  `);

  return {
    generatedAt: at.toISOString(),
    staleAfterSeconds: 60,
    sharedDisplay,
    rooms: result.rows.map((room) => ({
      ...room,
      guestName: sharedDisplay ? maskGuestName(room.guestName) : room.guestName,
      bookingCode: sharedDisplay
        ? (room.bookingCode?.slice(-4) ?? null)
        : room.bookingCode,
    })),
  };
}

async function ensureStay(
  tx: IdempotencyTransaction,
  reservationRoomId: string,
  actorUserId: string,
) {
  const [line] = await tx
    .select({
      id: reservationRooms.id,
      checkInDate: reservationRooms.checkInDate,
      checkoutDate: reservationRooms.checkoutDate,
      reservationId: reservationRooms.reservationId,
      status: reservations.status,
    })
    .from(reservationRooms)
    .innerJoin(
      reservations,
      eq(reservations.id, reservationRooms.reservationId),
    )
    .where(eq(reservationRooms.id, reservationRoomId))
    .limit(1)
    .for("update");
  if (!line || !["CONFIRMED", "ON_HOLD"].includes(line.status)) {
    throw new AppError("CONFLICT", "Reservation room is not assignable");
  }
  const [existing] = await tx
    .select()
    .from(roomStays)
    .where(eq(roomStays.reservationRoomId, reservationRoomId))
    .limit(1);
  if (existing) return { stay: existing, line };
  const [stay] = await tx
    .insert(roomStays)
    .values({
      reservationRoomId,
      status: "DUE_IN",
      plannedArrivalAt: jakartaBusinessTimestamp(line.checkInDate, "14:00"),
      plannedDepartureAt: jakartaBusinessTimestamp(line.checkoutDate, "12:00"),
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    })
    .returning();
  if (!stay) throw new Error("Failed to create room stay");
  return { stay, line };
}

export async function assignRoom(params: {
  propertyId: string;
  reservationRoomId: string;
  roomUnitId: string;
  reason: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: "operations.room.assign",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const { stay, line } = await ensureStay(
        tx,
        params.reservationRoomId,
        params.session.user.id,
      );
      const [unit] = await tx
        .select({
          id: roomUnits.id,
          serviceability: roomUnitStates.serviceabilityStatus,
        })
        .from(roomUnits)
        .leftJoin(roomUnitStates, eq(roomUnitStates.roomUnitId, roomUnits.id))
        .where(
          and(
            eq(roomUnits.id, params.roomUnitId),
            eq(roomUnits.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update", { of: roomUnits });
      if (
        !unit ||
        (unit.serviceability && unit.serviceability !== "IN_SERVICE")
      ) {
        throw new AppError("CONFLICT", "Room unit is not in service");
      }
      const [period] = await tx
        .select({ roomTypeId: roomUnitTypePeriods.roomTypeId })
        .from(roomUnitTypePeriods)
        .where(
          and(
            eq(roomUnitTypePeriods.roomUnitId, params.roomUnitId),
            lt(
              roomUnitTypePeriods.effectiveFrom,
              jakartaBusinessTimestamp(line.checkoutDate, "12:00"),
            ),
            or(
              isNull(roomUnitTypePeriods.effectiveTo),
              gte(
                roomUnitTypePeriods.effectiveTo,
                jakartaBusinessTimestamp(line.checkInDate, "14:00"),
              ),
            ),
          ),
        )
        .orderBy(asc(roomUnitTypePeriods.effectiveFrom))
        .limit(1);
      const [roomLine] = await tx
        .select({ roomTypeId: reservationRooms.fulfilledRoomTypeId })
        .from(reservationRooms)
        .where(eq(reservationRooms.id, line.id))
        .limit(1);
      if (!period || !roomLine || period.roomTypeId !== roomLine.roomTypeId) {
        throw new AppError(
          "CONFLICT",
          "Physical room type does not match the booked room type",
        );
      }
      const [active] = await tx
        .select({ id: roomAssignments.id })
        .from(roomAssignments)
        .where(
          and(
            eq(roomAssignments.roomStayId, stay.id),
            or(
              eq(roomAssignments.status, "PLANNED"),
              eq(roomAssignments.status, "ACTIVE"),
            ),
          ),
        )
        .limit(1);
      if (active)
        throw new AppError(
          "CONFLICT",
          "Stay already has an active room assignment",
        );

      const stayDates = enumerateStayDates(line.checkInDate, line.checkoutDate);
      const [conflictingClaim] = await tx
        .select({ id: roomUnitNightClaims.id })
        .from(roomUnitNightClaims)
        .where(
          and(
            eq(roomUnitNightClaims.roomUnitId, params.roomUnitId),
            inArray(roomUnitNightClaims.stayDate, stayDates),
            eq(roomUnitNightClaims.claimStatus, "ACTIVE"),
          ),
        )
        .limit(1);
      if (conflictingClaim)
        throw new AppError(
          "CONFLICT",
          "Room is not available for the complete stay period",
        );

      const [assignment] = await tx
        .insert(roomAssignments)
        .values({
          roomStayId: stay.id,
          roomUnitId: params.roomUnitId,
          effectiveFrom: stay.plannedArrivalAt ?? new Date(),
          effectiveTo: stay.plannedDepartureAt,
          status: "PLANNED",
          assignedByUserId: params.session.user.id,
          reason: params.reason,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: roomAssignments.id });
      if (!assignment) throw new Error("Failed to create room assignment");
      for (const stayDate of stayDates) {
        const [claim] = await tx
          .insert(roomUnitNightClaims)
          .values({
            roomUnitId: params.roomUnitId,
            stayDate,
            claimType: "ASSIGNMENT",
            sourceId: assignment.id,
          })
          .returning({ id: roomUnitNightClaims.id });
        if (!claim) throw new Error("Failed to claim physical room-night");
        await tx.insert(roomAssignmentNights).values({
          roomAssignmentId: assignment.id,
          roomUnitNightClaimId: claim.id,
          roomUnitId: params.roomUnitId,
          stayDate,
        });
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "ROOM_ASSIGNED",
          targetType: "room_assignment",
          targetId: assignment.id,
          after: {
            reservationRoomId: params.reservationRoomId,
            roomUnitId: params.roomUnitId,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_assignment",
        resultId: assignment.id,
        response: {
          assignmentId: assignment.id,
          roomStayId: stay.id,
          status: "PLANNED",
        },
      };
    },
  );
}

export async function blockRoom(params: {
  propertyId: string;
  roomUnitId: string;
  blockType: "MAINTENANCE" | "OUT_OF_ORDER" | "OWNER" | "OTHER";
  startsOn: string;
  endsOn: string;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: "operations.room.block",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const dates = enumerateStayDates(params.startsOn, params.endsOn, 365);
      const [unit] = await tx
        .select({ id: roomUnits.id })
        .from(roomUnits)
        .where(
          and(
            eq(roomUnits.id, params.roomUnitId),
            eq(roomUnits.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update", { of: roomUnits });
      if (!unit) throw new AppError("NOT_FOUND", "Room unit not found");
      const [block] = await tx
        .insert(roomBlocks)
        .values({
          roomUnitId: params.roomUnitId,
          blockType: params.blockType,
          status: "ACTIVE",
          startsAt: jakartaBusinessTimestamp(params.startsOn, "00:00"),
          endsAt: jakartaBusinessTimestamp(params.endsOn, "00:00"),
          reason: params.reason,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: roomBlocks.id });
      if (!block) throw new Error("Failed to create room block");
      for (const stayDate of dates) {
        const [claim] = await tx
          .insert(roomUnitNightClaims)
          .values({
            roomUnitId: params.roomUnitId,
            stayDate,
            claimType: "BLOCK",
            sourceId: block.id,
          })
          .returning({ id: roomUnitNightClaims.id });
        if (!claim) throw new Error("Failed to claim blocked room-night");
        await tx.insert(roomBlockNights).values({
          roomBlockId: block.id,
          roomUnitNightClaimId: claim.id,
          roomUnitId: params.roomUnitId,
          stayDate,
        });
      }
      await tx
        .insert(roomUnitStates)
        .values({
          roomUnitId: params.roomUnitId,
          occupancyStatus: "VACANT",
          housekeepingStatus: "DIRTY",
          serviceabilityStatus:
            params.blockType === "OUT_OF_ORDER" ? "OUT_OF_ORDER" : "BLOCKED",
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .onConflictDoUpdate({
          target: roomUnitStates.roomUnitId,
          set: {
            serviceabilityStatus:
              params.blockType === "OUT_OF_ORDER" ? "OUT_OF_ORDER" : "BLOCKED",
            changedAt: new Date(),
            updatedByUserId: params.session.user.id,
          },
        });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "ROOM_BLOCKED",
          targetType: "room_block",
          targetId: block.id,
          after: {
            roomUnitId: params.roomUnitId,
            dates,
            blockType: params.blockType,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_block",
        resultId: block.id,
        response: {
          roomBlockId: block.id,
          status: "ACTIVE",
          nights: dates.length,
        },
      };
    },
  );
}

export async function moveRoom(params: {
  propertyId: string;
  roomStayId: string;
  toRoomUnitId: string;
  effectiveOn: string;
  reason: string;
  priceTreatment: "NO_CHANGE" | "CHARGE" | "CREDIT";
  priceAdjustmentIdr: number;
  incidentalNoCharge: boolean;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: "operations.room.move",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [current] = await tx
        .select({
          assignmentId: roomAssignments.id,
          fromUnitId: roomAssignments.roomUnitId,
          reservationRoomId: roomStays.reservationRoomId,
          status: roomStays.status,
          effectiveFrom: roomAssignments.effectiveFrom,
          checkoutDate: reservationRooms.checkoutDate,
          reservationId: reservationRooms.reservationId,
          roomTypeId: reservationRooms.fulfilledRoomTypeId,
        })
        .from(roomAssignments)
        .innerJoin(roomStays, eq(roomStays.id, roomAssignments.roomStayId))
        .innerJoin(
          reservationRooms,
          eq(reservationRooms.id, roomStays.reservationRoomId),
        )
        .where(
          and(
            eq(roomAssignments.roomStayId, params.roomStayId),
            or(
              eq(roomAssignments.status, "PLANNED"),
              eq(roomAssignments.status, "ACTIVE"),
            ),
          ),
        )
        .limit(1)
        .for("update");
      if (
        !current ||
        !["DUE_IN", "IN_HOUSE", "DUE_OUT"].includes(current.status)
      )
        throw new AppError("CONFLICT", "Stay cannot be moved");
      if (current.fromUnitId === params.toRoomUnitId)
        throw new AppError(
          "VALIDATION_ERROR",
          "Destination must be a different room",
        );
      const [destination] = await tx
        .select({
          id: roomUnits.id,
          serviceability: roomUnitStates.serviceabilityStatus,
        })
        .from(roomUnits)
        .leftJoin(roomUnitStates, eq(roomUnitStates.roomUnitId, roomUnits.id))
        .where(
          and(
            eq(roomUnits.id, params.toRoomUnitId),
            eq(roomUnits.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update", { of: roomUnits });
      if (
        !destination ||
        (destination.serviceability &&
          destination.serviceability !== "IN_SERVICE")
      )
        throw new AppError("CONFLICT", "Destination room is not in service");
      const [period] = await tx
        .select({ roomTypeId: roomUnitTypePeriods.roomTypeId })
        .from(roomUnitTypePeriods)
        .where(
          and(
            eq(roomUnitTypePeriods.roomUnitId, params.toRoomUnitId),
            lte(
              roomUnitTypePeriods.effectiveFrom,
              jakartaBusinessTimestamp(params.effectiveOn, "12:00"),
            ),
            or(
              isNull(roomUnitTypePeriods.effectiveTo),
              gte(
                roomUnitTypePeriods.effectiveTo,
                jakartaBusinessTimestamp(current.checkoutDate, "12:00"),
              ),
            ),
          ),
        )
        .limit(1);
      if (!period || period.roomTypeId !== current.roomTypeId)
        throw new AppError(
          "CONFLICT",
          "Destination room type is incompatible; change fulfilled type explicitly for an upgrade",
        );
      const moveDates = enumerateStayDates(
        params.effectiveOn,
        current.checkoutDate,
      );
      if (moveDates.length === 0)
        throw new AppError(
          "CONFLICT",
          "Room cannot be moved because there are no remaining stay nights",
        );
      const [conflictingClaim] = await tx
        .select({ id: roomUnitNightClaims.id })
        .from(roomUnitNightClaims)
        .where(
          and(
            eq(roomUnitNightClaims.roomUnitId, params.toRoomUnitId),
            inArray(roomUnitNightClaims.stayDate, moveDates),
            eq(roomUnitNightClaims.claimStatus, "ACTIVE"),
          ),
        )
        .limit(1);
      if (conflictingClaim)
        throw new AppError(
          "CONFLICT",
          "Destination room is not available for the remaining stay period",
        );
      const requestedEffectiveAt = jakartaBusinessTimestamp(
        params.effectiveOn,
        "12:00",
      );
      const effectiveAt =
        current.status === "DUE_IN" &&
        requestedEffectiveAt < current.effectiveFrom
          ? current.effectiveFrom
          : requestedEffectiveAt;
      const [toAssignment] = await tx
        .insert(roomAssignments)
        .values({
          roomStayId: params.roomStayId,
          roomUnitId: params.toRoomUnitId,
          effectiveFrom: effectiveAt,
          effectiveTo: jakartaBusinessTimestamp(current.checkoutDate, "12:00"),
          status: current.status === "IN_HOUSE" ? "ACTIVE" : "PLANNED",
          assignedByUserId: params.session.user.id,
          reason: params.reason,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: roomAssignments.id });
      if (!toAssignment)
        throw new Error("Failed to create destination assignment");
      for (const stayDate of moveDates) {
        const [claim] = await tx
          .insert(roomUnitNightClaims)
          .values({
            roomUnitId: params.toRoomUnitId,
            stayDate,
            claimType: "ASSIGNMENT",
            sourceId: toAssignment.id,
          })
          .returning({ id: roomUnitNightClaims.id });
        if (!claim) throw new Error("Failed to claim destination room-night");
        await tx.insert(roomAssignmentNights).values({
          roomAssignmentId: toAssignment.id,
          roomUnitNightClaimId: claim.id,
          roomUnitId: params.toRoomUnitId,
          stayDate,
        });
      }
      const oldNights = await tx
        .select({
          id: roomAssignmentNights.id,
          claimId: roomAssignmentNights.roomUnitNightClaimId,
        })
        .from(roomAssignmentNights)
        .where(
          and(
            eq(roomAssignmentNights.roomAssignmentId, current.assignmentId),
            gte(roomAssignmentNights.stayDate, params.effectiveOn),
            isNull(roomAssignmentNights.releasedAt),
          ),
        );
      const now = new Date();
      for (const night of oldNights) {
        await tx
          .update(roomAssignmentNights)
          .set({ releasedAt: now })
          .where(eq(roomAssignmentNights.id, night.id));
        await tx
          .update(roomUnitNightClaims)
          .set({ claimStatus: "RELEASED", releasedAt: now })
          .where(eq(roomUnitNightClaims.id, night.claimId));
      }
      await tx
        .update(roomAssignments)
        .set({
          status: "RELEASED",
          ...(current.status === "DUE_IN" ? {} : { effectiveTo: effectiveAt }),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomAssignments.id, current.assignmentId));
      const [move] = await tx
        .insert(roomMoves)
        .values({
          roomStayId: params.roomStayId,
          fromAssignmentId: current.assignmentId,
          toAssignmentId: toAssignment.id,
          status: "APPLIED",
          effectiveAt,
          reason: params.reason,
          priceTreatment: params.priceTreatment,
          priceAdjustmentIdr: String(params.priceAdjustmentIdr),
          incidentalNoCharge: params.incidentalNoCharge,
          requestedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: roomMoves.id });
      if (!move) throw new Error("Failed to record room move");
      await tx.insert(roomMoveEvents).values({
        roomMoveId: move.id,
        action: "APPLY",
        fromStatus: "PREPARED",
        toStatus: "APPLIED",
        reason: params.reason,
      });
      if (current.status !== "DUE_IN") {
        await tx.insert(cleaningTasks).values({
          propertyId: params.propertyId,
          roomUnitId: current.fromUnitId,
          roomStayId: params.roomStayId,
          roomMoveId: move.id,
          taskType: "ROOM_MOVE",
          priority: "HIGH",
          status: "REQUESTED",
          requestedEntryPermission: "GRANTED",
          notes: "Automatic cleaning task for vacated room after room move",
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        });
        await tx
          .insert(roomUnitStates)
          .values({
            roomUnitId: current.fromUnitId,
            occupancyStatus: "VACANT",
            housekeepingStatus: "DIRTY",
            serviceabilityStatus: "IN_SERVICE",
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .onConflictDoUpdate({
            target: roomUnitStates.roomUnitId,
            set: {
              occupancyStatus: "VACANT",
              housekeepingStatus: "DIRTY",
              changedAt: now,
              updatedByUserId: params.session.user.id,
            },
          });
      }
      await tx
        .insert(roomUnitStates)
        .values({
          roomUnitId: params.toRoomUnitId,
          occupancyStatus:
            current.status === "IN_HOUSE" ? "OCCUPIED" : "VACANT",
          housekeepingStatus: "INSPECTED",
          serviceabilityStatus: "IN_SERVICE",
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .onConflictDoUpdate({
          target: roomUnitStates.roomUnitId,
          set: {
            occupancyStatus:
              current.status === "IN_HOUSE" ? "OCCUPIED" : "VACANT",
            changedAt: now,
            updatedByUserId: params.session.user.id,
          },
        });
      if (
        params.priceTreatment !== "NO_CHANGE" &&
        params.priceAdjustmentIdr > 0
      ) {
        const [folio] = await tx
          .select({ id: folios.id })
          .from(folios)
          .where(eq(folios.reservationId, current.reservationId))
          .limit(1);
        if (!folio)
          throw new AppError("CONFLICT", "Reservation folio is missing");
        await tx.insert(folioEntries).values({
          folioId: folio.id,
          entryType: params.priceTreatment === "CHARGE" ? "DEBIT" : "CREDIT",
          category: "ROOM_MOVE_ADJUSTMENT",
          description: params.reason,
          sourceType: "ROOM_MOVE",
          sourceId: move.id,
          reservationRoomId: current.reservationRoomId,
          roomUnitId: params.toRoomUnitId,
          serviceDate: params.effectiveOn,
          quantity: "1",
          unitAmountIdr: String(params.priceAdjustmentIdr),
          netAmountIdr: String(params.priceAdjustmentIdr),
          totalAmountIdr: String(params.priceAdjustmentIdr),
          pricingSnapshot: {
            priceTreatment: params.priceTreatment,
            incidentalNoCharge: params.incidentalNoCharge,
          },
          postedByUserId: params.session.user.id,
          idempotencyKey: `${params.idempotencyKey}:folio`,
        });
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "ROOM_MOVED",
          targetType: "room_move",
          targetId: move.id,
          before: { roomUnitId: current.fromUnitId },
          after: {
            roomUnitId: params.toRoomUnitId,
            priceTreatment: params.priceTreatment,
            priceAdjustmentIdr: params.priceAdjustmentIdr,
            incidentalNoCharge: params.incidentalNoCharge,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_move",
        resultId: move.id,
        response: {
          roomMoveId: move.id,
          toAssignmentId: toAssignment.id,
          status: "APPLIED",
        },
      };
    },
  );
}
