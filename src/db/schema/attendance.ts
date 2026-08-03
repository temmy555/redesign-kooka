import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  time,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  appendOnlyColumns,
  businessDate,
  id,
  metadata,
  status,
  trackedColumns,
  utcTimestamp,
} from "./common";
import { employeeProfiles, users } from "./identity";
import { properties } from "./property";
import { storedFiles } from "./system";

export const attendanceLocations = pgTable(
  "attendance_locations",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    radiusMeters: integer("radius_meters").notNull(),
    maximumAccuracyMeters: integer("maximum_accuracy_meters").notNull(),
    effectiveFrom: utcTimestamp("effective_from").notNull().defaultNow(),
    effectiveTo: utcTimestamp("effective_to"),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_attendance_locations_code").on(table.propertyId, table.code),
    index("ix_attendance_locations_effective").on(
      table.propertyId,
      table.status,
      table.effectiveFrom,
    ),
    check("ck_attendance_location_coordinates", sql`${table.latitude} between -90 and 90 and ${table.longitude} between -180 and 180`),
    check("ck_attendance_location_radius", sql`${table.radiusMeters} > 0 and ${table.maximumAccuracyMeters} > 0`),
    check("ck_attendance_location_status", sql`${table.status} in ('ACTIVE', 'INACTIVE')`),
    check("ck_attendance_location_effective_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const shiftTemplates = pgTable(
  "shift_templates",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Jakarta"),
    checkinWindowBeforeMinutes: integer("checkin_window_before_minutes").notNull().default(0),
    checkinWindowAfterMinutes: integer("checkin_window_after_minutes").notNull().default(0),
    lateToleranceMinutes: integer("late_tolerance_minutes").notNull().default(0),
    crossesMidnight: status("crosses_midnight").notNull().default("NO"),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_shift_templates_code").on(table.propertyId, table.code),
    check("ck_shift_template_windows", sql`${table.checkinWindowBeforeMinutes} >= 0 and ${table.checkinWindowAfterMinutes} >= 0 and ${table.lateToleranceMinutes} >= 0`),
    check("ck_shift_template_crosses_midnight", sql`${table.crossesMidnight} in ('YES', 'NO')`),
  ],
);

export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: id(),
    employeeId: uuid("employee_id").notNull().references(() => employeeProfiles.id, { onDelete: "restrict" }),
    businessDate: businessDate("business_date").notNull(),
    shiftTemplateId: uuid("shift_template_id").notNull().references(() => shiftTemplates.id, { onDelete: "restrict" }),
    attendanceLocationId: uuid("attendance_location_id").references(() => attendanceLocations.id, { onDelete: "restrict" }),
    status: status().notNull().default("ASSIGNED"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_shift_assignment_employee_date").on(table.employeeId, table.businessDate),
    index("ix_shift_assignments_date").on(table.businessDate, table.status),
  ],
);

export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: id(),
    employeeId: uuid("employee_id").notNull().references(() => employeeProfiles.id, { onDelete: "restrict" }),
    mode: status("mode").notNull(),
    businessDate: businessDate("business_date").notNull(),
    shiftAssignmentId: uuid("shift_assignment_id").references(() => shiftAssignments.id, { onDelete: "restrict" }),
    status: status().notNull().default("OPEN"),
    checkedInAt: utcTimestamp("checked_in_at").notNull(),
    checkedOutAt: utcTimestamp("checked_out_at"),
    calculatedDurationMinutes: integer("calculated_duration_minutes"),
    exceptionFlags: metadata("exception_flags"),
    correctedAt: utcTimestamp("corrected_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_attendance_session_open")
      .on(table.employeeId)
      .where(sql`${table.status} = 'OPEN'`),
    index("ix_attendance_sessions_history").on(table.employeeId, table.businessDate),
    index("ix_attendance_sessions_daily").on(table.businessDate, table.status),
    check("ck_attendance_session_mode", sql`${table.mode} in ('SHIFT', 'FREE')`),
    check("ck_attendance_session_status", sql`${table.status} in ('OPEN', 'CLOSED', 'CORRECTED', 'VOIDED')`),
    check("ck_attendance_session_shift", sql`${table.mode} <> 'SHIFT' or ${table.shiftAssignmentId} is not null`),
    check("ck_attendance_session_time", sql`${table.checkedOutAt} is null or ${table.checkedOutAt} >= ${table.checkedInAt}`),
  ],
);

export const attendanceEvents = pgTable(
  "attendance_events",
  {
    id: id(),
    attendanceSessionId: uuid("attendance_session_id").notNull().references(() => attendanceSessions.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id").notNull().references(() => employeeProfiles.id, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 24 }).notNull(),
    serverTime: utcTimestamp("server_time").notNull().defaultNow(),
    deviceTime: utcTimestamp("device_time"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    accuracyMeters: doublePrecision("accuracy_meters").notNull(),
    attendanceLocationId: uuid("attendance_location_id").references(() => attendanceLocations.id, { onDelete: "restrict" }),
    distanceMeters: doublePrecision("distance_meters"),
    geofenceResult: status("geofence_result").notNull(),
    selfieFileId: uuid("selfie_file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    eventStatus: status("event_status").notNull().default("ACCEPTED"),
    deviceMetadata: metadata("device_metadata"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_attendance_event_idempotency").on(table.employeeId, table.idempotencyKey),
    index("ix_attendance_events_session").on(table.attendanceSessionId, table.serverTime),
    check("ck_attendance_event_type", sql`${table.eventType} in ('CHECK_IN', 'CHECK_OUT')`),
    check("ck_attendance_event_coordinates", sql`${table.latitude} between -90 and 90 and ${table.longitude} between -180 and 180 and ${table.accuracyMeters} >= 0`),
    check("ck_attendance_event_geofence", sql`${table.geofenceResult} in ('INSIDE', 'OUTSIDE', 'ACCURACY_REJECTED')`),
  ],
);

export const attendanceCorrections = pgTable(
  "attendance_corrections",
  {
    id: id(),
    attendanceSessionId: uuid("attendance_session_id").notNull().references(() => attendanceSessions.id, { onDelete: "restrict" }),
    targetEventId: uuid("target_event_id").references(() => attendanceEvents.id, { onDelete: "restrict" }),
    correctionType: varchar("correction_type", { length: 64 }).notNull(),
    beforeSnapshot: metadata("before_snapshot").notNull(),
    afterSnapshot: metadata("after_snapshot").notNull(),
    reason: text("reason").notNull(),
    correctedByUserId: uuid("corrected_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    correctedAt: utcTimestamp("corrected_at").notNull().defaultNow(),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_attendance_corrections_session").on(table.attendanceSessionId, table.correctedAt)],
);
