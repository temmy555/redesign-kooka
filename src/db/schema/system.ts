import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { appendOnlyColumns, id, metadata, status, trackedColumns, utcTimestamp } from "./common";
import { users } from "./identity";
import { properties } from "./property";

export const storedFiles = pgTable(
  "stored_files",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    originalName: varchar("original_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    classification: status("classification").notNull(),
    purpose: varchar("purpose", { length: 80 }).notNull(),
    scanStatus: status("scan_status").notNull().default("PENDING"),
    retentionCategory: varchar("retention_category", { length: 80 }).notNull(),
    purgedAt: utcTimestamp("purged_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_stored_files_storage_key").on(table.storageKey),
    index("ix_stored_files_retention").on(table.retentionCategory, table.createdAt, table.purgedAt),
    check("ck_stored_files_size", sql`${table.byteSize} >= 0`),
    check("ck_stored_files_scan", sql`${table.scanStatus} in ('PENDING', 'CLEAN', 'REJECTED', 'FAILED')`),
  ],
);

export const fileAccessEvents = pgTable(
  "file_access_events",
  {
    id: id(),
    fileId: uuid("file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 40 }).notNull(),
    result: status("result").notNull(),
    reason: text("reason"),
    requestId: varchar("request_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    deviceMetadata: metadata("device_metadata"),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_file_access_file_time").on(table.fileId, table.createdAt)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    actorType: varchar("actor_type", { length: 24 }).notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: uuid("target_id"),
    beforeJson: jsonb("before_json").$type<Record<string, unknown>>(),
    afterJson: jsonb("after_json").$type<Record<string, unknown>>(),
    reason: text("reason"),
    result: status("result").notNull(),
    requestId: varchar("request_id", { length: 100 }),
    correlationId: varchar("correlation_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    deviceMetadata: metadata("device_metadata"),
    ...appendOnlyColumns,
  },
  (table) => [
    index("ix_audit_target_time").on(table.targetType, table.targetId, table.createdAt),
    index("ix_audit_actor_time").on(table.actorUserId, table.createdAt),
    index("ix_audit_property_created").on(table.propertyId, table.createdAt),
    index("ix_audit_correlation").on(table.correlationId),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: id(),
    scope: varchar("scope", { length: 100 }).notNull(),
    key: varchar("key", { length: 160 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "restrict" }),
    status: status().notNull().default("PROCESSING"),
    resultType: varchar("result_type", { length: 80 }),
    resultId: uuid("result_id"),
    responseSnapshot: metadata("response_snapshot"),
    expiresAt: utcTimestamp("expires_at").notNull(),
    completedAt: utcTimestamp("completed_at"),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_idempotency_scope_key").on(table.scope, table.key),
    index("ix_idempotency_expiry").on(table.expiresAt),
    check("ck_idempotency_status", sql`${table.status} in ('PROCESSING', 'COMPLETED', 'FAILED')`),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: id(),
    topic: varchar("topic", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: status().notNull().default("PENDING"),
    availableAt: utcTimestamp("available_at").notNull().defaultNow(),
    lockedAt: utcTimestamp("locked_at"),
    lockedBy: varchar("locked_by", { length: 120 }),
    attempts: bigint("attempts", { mode: "number" }).notNull().default(0),
    processedAt: utcTimestamp("processed_at"),
    lastError: text("last_error"),
    ...appendOnlyColumns,
  },
  (table) => [
    index("ix_outbox_pending").on(table.status, table.availableAt),
    index("ix_outbox_lease").on(table.status, table.lockedAt),
    check(
      "ck_outbox_status",
      sql`${table.status} in ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER')`,
    ),
  ],
);

export const jobExecutions = pgTable(
  "job_executions",
  {
    id: id(),
    jobName: varchar("job_name", { length: 120 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    status: status().notNull(),
    startedAt: utcTimestamp("started_at").notNull(),
    finishedAt: utcTimestamp("finished_at"),
    checkpoint: metadata("checkpoint"),
    result: metadata("result"),
    error: text("error"),
    ...appendOnlyColumns,
  },
  (table) => [uniqueIndex("uq_job_execution_key").on(table.jobName, table.idempotencyKey)],
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: id(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    category: varchar("category", { length: 80 }).notNull(),
    severity: status("severity").notNull(),
    result: status("result").notNull(),
    reviewStatus: status("review_status").notNull().default("OPEN"),
    targetType: varchar("target_type", { length: 80 }),
    targetId: uuid("target_id"),
    details: metadata("details"),
    reviewedAt: utcTimestamp("reviewed_at"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_security_review").on(table.reviewStatus, table.severity, table.createdAt)],
);
