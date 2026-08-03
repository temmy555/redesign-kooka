import "server-only";

import { and, desc, eq, ne, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  attendanceEvents,
  attendanceSessions,
  employeeProfiles,
  storedFiles,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { getBusinessDate } from "../../platform/clock";
import { AppError } from "../../platform/errors";
import { databaseTimestampIso } from "../../platform/database-values";
import { paginationMeta } from "../../platform/pagination";
import {
  type IdempotencyTransaction,
  withIdempotency,
} from "../../platform/idempotency";
import { EXPORT_MAX_DAYS, validateDateRange } from "../reporting/contracts";
import type { StaffSession } from "../configuration/contracts";
import { stableRequestHash } from "../booking/domain";
import {
  checkAttendanceLocation,
  type AttendanceLocationCheck,
} from "./location-service";

type AttendanceAction = "CHECK_IN" | "CHECK_OUT";

export interface RecordAttendanceInput {
  action: AttendanceAction;
  selfieFileId: string;
  position: AttendanceLocationCheck;
  deviceTime?: Date | null;
  deviceMetadata?: Record<string, unknown>;
  idempotencyKey: string;
}

function reportDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  now = new Date(),
) {
  const today = getBusinessDate(now);
  const start = startDate ?? today;
  const end = endDate ?? today;
  validateDateRange(start, end, EXPORT_MAX_DAYS);
  return { start, end };
}

async function employeeFor(
  session: StaffSession,
  propertyId: string,
  options?: { lock?: boolean; tx?: IdempotencyTransaction },
) {
  const db = options?.tx ?? getDatabase();
  const query = db
    .select({
      id: employeeProfiles.id,
      displayName: employeeProfiles.displayName,
      employeeCode: employeeProfiles.employeeCode,
      employmentStatus: employeeProfiles.employmentStatus,
    })
    .from(employeeProfiles)
    .where(
      and(
        eq(employeeProfiles.userId, session.user.id),
        eq(employeeProfiles.propertyId, propertyId),
      ),
    )
    .limit(1);
  const rows = options?.lock ? await query.for("update") : await query;
  const employee = rows[0];
  if (!employee)
    throw new AppError(
      "FORBIDDEN",
      "Akun ini belum terhubung dengan profil karyawan",
    );
  if (employee.employmentStatus !== "ACTIVE")
    throw new AppError("FORBIDDEN", "Profil karyawan tidak aktif");
  return employee;
}

function mapSession(session: typeof attendanceSessions.$inferSelect) {
  return {
    id: session.id,
    businessDate: session.businessDate,
    status: session.status,
    checkedInAt: session.checkedInAt.toISOString(),
    checkedOutAt: session.checkedOutAt?.toISOString() ?? null,
    durationMinutes: session.calculatedDurationMinutes,
  };
}

export async function getSelfAttendance(params: {
  session: StaffSession;
  propertyId: string;
  now?: Date;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.self.view",
  );
  const employee = await employeeFor(params.session, params.propertyId);
  const businessDate = getBusinessDate(params.now ?? new Date());
  const sessions = await getDatabase()
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.employeeId, employee.id),
        ne(attendanceSessions.status, "VOIDED"),
      ),
    )
    .orderBy(
      desc(attendanceSessions.businessDate),
      desc(attendanceSessions.checkedInAt),
    )
    .limit(31);
  const today = sessions.find((item) => item.businessDate === businessDate);
  return {
    employee: {
      id: employee.id,
      code: employee.employeeCode,
      name: employee.displayName,
    },
    businessDate,
    today: today ? mapSession(today) : null,
    history: sessions.map(mapSession),
  };
}

async function validateSelfie(params: {
  session: StaffSession;
  propertyId: string;
  selfieFileId: string;
}) {
  const [file] = await getDatabase()
    .select({
      id: storedFiles.id,
      propertyId: storedFiles.propertyId,
      purpose: storedFiles.purpose,
      classification: storedFiles.classification,
      scanStatus: storedFiles.scanStatus,
      purgedAt: storedFiles.purgedAt,
      createdByUserId: storedFiles.createdByUserId,
    })
    .from(storedFiles)
    .where(eq(storedFiles.id, params.selfieFileId))
    .limit(1);
  if (
    !file ||
    file.propertyId !== params.propertyId ||
    file.createdByUserId !== params.session.user.id ||
    file.purpose !== "ATTENDANCE_SELFIE" ||
    file.classification !== "SENSITIVE_EMPLOYEE_DATA" ||
    file.scanStatus !== "CLEAN" ||
    file.purgedAt
  )
    throw new AppError("VALIDATION_ERROR", "Selfie absensi tidak valid");
}

