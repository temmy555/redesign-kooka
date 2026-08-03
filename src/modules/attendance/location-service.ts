import "server-only";

import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";

import { getDatabase } from "../../db";
import { attendanceLocations } from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import type { StaffSession } from "../configuration/contracts";
import { normalizeMasterCode } from "../configuration/versioning";

export interface AttendanceLocationInput {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maximumAccuracyMeters: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
}

function reason(value: string) {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 500)
    throw new AppError(
      "VALIDATION_ERROR",
      "Alasan harus terdiri dari 3 sampai 500 karakter",
    );
  return normalized;
}

function validate(input: AttendanceLocationInput) {
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Latitude harus berada antara -90 dan 90",
    );
  if (
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Longitude harus berada antara -180 dan 180",
    );
  if (
    !Number.isInteger(input.radiusMeters) ||
    input.radiusMeters < 5 ||
    input.radiusMeters > 5000
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Radius harus berupa angka bulat antara 5 dan 5.000 meter",
    );
  if (
    !Number.isInteger(input.maximumAccuracyMeters) ||
    input.maximumAccuracyMeters < 5 ||
    input.maximumAccuracyMeters > 1000
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Batas akurasi harus berupa angka bulat antara 5 dan 1.000 meter",
    );
  if (
    Number.isNaN(input.effectiveFrom.getTime()) ||
    (input.effectiveTo && Number.isNaN(input.effectiveTo.getTime()))
  )
    throw new AppError("VALIDATION_ERROR", "Periode berlaku tidak valid");
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)
    throw new AppError(
      "VALIDATION_ERROR",
      "Tanggal berakhir harus setelah tanggal mulai",
    );
}

const locationSelection = {
  id: attendanceLocations.id,
  code: attendanceLocations.code,
  name: attendanceLocations.name,
  latitude: attendanceLocations.latitude,
  longitude: attendanceLocations.longitude,
  radiusMeters: attendanceLocations.radiusMeters,
  maximumAccuracyMeters: attendanceLocations.maximumAccuracyMeters,
  effectiveFrom: attendanceLocations.effectiveFrom,
  effectiveTo: attendanceLocations.effectiveTo,
  status: attendanceLocations.status,
  createdAt: attendanceLocations.createdAt,
  updatedAt: attendanceLocations.updatedAt,
};

export async function getAttendanceLocationOverview(params: {
  session: StaffSession;
  propertyId: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.location.view",
  );
  const locations = await getDatabase()
    .select(locationSelection)
    .from(attendanceLocations)
    .where(eq(attendanceLocations.propertyId, params.propertyId))
    .orderBy(asc(attendanceLocations.name));
  return { locations };
}

