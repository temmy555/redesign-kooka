import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  ratePlans,
  ratePlanVersions,
  roomUnitNightClaims,
  roomTypes,
  roomTypeVersions,
  roomUnits,
  roomUnitStates,
  roomUnitTypePeriods,
} from "../../db/schema";
import { requirePermission } from "../../platform/authorization";
import { resolveActivePaymentInstructions } from "../booking/payment-instructions";
import type { StaffSession } from "../configuration/contracts";

function firstVersionByMaster<T extends { masterId: string }>(
  rows: T[],
): Array<Omit<T, "masterId">> {
  const seen = new Set<string>();
  return rows.reduce<Array<Omit<T, "masterId">>>((result, row) => {
    const { masterId, ...value } = row;
    if (seen.has(masterId)) return result;
    seen.add(masterId);
    result.push(value);
    return result;
  }, []);
}

/** PostgreSQL DATE values may arrive as local-midnight Date objects. */
export function normalizeCatalogDate(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Read-only booking/stay catalogue for Front Office. This intentionally does
 * not reuse Admin master-data endpoints: Front Office needs selectable active
 * products and physical rooms, but must not receive configuration permissions.
 */
export async function getFrontOfficeCatalog(params: {
  session: StaffSession;
  propertyId: string;
}) {
  await requirePermission(params.session, params.propertyId, "booking.manage");
  const db = getDatabase();
  const [
    roomTypeRows,
    roomUnitRows,
    ratePlanRows,
    roomUnitClaimRows,
    paymentInstructionRows,
  ] = await Promise.all([
    db
      .select({
        masterId: roomTypes.id,
        roomTypeId: roomTypes.id,
        code: roomTypes.code,
        nameId: roomTypeVersions.nameId,
        nameEn: roomTypeVersions.nameEn,
        lifecycleStatus: roomTypeVersions.lifecycleStatus,
        approvalStatus: roomTypeVersions.approvalStatus,
        maximumAdults: roomTypeVersions.maximumAdults,
        maximumChildren: roomTypeVersions.maximumChildren,
        maximumTotalGuests: roomTypeVersions.maximumTotalGuests,
        extraBedAllowed: roomTypeVersions.extraBedAllowed,
        maximumExtraBeds: roomTypeVersions.maximumExtraBeds,
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
          inArray(roomTypeVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          inArray(roomTypeVersions.approvalStatus, [
            "APPROVED",
            "NOT_REQUIRED",
          ]),
        ),
      )
      .orderBy(roomTypes.code, desc(roomTypeVersions.versionNumber)),
    db
      .select({
        id: roomUnits.id,
        roomNumber: roomUnits.roomNumber,
        status: roomUnits.status,
        roomTypeId: roomUnitTypePeriods.roomTypeId,
        occupancyStatus: roomUnitStates.occupancyStatus,
        housekeepingStatus: roomUnitStates.housekeepingStatus,
        serviceabilityStatus: roomUnitStates.serviceabilityStatus,
      })
      .from(roomUnits)
      .leftJoin(roomUnitStates, eq(roomUnitStates.roomUnitId, roomUnits.id))
      .leftJoin(
        roomUnitTypePeriods,
        and(
          eq(roomUnitTypePeriods.roomUnitId, roomUnits.id),
          isNull(roomUnitTypePeriods.effectiveTo),
        ),
      )
      .where(eq(roomUnits.propertyId, params.propertyId))
      .orderBy(roomUnits.sortOrder, roomUnits.roomNumber),
    db
      .select({
        masterId: ratePlans.id,
        ratePlanId: ratePlans.id,
        code: ratePlans.code,
        nameId: ratePlanVersions.nameId,
        nameEn: ratePlanVersions.nameEn,
        lifecycleStatus: ratePlanVersions.lifecycleStatus,
        approvalStatus: ratePlanVersions.approvalStatus,
        sourceEligibility: ratePlanVersions.sourceEligibility,
      })
      .from(ratePlans)
      .innerJoin(
        ratePlanVersions,
        eq(ratePlanVersions.ratePlanId, ratePlans.id),
      )
      .where(
        and(
          eq(ratePlans.propertyId, params.propertyId),
          eq(ratePlans.status, "ACTIVE"),
          inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          inArray(ratePlanVersions.approvalStatus, [
            "APPROVED",
            "NOT_REQUIRED",
          ]),
          inArray(ratePlanVersions.sourceEligibility, ["ALL", "ADMIN_MANUAL"]),
        ),
      )
      .orderBy(ratePlans.code, desc(ratePlanVersions.versionNumber)),
    db
      .select({
        roomUnitId: roomUnitNightClaims.roomUnitId,
        stayDate: roomUnitNightClaims.stayDate,
      })
      .from(roomUnitNightClaims)
      .innerJoin(roomUnits, eq(roomUnits.id, roomUnitNightClaims.roomUnitId))
      .where(
        and(
          eq(roomUnits.propertyId, params.propertyId),
          eq(roomUnitNightClaims.claimStatus, "ACTIVE"),
        ),
      )
      .orderBy(roomUnitNightClaims.roomUnitId, roomUnitNightClaims.stayDate),
    resolveActivePaymentInstructions(db, params.propertyId),
  ]);

  const unavailableDatesByRoom = new Map<string, string[]>();
  for (const claim of roomUnitClaimRows) {
    const dates = unavailableDatesByRoom.get(claim.roomUnitId) ?? [];
    dates.push(normalizeCatalogDate(claim.stayDate));
    unavailableDatesByRoom.set(claim.roomUnitId, dates);
  }

  return {
    roomTypes: firstVersionByMaster(roomTypeRows),
    roomUnits: roomUnitRows.map((room) => ({
      ...room,
      unavailableDates: unavailableDatesByRoom.get(room.id) ?? [],
    })),
    ratePlans: firstVersionByMaster(ratePlanRows),
    paymentInstructions: paymentInstructionRows.map((instruction) => ({
      paymentInstructionVersionId: instruction.id,
      bankName: instruction.bankName,
      accountHolder: instruction.accountHolder,
      accountNumberLast4: instruction.accountNumberLast4,
    })),
  };
}