export async function recordAttendance(params: {
  session: StaffSession;
  propertyId: string;
  input: RecordAttendanceInput;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.self.view",
  );
  const employee = await employeeFor(params.session, params.propertyId);
  await validateSelfie({
    session: params.session,
    propertyId: params.propertyId,
    selfieFileId: params.input.selfieFileId,
  });
  const geofence = await checkAttendanceLocation({
    session: params.session,
    propertyId: params.propertyId,
    position: params.input.position,
  });
  if (!geofence.eligible || !geofence.nearest)
    throw new AppError(
      "VALIDATION_ERROR",
      geofence.result === "ACCURACY_REJECTED"
        ? "Akurasi lokasi belum memenuhi batas titik absensi"
        : geofence.result === "NO_ACTIVE_LOCATION"
          ? "Belum ada titik absensi aktif"
          : "Perangkat berada di luar radius titik absensi",
    );

  const now = new Date();
  const businessDate = getBusinessDate(now);
  const requestHash = stableRequestHash({
    action: params.input.action,
    employeeId: employee.id,
    businessDate,
    position: params.input.position,
    deviceTime: params.input.deviceTime?.toISOString() ?? null,
  });

  return withIdempotency(
    {
      scope: `attendance:${params.propertyId}:${employee.id}`,
      key: params.input.idempotencyKey,
      requestHash,
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const lockedEmployee = await employeeFor(
        params.session,
        params.propertyId,
        { lock: true, tx },
      );
      const currentSessions = await tx
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.employeeId, lockedEmployee.id),
            eq(attendanceSessions.businessDate, businessDate),
            ne(attendanceSessions.status, "VOIDED"),
          ),
        )
        .orderBy(desc(attendanceSessions.checkedInAt))
        .for("update");
      const current = currentSessions[0];
      let attendanceSessionId: string;

      if (params.input.action === "CHECK_IN") {
        if (current)
          throw new AppError(
            "CONFLICT",
            current.status === "OPEN"
              ? "Anda sudah absen masuk dan belum absen keluar"
              : "Absensi hari ini sudah selesai",
          );
        const [created] = await tx
          .insert(attendanceSessions)
          .values({
            employeeId: lockedEmployee.id,
            mode: "FREE",
            businessDate,
            status: "OPEN",
            checkedInAt: now,
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .returning({ id: attendanceSessions.id });
        if (!created)
          throw new AppError("INTERNAL_ERROR", "Session absensi gagal dibuat");
        attendanceSessionId = created.id;
      } else {
        if (!current || current.status !== "OPEN")
          throw new AppError(
            "CONFLICT",
            "Tidak ada absensi masuk yang masih terbuka",
          );
        attendanceSessionId = current.id;
      }

      const [event] = await tx
        .insert(attendanceEvents)
        .values({
          attendanceSessionId,
          employeeId: lockedEmployee.id,
          eventType: params.input.action,
          serverTime: now,
          deviceTime: params.input.deviceTime ?? null,
          latitude: params.input.position.latitude,
          longitude: params.input.position.longitude,
          accuracyMeters: params.input.position.accuracyMeters,
          attendanceLocationId: geofence.nearest.id,
          distanceMeters: geofence.nearest.distanceMeters,
          geofenceResult: "INSIDE",
          selfieFileId: params.input.selfieFileId,
          eventStatus: "ACCEPTED",
          deviceMetadata: params.input.deviceMetadata ?? {},
          idempotencyKey: params.input.idempotencyKey,
          createdByUserId: params.session.user.id,
        })
        .returning({ id: attendanceEvents.id });
      if (!event)
        throw new AppError("INTERNAL_ERROR", "Event absensi gagal disimpan");

      let checkedOutAt: string | null = null;
      let durationMinutes: number | null = null;
      if (params.input.action === "CHECK_OUT") {
        const checkedInAt = current?.checkedInAt ?? now;
        durationMinutes = Math.max(
          0,
          Math.floor((now.getTime() - checkedInAt.getTime()) / 60_000),
        );
        checkedOutAt = now.toISOString();
        await tx
          .update(attendanceSessions)
          .set({
            status: "CLOSED",
            checkedOutAt: now,
            calculatedDurationMinutes: durationMinutes,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(attendanceSessions.id, attendanceSessionId));
      }

      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: `attendance.${params.input.action.toLowerCase()}`,
          targetType: "attendance_session",
          targetId: attendanceSessionId,
          after: {
            businessDate,
            eventId: event.id,
            eventType: params.input.action,
            locationId: geofence.nearest.id,
            geofenceResult: "INSIDE",
            distanceMeters: Math.round(geofence.nearest.distanceMeters),
            accuracyMeters: Math.round(params.input.position.accuracyMeters),
          },
          result: "SUCCESS",
          deviceMetadata: params.input.deviceMetadata,
        },
        tx,
      );

      return {
        resultType: "attendance_event",
        resultId: event.id,
        response: {
          eventId: event.id,
          attendanceSessionId,
          action: params.input.action,
          businessDate,
          serverTime: now.toISOString(),
          checkedOutAt,
          durationMinutes,
          selfieFileId: params.input.selfieFileId,
        },
      };
    },
  );
}