export async function createAttendanceLocation(params: {
  session: StaffSession;
  propertyId: string;
  input: AttendanceLocationInput;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.location.manage",
  );
  validate(params.input);
  const auditReason = reason(params.input.reason);
  const code = normalizeMasterCode(params.input.code);
  const db = getDatabase();
  const duplicate = await db
    .select({ id: attendanceLocations.id })
    .from(attendanceLocations)
    .where(
      and(
        eq(attendanceLocations.propertyId, params.propertyId),
        eq(attendanceLocations.code, code),
      ),
    )
    .limit(1);
  if (duplicate.length)
    throw new AppError("CONFLICT", "Kode titik absensi sudah digunakan");

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(attendanceLocations)
      .values({
        propertyId: params.propertyId,
        code,
        name: params.input.name.trim(),
        latitude: params.input.latitude,
        longitude: params.input.longitude,
        radiusMeters: params.input.radiusMeters,
        maximumAccuracyMeters: params.input.maximumAccuracyMeters,
        effectiveFrom: params.input.effectiveFrom,
        effectiveTo: params.input.effectiveTo ?? null,
        status: "ACTIVE",
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: attendanceLocations.id });
    if (!created)
      throw new AppError("INTERNAL_ERROR", "Titik absensi gagal dibuat");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "attendance.location.create",
        targetType: "attendance_location",
        targetId: created.id,
        before: null,
        after: {
          code,
          name: params.input.name.trim(),
          latitude: params.input.latitude,
          longitude: params.input.longitude,
          radiusMeters: params.input.radiusMeters,
          maximumAccuracyMeters: params.input.maximumAccuracyMeters,
          effectiveFrom: params.input.effectiveFrom.toISOString(),
          effectiveTo: params.input.effectiveTo?.toISOString() ?? null,
          status: "ACTIVE",
        },
        reason: auditReason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export async function updateAttendanceLocation(params: {
  session: StaffSession;
  propertyId: string;
  locationId: string;
  input: AttendanceLocationInput;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.location.manage",
  );
  validate(params.input);
  const auditReason = reason(params.input.reason);
  const code = normalizeMasterCode(params.input.code);
  const db = getDatabase();
  const [current] = await db
    .select(locationSelection)
    .from(attendanceLocations)
    .where(
      and(
        eq(attendanceLocations.id, params.locationId),
        eq(attendanceLocations.propertyId, params.propertyId),
      ),
    )
    .limit(1);
  if (!current)
    throw new AppError("NOT_FOUND", "Titik absensi tidak ditemukan");
  const duplicate = await db
    .select({ id: attendanceLocations.id })
    .from(attendanceLocations)
    .where(
      and(
        eq(attendanceLocations.propertyId, params.propertyId),
        eq(attendanceLocations.code, code),
      ),
    );
  if (duplicate.some((row) => row.id !== params.locationId))
    throw new AppError("CONFLICT", "Kode titik absensi sudah digunakan");

  return db.transaction(async (tx) => {
    await tx
      .update(attendanceLocations)
      .set({
        code,
        name: params.input.name.trim(),
        latitude: params.input.latitude,
        longitude: params.input.longitude,
        radiusMeters: params.input.radiusMeters,
        maximumAccuracyMeters: params.input.maximumAccuracyMeters,
        effectiveFrom: params.input.effectiveFrom,
        effectiveTo: params.input.effectiveTo ?? null,
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(attendanceLocations.id, params.locationId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "attendance.location.update",
        targetType: "attendance_location",
        targetId: params.locationId,
        before: current,
        after: {
          ...current,
          code,
          name: params.input.name.trim(),
          latitude: params.input.latitude,
          longitude: params.input.longitude,
          radiusMeters: params.input.radiusMeters,
          maximumAccuracyMeters: params.input.maximumAccuracyMeters,
          effectiveFrom: params.input.effectiveFrom.toISOString(),
          effectiveTo: params.input.effectiveTo?.toISOString() ?? null,
        },
        reason: auditReason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: params.locationId };
  });
}

export async function setAttendanceLocationStatus(params: {
  session: StaffSession;
  propertyId: string;
  locationId: string;
  status: "ACTIVE" | "INACTIVE";
  reason: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.location.manage",
  );
  const auditReason = reason(params.reason);
  const db = getDatabase();
  const [current] = await db
    .select(locationSelection)
    .from(attendanceLocations)
    .where(
      and(
        eq(attendanceLocations.id, params.locationId),
        eq(attendanceLocations.propertyId, params.propertyId),
      ),
    )
    .limit(1);
  if (!current)
    throw new AppError("NOT_FOUND", "Titik absensi tidak ditemukan");
  return db.transaction(async (tx) => {
    await tx
      .update(attendanceLocations)
      .set({
        status: params.status,
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(attendanceLocations.id, params.locationId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "attendance.location.status_change",
        targetType: "attendance_location",
        targetId: params.locationId,
        before: { status: current.status },
        after: { status: params.status },
        reason: auditReason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: params.locationId, status: params.status };
  });
}

export type AttendanceLocationCheck = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export function calculateDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(value));
}

async function activeLocations(propertyId: string, at: Date) {
  return getDatabase()
    .select(locationSelection)
    .from(attendanceLocations)
    .where(
      and(
        eq(attendanceLocations.propertyId, propertyId),
        eq(attendanceLocations.status, "ACTIVE"),
        lte(attendanceLocations.effectiveFrom, at),
        or(
          isNull(attendanceLocations.effectiveTo),
          gt(attendanceLocations.effectiveTo, at),
        ),
      ),
    )
    .orderBy(asc(attendanceLocations.name));
}

export async function getEligibleAttendanceLocations(params: {
  session: StaffSession;
  propertyId: string;
  at?: Date;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.self.view",
  );
  const locations = await activeLocations(
    params.propertyId,
    params.at ?? new Date(),
  );
  return {
    locations: locations.map((location) => ({
      id: location.id,
      code: location.code,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters: location.radiusMeters,
      maximumAccuracyMeters: location.maximumAccuracyMeters,
    })),
  };
}

export async function checkAttendanceLocation(params: {
  session: StaffSession;
  propertyId: string;
  position: AttendanceLocationCheck;
  at?: Date;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.self.view",
  );
  if (
    !Number.isFinite(params.position.latitude) ||
    params.position.latitude < -90 ||
    params.position.latitude > 90 ||
    !Number.isFinite(params.position.longitude) ||
    params.position.longitude < -180 ||
    params.position.longitude > 180 ||
    !Number.isFinite(params.position.accuracyMeters) ||
    params.position.accuracyMeters < 0
  )
    throw new AppError("VALIDATION_ERROR", "Data lokasi perangkat tidak valid");

  const locations = await activeLocations(
    params.propertyId,
    params.at ?? new Date(),
  );
  if (!locations.length)
    return { eligible: false, result: "NO_ACTIVE_LOCATION", nearest: null };
  const candidates = locations
    .map((location) => ({
      id: location.id,
      code: location.code,
      name: location.name,
      radiusMeters: location.radiusMeters,
      maximumAccuracyMeters: location.maximumAccuracyMeters,
      distanceMeters: calculateDistanceMeters(
        params.position.latitude,
        params.position.longitude,
        location.latitude,
        location.longitude,
      ),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  const nearest = candidates[0];
  if (!nearest)
    return { eligible: false, result: "NO_ACTIVE_LOCATION", nearest: null };
  if (params.position.accuracyMeters > nearest.maximumAccuracyMeters)
    return { eligible: false, result: "ACCURACY_REJECTED", nearest };
  return {
    eligible: nearest.distanceMeters <= nearest.radiusMeters,
    result:
      nearest.distanceMeters <= nearest.radiusMeters ? "INSIDE" : "OUTSIDE",
    nearest,
  };
}
