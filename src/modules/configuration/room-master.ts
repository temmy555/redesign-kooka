import "server-only";

import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  amenities,
  amenityTranslations,
  reservations,
  reservationRooms,
  resourcePools,
  roomTypeAmenities,
  roomTypes,
  roomTypeVersions,
  roomUnitNightClaims,
  roomUnits,
  roomUnitStates,
  roomUnitTypePeriods,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import type {
  ImpactPreview,
  MutationResult,
  ReviewDecision,
  StaffSession,
} from "./contracts";
import {
  assertEffectivePeriod,
  lifecycleForPublish,
  nextVersionNumber,
  normalizeMasterCode,
  requirePublishable,
} from "./versioning";

function reasonValue(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A reason between 3 and 500 characters is required",
    );
  }
  return value;
}

export async function getRoomMasterOverview(params: {
  session: StaffSession;
  propertyId: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.view",
  );
  const db = getDatabase();
  const [amenityRows, typeRows, unitRows, resourceRows] = await Promise.all([
    db
      .select({
        id: amenities.id,
        code: amenities.code,
        iconKey: amenities.iconKey,
        status: amenities.status,
        locale: amenityTranslations.locale,
        name: amenityTranslations.name,
        description: amenityTranslations.description,
      })
      .from(amenities)
      .leftJoin(
        amenityTranslations,
        eq(amenityTranslations.amenityId, amenities.id),
      )
      .where(eq(amenities.propertyId, params.propertyId))
      .orderBy(amenities.code, amenityTranslations.locale),
    db
      .select({
        roomTypeId: roomTypes.id,
        code: roomTypes.code,
        status: roomTypes.status,
        versionId: roomTypeVersions.id,
        versionNumber: roomTypeVersions.versionNumber,
        lifecycleStatus: roomTypeVersions.lifecycleStatus,
        approvalStatus: roomTypeVersions.approvalStatus,
        nameId: roomTypeVersions.nameId,
        nameEn: roomTypeVersions.nameEn,
        descriptionId: roomTypeVersions.descriptionId,
        descriptionEn: roomTypeVersions.descriptionEn,
        bedConfiguration: roomTypeVersions.bedConfiguration,
        standardAdults: roomTypeVersions.standardAdults,
        maximumAdults: roomTypeVersions.maximumAdults,
        maximumChildren: roomTypeVersions.maximumChildren,
        maximumTotalGuests: roomTypeVersions.maximumTotalGuests,
        extraBedAllowed: roomTypeVersions.extraBedAllowed,
        maximumExtraBeds: roomTypeVersions.maximumExtraBeds,
        extraBedCapacityIncrement: roomTypeVersions.extraBedCapacityIncrement,
        amenityIds: sql<string[]>`coalesce(
          (select array_agg(${roomTypeAmenities.amenityId})
           from ${roomTypeAmenities}
           where ${roomTypeAmenities.roomTypeVersionId} = ${roomTypeVersions.id}),
          array[]::uuid[]
        )`,
        effectiveFrom: roomTypeVersions.effectiveFrom,
        effectiveTo: roomTypeVersions.effectiveTo,
      })
      .from(roomTypes)
      .leftJoin(roomTypeVersions, eq(roomTypeVersions.roomTypeId, roomTypes.id))
      .where(eq(roomTypes.propertyId, params.propertyId))
      .orderBy(roomTypes.code, desc(roomTypeVersions.versionNumber)),
    db
      .select({
        id: roomUnits.id,
        roomNumber: roomUnits.roomNumber,
        sortOrder: roomUnits.sortOrder,
        floorOrArea: roomUnits.floorOrArea,
        status: roomUnits.status,
        roomTypeId: sql<string | null>`(
          select ${roomUnitTypePeriods.roomTypeId}
            from ${roomUnitTypePeriods}
           where ${roomUnitTypePeriods.roomUnitId} = ${roomUnits.id}
             and ${roomUnitTypePeriods.effectiveFrom} <= now()
             and (${roomUnitTypePeriods.effectiveTo} is null or ${roomUnitTypePeriods.effectiveTo} > now())
           order by ${roomUnitTypePeriods.effectiveFrom} desc
           limit 1
        )`,
        roomTypeName: sql<string | null>`(
          select ${roomTypeVersions.nameId}
            from ${roomUnitTypePeriods}
            join ${roomTypeVersions}
              on ${roomTypeVersions.roomTypeId} = ${roomUnitTypePeriods.roomTypeId}
             and ${roomTypeVersions.lifecycleStatus} = 'ACTIVE'
             and ${roomTypeVersions.effectiveFrom} <= now()
             and (${roomTypeVersions.effectiveTo} is null or ${roomTypeVersions.effectiveTo} > now())
           where ${roomUnitTypePeriods.roomUnitId} = ${roomUnits.id}
             and ${roomUnitTypePeriods.effectiveFrom} <= now()
             and (${roomUnitTypePeriods.effectiveTo} is null or ${roomUnitTypePeriods.effectiveTo} > now())
           order by ${roomTypeVersions.versionNumber} desc
           limit 1
        )`,
        occupancyStatus: roomUnitStates.occupancyStatus,
        housekeepingStatus: roomUnitStates.housekeepingStatus,
        serviceabilityStatus: roomUnitStates.serviceabilityStatus,
      })
      .from(roomUnits)
      .leftJoin(roomUnitStates, eq(roomUnitStates.roomUnitId, roomUnits.id))
      .where(eq(roomUnits.propertyId, params.propertyId))
      .orderBy(roomUnits.sortOrder, roomUnits.roomNumber),
    db
      .select({
        id: resourcePools.id,
        code: resourcePools.code,
        nameId: resourcePools.nameId,
        nameEn: resourcePools.nameEn,
        inventoryTracked: resourcePools.inventoryTracked,
        physicalCapacity: resourcePools.physicalCapacity,
        status: resourcePools.status,
      })
      .from(resourcePools)
      .where(eq(resourcePools.propertyId, params.propertyId))
      .orderBy(resourcePools.code),
  ]);

  return {
    amenities: amenityRows,
    roomTypes: typeRows,
    roomUnits: unitRows,
    resourcePools: resourceRows,
  };
}

