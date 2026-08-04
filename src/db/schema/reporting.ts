import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { businessDate, id, status, trackedColumns, utcTimestamp } from "./common";
import { users } from "./identity";
import { properties } from "./property";

/**
 * A durable work queue for detected inconsistencies. This stores the
 * exception and its handling state, never a replacement balance or a
 * second copy of authoritative reservation/folio/inventory data.
 */
export const reconciliationExceptions = pgTable(
  "reconciliation_exceptions",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    businessDate: businessDate("business_date"),
    checkCode: varchar("check_code", { length: 80 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 200 }).notNull(),
    severity: status("severity").notNull(),
    status: status().notNull().default("OPEN"),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    detectedAt: utcTimestamp("detected_at").notNull().defaultNow(),
    lastDetectedAt: utcTimestamp("last_detected_at").notNull().defaultNow(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    acknowledgedAt: utcTimestamp("acknowledged_at"),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
      { onDelete: "restrict" },
    ),
    resolvedAt: utcTimestamp("resolved_at"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    resolutionReason: text("resolution_reason"),
    resolutionReference: varchar("resolution_reference", { length: 200 }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_reconciliation_exception_fingerprint").on(
      table.propertyId,
      table.fingerprint,
    ),
    index("ix_reconciliation_exception_queue").on(
      table.propertyId,
      table.status,
      table.severity,
      table.lastDetectedAt,
    ),
    index("ix_reconciliation_exception_check").on(
      table.propertyId,
      table.checkCode,
      table.businessDate,
    ),
    check(
      "ck_reconciliation_exception_severity",
      sql`${table.severity} in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`,
    ),
    check(
      "ck_reconciliation_exception_status",
      sql`${table.status} in ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'ACCEPTED_WITH_REASON')`,
    ),
    check(
      "ck_reconciliation_exception_occurrence",
      sql`${table.occurrenceCount} > 0`,
    ),
    check(
      "ck_reconciliation_exception_resolution",
      sql`${table.status} not in ('RESOLVED', 'ACCEPTED_WITH_REASON') or (${table.resolvedAt} is not null and ${table.resolvedByUserId} is not null and btrim(${table.resolutionReason}) <> '')`,
    ),
  ],
);

/** Metadata for an authenticated, permission-checked report download. */
export const reportExports = pgTable(
  "report_exports",
  {
    id: id(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    reportCode: varchar("report_code", { length: 80 }).notNull(),
    format: varchar("format", { length: 16 }).notNull().default("XLSX"),
    status: status().notNull().default("GENERATED"),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Asia/Jakarta"),
    metricVersion: varchar("metric_version", { length: 32 }).notNull(),
    dataAsOf: utcTimestamp("data_as_of").notNull(),
    generatedAt: utcTimestamp("generated_at").notNull().defaultNow(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    rowCount: integer("row_count").notNull(),
    generatedByUserId: uuid("generated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_report_export_idempotency").on(
      table.propertyId,
      table.idempotencyKey,
    ),
    index("ix_report_export_history").on(
      table.propertyId,
      table.generatedAt,
      table.reportCode,
    ),
    check("ck_report_export_format", sql`${table.format} in ('CSV', 'XLSX')`),
    check(
      "ck_report_export_status",
      sql`${table.status} in ('GENERATED', 'DOWNLOADED', 'EXPIRED')`,
    ),
    check("ck_report_export_rows", sql`${table.rowCount} >= 0`),
    check("ck_report_export_expiry", sql`${table.expiresAt} > ${table.generatedAt}`),
  ],
);