export async function getAttendanceReport(params: {
  session: StaffSession;
  propertyId: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
  page?: number;
  pageSize?: number;
  search?: string;
  exportAll?: boolean;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "attendance.report.view",
  );
  const currentBusinessDate = getBusinessDate(params.now ?? new Date());
  const range = reportDateRange(params.startDate, params.endDate, params.now);
  const search = params.search?.trim().slice(0, 120) ?? "";
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.exportAll ? 100_000 : (params.pageSize ?? 25);
  const offset = params.exportAll ? 0 : (page - 1) * pageSize;
  type MetricsRow = {
    activeEmployees: string;
    present: string;
    working: string;
    missingCheckout: string;
    needsReview: string;
  };
  type AttendanceReportRow = {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    sessionId: string;
    businessDate: string;
    status: string;
    checkedInAt: Date | string | null;
    checkedOutAt: Date | string | null;
    durationMinutes: number | null;
    locationName: string | null;
    geofenceResult: string | null;
  };
  const database = getDatabase();
  const [metricsResult, countResult, rowsResult] = await Promise.all([
    database.execute<MetricsRow>(sql`
      select
        (select count(*) from employee_profiles ep
          where ep.property_id = ${params.propertyId}
            and ep.employment_status = 'ACTIVE')::text as "activeEmployees",
        count(distinct s.employee_id)::text as present,
        count(*) filter (where s.status = 'OPEN'
          and s.business_date = ${currentBusinessDate})::text as working,
        count(*) filter (where s.status = 'OPEN'
          and s.business_date <> ${currentBusinessDate})::text as "missingCheckout",
        count(*) filter (where (s.status = 'OPEN'
          and s.business_date <> ${currentBusinessDate})
          or coalesce(s.exception_flags, '{}'::jsonb) <> '{}'::jsonb)::text as "needsReview"
      from attendance_sessions s
      join employee_profiles ep on ep.id = s.employee_id
      where ep.property_id = ${params.propertyId}
        and ep.employment_status = 'ACTIVE'
        and s.business_date between ${range.start} and ${range.end}
        and s.status <> 'VOIDED'
    `),
    database.execute<{ total: string }>(sql`
      select count(*)::text as total
      from attendance_sessions s
      join employee_profiles ep on ep.id = s.employee_id
      where ep.property_id = ${params.propertyId}
        and ep.employment_status = 'ACTIVE'
        and s.business_date between ${range.start} and ${range.end}
        and s.status <> 'VOIDED'
        and (${search} = '' or ep.display_name ilike ${`%${search}%`}
          or ep.employee_code ilike ${`%${search}%`})
    `),
    database.execute<AttendanceReportRow>(sql`
      select ep.id as "employeeId", ep.employee_code as "employeeCode",
        ep.display_name as "employeeName", s.id as "sessionId",
        s.business_date as "businessDate", s.status,
        s.checked_in_at as "checkedInAt", s.checked_out_at as "checkedOutAt",
        s.calculated_duration_minutes as "durationMinutes",
        checkin.location_name as "locationName",
        checkin.geofence_result as "geofenceResult"
      from attendance_sessions s
      join employee_profiles ep on ep.id = s.employee_id
      left join lateral (
        select location.name as location_name, event.geofence_result
        from attendance_events event
        left join attendance_locations location
          on location.id = event.attendance_location_id
        where event.attendance_session_id = s.id
          and event.event_type = 'CHECK_IN'
        order by event.server_time asc
        limit 1
      ) checkin on true
      where ep.property_id = ${params.propertyId}
        and ep.employment_status = 'ACTIVE'
        and s.business_date between ${range.start} and ${range.end}
        and s.status <> 'VOIDED'
        and (${search} = '' or ep.display_name ilike ${`%${search}%`}
          or ep.employee_code ilike ${`%${search}%`})
      order by s.business_date desc, ep.display_name asc, s.id desc
      limit ${pageSize} offset ${offset}
    `),
  ]);
  const metric = metricsResult.rows[0];
  const totalItems = Number(countResult.rows[0]?.total ?? 0);

  return {
    range,
    metrics: {
      activeEmployees: Number(metric?.activeEmployees ?? 0),
      present: Number(metric?.present ?? 0),
      working: Number(metric?.working ?? 0),
      missingCheckout: Number(metric?.missingCheckout ?? 0),
      needsReview: Number(metric?.needsReview ?? 0),
    },
    pagination: paginationMeta(
      params.exportAll ? 1 : page,
      pageSize,
      totalItems,
    ),
    rows: rowsResult.rows.map((record) => {
      const rowStatus =
        record.status === "OPEN"
          ? record.businessDate === currentBusinessDate
            ? "Sedang bekerja"
            : "Belum checkout"
          : record.status === "CLOSED"
            ? "Lengkap"
            : "Perlu diperiksa";
      return {
        employeeId: record.employeeId,
        employeeCode: record.employeeCode,
        employeeName: record.employeeName,
        businessDate: record.businessDate,
        checkedInAt: databaseTimestampIso(record.checkedInAt),
        checkedOutAt: databaseTimestampIso(record.checkedOutAt),
        durationMinutes: record.durationMinutes,
        locationName: record.locationName ?? "—",
        geofenceResult: record.geofenceResult ?? "—",
        status: rowStatus,
      };
    }),
  };
}