export async function createAmenity(params: {
  session: StaffSession;
  propertyId: string;
  code: string;
  iconKey?: string | null;
  nameId: string;
  nameEn: string;
  descriptionId?: string | null;
  descriptionEn?: string | null;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  const code = normalizeMasterCode(params.code);
  const reason = reasonValue(params.reason);
  return getDatabase().transaction(async (tx) => {
    const [created] = await tx
      .insert(amenities)
      .values({
        propertyId: params.propertyId,
        code,
        iconKey: params.iconKey ?? null,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: amenities.id });
    if (!created) throw new Error("Failed to create amenity");
    await tx.insert(amenityTranslations).values([
      {
        amenityId: created.id,
        locale: "id",
        name: params.nameId.trim(),
        description: params.descriptionId ?? null,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      },
      {
        amenityId: created.id,
        locale: "en",
        name: params.nameEn.trim(),
        description: params.descriptionEn ?? null,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      },
    ]);
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.amenity.create",
        targetType: "amenity",
        targetId: created.id,
        after: { code, locales: ["id", "en"] },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export interface RoomTypeDraftInput {
  roomTypeId?: string;
  code: string;
  nameId: string;
  nameEn: string;
  descriptionId?: string | null;
  descriptionEn?: string | null;
  bedConfiguration?: string | null;
  standardAdults: number;
  maximumAdults: number;
  maximumChildren: number;
  maximumTotalGuests: number;
  extraBedAllowed: boolean;
  maximumExtraBeds: number;
  extraBedCapacityIncrement: number;
  amenityIds?: string[];
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
}

function validateCapacity(input: RoomTypeDraftInput): void {
  if (
    input.standardAdults < 0 ||
    input.maximumAdults < input.standardAdults ||
    input.maximumChildren < 0 ||
    input.maximumTotalGuests < 1 ||
    input.maximumExtraBeds < 0 ||
    input.extraBedCapacityIncrement < 0 ||
    (!input.extraBedAllowed && input.maximumExtraBeds !== 0)
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid room capacity values");
  }
}

export async function previewRoomTypeDraft(params: {
  session: StaffSession;
  propertyId: string;
  input: RoomTypeDraftInput;
}): Promise<ImpactPreview> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  validateCapacity(params.input);
  if (!params.input.roomTypeId) {
    return {
      severity: "LOW",
      blockers: [],
      warnings: [],
      references: { futureReservations: 0 },
    };
  }

  const db = getDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const affected = await db
    .select({
      id: reservationRooms.id,
      adults: reservationRooms.adults,
      children: reservationRooms.children,
      extraBedQuantity: reservationRooms.extraBedQuantity,
    })
    .from(reservationRooms)
    .innerJoin(
      reservations,
      eq(reservations.id, reservationRooms.reservationId),
    )
    .where(
      and(
        or(
          eq(reservationRooms.bookedRoomTypeId, params.input.roomTypeId),
          eq(reservationRooms.fulfilledRoomTypeId, params.input.roomTypeId),
        ),
        gte(reservationRooms.checkoutDate, today),
        inArray(reservations.status, ["ON_HOLD", "CONFIRMED"]),
        eq(reservationRooms.lineStatus, "ACTIVE"),
      ),
    );
  const blockers = affected.filter(
    (room) =>
      room.adults > params.input.maximumAdults ||
      room.adults + room.children > params.input.maximumTotalGuests ||
      room.extraBedQuantity > params.input.maximumExtraBeds,
  );
  return {
    severity: blockers.length > 0 ? "HIGH" : affected.length ? "MEDIUM" : "LOW",
    blockers:
      blockers.length > 0
        ? [
            `${blockers.length} future reservation room line(s) exceed the proposed capacity`,
          ]
        : [],
    warnings:
      affected.length > 0
        ? ["Existing reservations keep their original occupancy snapshot"]
        : [],
    references: {
      futureReservations: affected.length,
      capacityConflicts: blockers.length,
    },
  };
}

export async function createRoomTypeDraft(params: {
  session: StaffSession;
  propertyId: string;
  input: RoomTypeDraftInput;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  validateCapacity(params.input);
  assertEffectivePeriod(params.input.effectiveFrom, params.input.effectiveTo);
  const reason = reasonValue(params.input.reason);
  const code = normalizeMasterCode(params.input.code);
  if (code.length > 40) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Kode jenis kamar tidak boleh lebih dari 40 karakter",
    );
  }
  const impact = await previewRoomTypeDraft(params);
  if (impact.blockers.length > 0) {
    throw new AppError("CONFLICT", impact.blockers[0] ?? "Capacity conflict");
  }

  return getDatabase().transaction(async (tx) => {
    let roomTypeId = params.input.roomTypeId;
    if (!roomTypeId) {
      const [createdType] = await tx
        .insert(roomTypes)
        .values({
          propertyId: params.propertyId,
          code,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: roomTypes.id });
      roomTypeId = createdType?.id;
    } else {
      const [owned] = await tx
        .select({ id: roomTypes.id })
        .from(roomTypes)
        .where(
          and(
            eq(roomTypes.id, roomTypeId),
            eq(roomTypes.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Room type not found");
    }
    if (!roomTypeId) throw new Error("Failed to create room type");

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`room-type:${roomTypeId}`}, 0))`,
    );

    const existing = await tx
      .select({ versionNumber: roomTypeVersions.versionNumber })
      .from(roomTypeVersions)
      .where(eq(roomTypeVersions.roomTypeId, roomTypeId));
    const versionNumber = nextVersionNumber(existing);
    const approvalStatus =
      impact.severity === "HIGH" ? "PENDING" : "NOT_REQUIRED";
    const [created] = await tx
      .insert(roomTypeVersions)
      .values({
        roomTypeId,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus,
        nameId: params.input.nameId.trim(),
        nameEn: params.input.nameEn.trim(),
        descriptionId: params.input.descriptionId ?? null,
        descriptionEn: params.input.descriptionEn ?? null,
        bedConfiguration: params.input.bedConfiguration ?? null,
        standardAdults: params.input.standardAdults,
        maximumAdults: params.input.maximumAdults,
        maximumChildren: params.input.maximumChildren,
        maximumTotalGuests: params.input.maximumTotalGuests,
        extraBedAllowed: params.input.extraBedAllowed,
        maximumExtraBeds: params.input.maximumExtraBeds,
        extraBedCapacityIncrement: params.input.extraBedCapacityIncrement,
        effectiveFrom: params.input.effectiveFrom,
        effectiveTo: params.input.effectiveTo ?? null,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: roomTypeVersions.id });
    if (!created) throw new Error("Failed to create room type version");

    if (params.input.amenityIds?.length) {
      const ownedAmenities = await tx
        .select({ id: amenities.id })
        .from(amenities)
        .where(
          and(
            eq(amenities.propertyId, params.propertyId),
            inArray(amenities.id, params.input.amenityIds),
          ),
        );
      if (ownedAmenities.length !== new Set(params.input.amenityIds).size) {
        throw new AppError(
          "VALIDATION_ERROR",
          "One or more amenities do not belong to this property",
        );
      }
      await tx.insert(roomTypeAmenities).values(
        ownedAmenities.map((amenity) => ({
          roomTypeVersionId: created.id,
          amenityId: amenity.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })),
      );
    }

    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.room_type.version.create",
        targetType: "room_type_version",
        targetId: created.id,
        after: {
          roomTypeId,
          code,
          versionNumber,
          approvalStatus,
          maximumTotalGuests: params.input.maximumTotalGuests,
          maximumExtraBeds: params.input.maximumExtraBeds,
          impact,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: created.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus,
    };
  });
}

async function ownedRoomTypeVersion(versionId: string, propertyId: string) {
  const [row] = await getDatabase()
    .select({
      id: roomTypeVersions.id,
      roomTypeId: roomTypeVersions.roomTypeId,
      lifecycleStatus: roomTypeVersions.lifecycleStatus,
      approvalStatus: roomTypeVersions.approvalStatus,
      effectiveFrom: roomTypeVersions.effectiveFrom,
      effectiveTo: roomTypeVersions.effectiveTo,
      maximumAdults: roomTypeVersions.maximumAdults,
      maximumTotalGuests: roomTypeVersions.maximumTotalGuests,
      maximumExtraBeds: roomTypeVersions.maximumExtraBeds,
    })
    .from(roomTypeVersions)
    .innerJoin(roomTypes, eq(roomTypes.id, roomTypeVersions.roomTypeId))
    .where(
      and(
        eq(roomTypeVersions.id, versionId),
        eq(roomTypes.propertyId, propertyId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Room type version not found");
  return row;
}

export async function reviewRoomTypeVersion(params: {
  session: StaffSession;
  propertyId: string;
  versionId: string;
  decision: ReviewDecision;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.approve",
  );
  const reason = reasonValue(params.reason);
  const current = await ownedRoomTypeVersion(
    params.versionId,
    params.propertyId,
  );
  if (
    current.lifecycleStatus !== "DRAFT" ||
    current.approvalStatus !== "PENDING"
  ) {
    throw new AppError("CONFLICT", "Only a pending draft can be reviewed");
  }
  const approvalStatus =
    params.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  return getDatabase().transaction(async (tx) => {
    await tx
      .update(roomTypeVersions)
      .set({
        approvalStatus,
        approvedByUserId: params.session.user.id,
        approvedAt: new Date(),
        reason,
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(roomTypeVersions.id, params.versionId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: `room_master.room_type.${params.decision.toLowerCase()}`,
        targetType: "room_type_version",
        targetId: params.versionId,
        before: { approvalStatus: current.approvalStatus },
        after: { approvalStatus },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: params.versionId, lifecycleStatus: "DRAFT", approvalStatus };
  });
}

export async function publishRoomTypeVersion(params: {
  session: StaffSession;
  propertyId: string;
  versionId: string;
  reason: string;
  now?: Date;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  const reason = reasonValue(params.reason);
  const current = await ownedRoomTypeVersion(
    params.versionId,
    params.propertyId,
  );
  try {
    requirePublishable(current);
  } catch (error) {
    throw new AppError(
      "CONFLICT",
      error instanceof Error ? error.message : "Version cannot be published",
    );
  }
  const now = params.now ?? new Date();
  const lifecycleStatus = lifecycleForPublish(current.effectiveFrom, now);
  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`room-type:${current.roomTypeId}`}, 0))`,
    );
    const siblings = await tx
      .select({
        id: roomTypeVersions.id,
        lifecycleStatus: roomTypeVersions.lifecycleStatus,
        effectiveFrom: roomTypeVersions.effectiveFrom,
        effectiveTo: roomTypeVersions.effectiveTo,
      })
      .from(roomTypeVersions)
      .where(
        and(
          eq(roomTypeVersions.roomTypeId, current.roomTypeId),
          ne(roomTypeVersions.id, current.id),
          inArray(roomTypeVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
        ),
      );
    for (const sibling of siblings) {
      const overlaps =
        sibling.effectiveFrom <
          (current.effectiveTo ?? new Date(8640000000000000)) &&
        (sibling.effectiveTo ?? new Date(8640000000000000)) >
          current.effectiveFrom;
      if (!overlaps) continue;
      if (
        sibling.lifecycleStatus === "ACTIVE" &&
        sibling.effectiveFrom < current.effectiveFrom
      ) {
        await tx
          .update(roomTypeVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(roomTypeVersions.id, sibling.id));
      } else {
        throw new AppError(
          "CONFLICT",
          "Effective period overlaps another room type version",
        );
      }
    }
    await tx
      .update(roomTypeVersions)
      .set({
        lifecycleStatus,
        reason,
        updatedAt: now,
        updatedByUserId: params.session.user.id,
      })
      .where(eq(roomTypeVersions.id, params.versionId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.room_type.publish",
        targetType: "room_type_version",
        targetId: params.versionId,
        before: { lifecycleStatus: current.lifecycleStatus },
        after: { lifecycleStatus },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: params.versionId,
      lifecycleStatus,
      approvalStatus: current.approvalStatus,
    };
  });
}

export async function createRoomUnit(params: {
  session: StaffSession;
  propertyId: string;
  roomNumber: string;
  sortOrder: number;
  floorOrArea?: string | null;
  roomTypeId: string;
  effectiveFrom: Date;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  const reason = reasonValue(params.reason);
  const roomNumber = params.roomNumber.trim();
  if (!roomNumber || roomNumber.length > 32) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Room number must contain 1-32 characters",
    );
  }
  return getDatabase().transaction(async (tx) => {
    const [ownedType] = await tx
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.id, params.roomTypeId),
          eq(roomTypes.propertyId, params.propertyId),
          eq(roomTypes.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!ownedType)
      throw new AppError("NOT_FOUND", "Active room type not found");
    const [created] = await tx
      .insert(roomUnits)
      .values({
        propertyId: params.propertyId,
        roomNumber,
        sortOrder: params.sortOrder,
        floorOrArea: params.floorOrArea ?? null,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: roomUnits.id });
    if (!created) throw new Error("Failed to create room unit");
    await tx.insert(roomUnitStates).values({
      roomUnitId: created.id,
      occupancyStatus: "VACANT",
      housekeepingStatus: "DIRTY",
      serviceabilityStatus: "IN_SERVICE",
      createdByUserId: params.session.user.id,
      updatedByUserId: params.session.user.id,
    });
    await tx.insert(roomUnitTypePeriods).values({
      roomUnitId: created.id,
      roomTypeId: params.roomTypeId,
      effectiveFrom: params.effectiveFrom,
      reason,
      createdByUserId: params.session.user.id,
      updatedByUserId: params.session.user.id,
    });
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.room_unit.create",
        targetType: "room_unit",
        targetId: created.id,
        after: {
          roomNumber,
          roomTypeId: params.roomTypeId,
          sortOrder: params.sortOrder,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export async function changeRoomUnitType(params: {
  session: StaffSession;
  propertyId: string;
  roomUnitId: string;
  roomTypeId: string;
  effectiveFrom: Date;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  const reason = reasonValue(params.reason);
  return getDatabase().transaction(async (tx) => {
    const [ownedUnit] = await tx
      .select({ id: roomUnits.id })
      .from(roomUnits)
      .where(
        and(
          eq(roomUnits.id, params.roomUnitId),
          eq(roomUnits.propertyId, params.propertyId),
        ),
      )
      .limit(1);
    const [ownedType] = await tx
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.id, params.roomTypeId),
          eq(roomTypes.propertyId, params.propertyId),
        ),
      )
      .limit(1);
    if (!ownedUnit || !ownedType)
      throw new AppError("NOT_FOUND", "Room unit or room type not found");
    const current = await tx
      .select({
        id: roomUnitTypePeriods.id,
        effectiveFrom: roomUnitTypePeriods.effectiveFrom,
      })
      .from(roomUnitTypePeriods)
      .where(
        and(
          eq(roomUnitTypePeriods.roomUnitId, params.roomUnitId),
          isNull(roomUnitTypePeriods.effectiveTo),
        ),
      )
      .limit(1);
    if (current[0] && params.effectiveFrom <= current[0].effectiveFrom) {
      throw new AppError(
        "CONFLICT",
        "New type period must start after the current period",
      );
    }
    if (current[0]) {
      await tx
        .update(roomUnitTypePeriods)
        .set({
          effectiveTo: params.effectiveFrom,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomUnitTypePeriods.id, current[0].id));
    }
    const [created] = await tx
      .insert(roomUnitTypePeriods)
      .values({
        roomUnitId: params.roomUnitId,
        roomTypeId: params.roomTypeId,
        effectiveFrom: params.effectiveFrom,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: roomUnitTypePeriods.id });
    if (!created) throw new Error("Failed to create room type period");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.room_unit.type_change",
        targetType: "room_unit",
        targetId: params.roomUnitId,
        after: {
          roomTypeId: params.roomTypeId,
          effectiveFrom: params.effectiveFrom.toISOString(),
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export async function createResourcePool(params: {
  session: StaffSession;
  propertyId: string;
  code: string;
  nameId: string;
  nameEn: string;
  physicalCapacity: number;
  inventoryTracked?: boolean;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  const reason = reasonValue(params.reason);
  if (
    !Number.isInteger(params.physicalCapacity) ||
    params.physicalCapacity < 0
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Physical capacity must be a non-negative integer",
    );
  }
  const code = normalizeMasterCode(params.code);
  if (code.length > 64) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Kode persediaan tidak boleh lebih dari 64 karakter",
    );
  }
  return getDatabase().transaction(async (tx) => {
    const [created] = await tx
      .insert(resourcePools)
      .values({
        propertyId: params.propertyId,
        code,
        nameId: params.nameId.trim(),
        nameEn: params.nameEn.trim(),
        physicalCapacity: params.physicalCapacity,
        inventoryTracked: params.inventoryTracked ?? true,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: resourcePools.id });
    if (!created) throw new Error("Failed to create resource pool");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.resource_pool.create",
        targetType: "resource_pool",
        targetId: created.id,
        after: { code, physicalCapacity: params.physicalCapacity },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export async function archiveRoomMaster(params: {
  session: StaffSession;
  propertyId: string;
  target: "AMENITY" | "ROOM_TYPE" | "ROOM_UNIT" | "RESOURCE_POOL";
  targetId: string;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "room_master.manage",
  );
  const reason = reasonValue(params.reason);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return getDatabase().transaction(async (tx) => {
    if (params.target === "ROOM_UNIT") {
      const [unit] = await tx
        .select({
          id: roomUnits.id,
          occupancyStatus: roomUnitStates.occupancyStatus,
        })
        .from(roomUnits)
        .leftJoin(roomUnitStates, eq(roomUnitStates.roomUnitId, roomUnits.id))
        .where(
          and(
            eq(roomUnits.id, params.targetId),
            eq(roomUnits.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!unit) throw new AppError("NOT_FOUND", "Room unit not found");
      if (unit.occupancyStatus === "OCCUPIED") {
        throw new AppError("CONFLICT", "An occupied room cannot be archived");
      }
      const claims = await tx
        .select({ id: roomUnitNightClaims.id })
        .from(roomUnitNightClaims)
        .where(
          and(
            eq(roomUnitNightClaims.roomUnitId, params.targetId),
            eq(roomUnitNightClaims.claimStatus, "ACTIVE"),
            gte(roomUnitNightClaims.stayDate, today),
          ),
        )
        .limit(1);
      if (claims.length) {
        throw new AppError(
          "CONFLICT",
          "Room has an active or future assignment/block",
        );
      }
      await tx
        .update(roomUnits)
        .set({
          status: "ARCHIVED",
          archivedAt: now,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomUnits.id, params.targetId));
    } else if (params.target === "ROOM_TYPE") {
      const [owned] = await tx
        .select({ id: roomTypes.id })
        .from(roomTypes)
        .where(
          and(
            eq(roomTypes.id, params.targetId),
            eq(roomTypes.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Room type not found");
      const reservationsUsingType = await tx
        .select({ id: reservationRooms.id })
        .from(reservationRooms)
        .innerJoin(
          reservations,
          eq(reservations.id, reservationRooms.reservationId),
        )
        .where(
          and(
            or(
              eq(reservationRooms.bookedRoomTypeId, params.targetId),
              eq(reservationRooms.fulfilledRoomTypeId, params.targetId),
            ),
            gte(reservationRooms.checkoutDate, today),
            inArray(reservations.status, ["ON_HOLD", "CONFIRMED"]),
            eq(reservationRooms.lineStatus, "ACTIVE"),
          ),
        )
        .limit(1);
      if (reservationsUsingType.length) {
        throw new AppError(
          "CONFLICT",
          "Room type is referenced by an active or future reservation",
        );
      }
      await tx
        .update(roomTypes)
        .set({
          status: "ARCHIVED",
          archivedAt: now,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomTypes.id, params.targetId));
    } else if (params.target === "AMENITY") {
      const [owned] = await tx
        .select({ id: amenities.id })
        .from(amenities)
        .where(
          and(
            eq(amenities.id, params.targetId),
            eq(amenities.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Amenity not found");
      await tx
        .update(amenities)
        .set({
          status: "ARCHIVED",
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(amenities.id, params.targetId));
    } else {
      const [owned] = await tx
        .select({ id: resourcePools.id })
        .from(resourcePools)
        .where(
          and(
            eq(resourcePools.id, params.targetId),
            eq(resourcePools.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Resource pool not found");
      await tx
        .update(resourcePools)
        .set({
          status: "ARCHIVED",
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(resourcePools.id, params.targetId));
    }
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "room_master.archive",
        targetType: params.target.toLowerCase(),
        targetId: params.targetId,
        before: { status: "ACTIVE" },
        after: { status: "ARCHIVED" },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: params.targetId };
  });
}
