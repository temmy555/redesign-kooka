import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  appendOnlyColumns,
  businessDate,
  id,
  metadata,
  money,
  status,
  trackedColumns,
  utcTimestamp,
} from "./common";
import { policyVersions, taxProfileVersions } from "./configuration";
import { folioEntries } from "./finance";
import { employeeProfiles, users } from "./identity";
import {
  guests,
  reservations,
  reservationRooms,
  roomMoves,
  roomStays,
} from "./lodging";
import { roomUnits } from "./lodging-master";
import { properties } from "./property";
import { storedFiles } from "./system";

export const checkinRegistrations = pgTable(
  "checkin_registrations",
  {
    id: id(),
    roomStayId: uuid("room_stay_id").notNull().references(() => roomStays.id, { onDelete: "restrict" }),
    status: status().notNull().default("NOT_STARTED"),
    purposePolicyVersionId: uuid("purpose_policy_version_id").references(() => policyVersions.id, { onDelete: "restrict" }),
    operatedByUserId: uuid("operated_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    completedAt: utcTimestamp("completed_at"),
    skippedAt: utcTimestamp("skipped_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_checkin_registration_stay").on(table.roomStayId),
    check("ck_checkin_registration_status", sql`${table.status} in ('NOT_STARTED', 'PARTIAL', 'COMPLETE', 'SKIPPED')`),
  ],
);

export const checkinCaptureItems = pgTable(
  "checkin_capture_items",
  {
    id: id(),
    registrationId: uuid("registration_id").notNull().references(() => checkinRegistrations.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "restrict" }),
    captureType: varchar("capture_type", { length: 48 }).notNull(),
    outcome: status("outcome").notNull(),
    fileId: uuid("file_id").references(() => storedFiles.id, { onDelete: "restrict" }),
    capturedAt: utcTimestamp("captured_at"),
    declineOrSkipReason: text("decline_or_skip_reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_checkin_capture_type_guest").on(table.registrationId, table.guestId, table.captureType),
    check("ck_checkin_capture_type", sql`${table.captureType} in ('IDENTITY_DOCUMENT', 'GUEST_PHOTO', 'SIGNATURE')`),
    check("ck_checkin_capture_outcome", sql`${table.outcome} in ('CAPTURED', 'DECLINED', 'SKIPPED', 'FAILED')`),
    check("ck_checkin_capture_file", sql`(${table.outcome} = 'CAPTURED' and ${table.fileId} is not null) or (${table.outcome} <> 'CAPTURED')`),
  ],
);

export const guestIdentityDetails = pgTable(
  "guest_identity_details",
  {
    id: id(),
    registrationId: uuid("registration_id").notNull().references(() => checkinRegistrations.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").notNull().references(() => guests.id, { onDelete: "restrict" }),
    identityType: varchar("identity_type", { length: 40 }),
    identityNumberCiphertext: text("identity_number_ciphertext"),
    identityNumberLast4: varchar("identity_number_last4", { length: 4 }),
    nameOnIdentityCiphertext: text("name_on_identity_ciphertext"),
    expiresOnCiphertext: text("expires_on_ciphertext"),
    purgedAt: utcTimestamp("purged_at"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_guest_identity_registration_guest").on(table.registrationId, table.guestId)],
);

export const policyAcknowledgements = pgTable(
  "policy_acknowledgements",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    roomStayId: uuid("room_stay_id").references(() => roomStays.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "restrict" }),
    policyVersionId: uuid("policy_version_id").notNull().references(() => policyVersions.id, { onDelete: "restrict" }),
    language: varchar("language", { length: 8 }).notNull(),
    channel: varchar("channel", { length: 40 }).notNull(),
    outcome: status("outcome").notNull(),
    acknowledgedAt: utcTimestamp("acknowledged_at").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [
    index("ix_policy_ack_reservation").on(table.reservationId, table.policyVersionId),
    check("ck_policy_ack_language", sql`${table.language} in ('id', 'en')`),
    check("ck_policy_ack_outcome", sql`${table.outcome} in ('ACCEPTED', 'DECLINED', 'PROVIDED', 'SKIPPED')`),
  ],
);

export const cleaningTasks = pgTable(
  "cleaning_tasks",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").references(() => roomUnits.id, { onDelete: "restrict" }),
    roomStayId: uuid("room_stay_id").references(() => roomStays.id, { onDelete: "restrict" }),
    roomMoveId: uuid("room_move_id").references(() => roomMoves.id, { onDelete: "restrict" }),
    publicArea: varchar("public_area", { length: 120 }),
    taskType: varchar("task_type", { length: 64 }).notNull(),
    priority: status("priority").notNull().default("NORMAL"),
    status: status().notNull().default("REQUESTED"),
    requestedAt: utcTimestamp("requested_at").notNull().defaultNow(),
    targetAt: utcTimestamp("target_at"),
    requestedEntryPermission: status("requested_entry_permission"),
    assigneeEmployeeId: uuid("assignee_employee_id").references(() => employeeProfiles.id, { onDelete: "restrict" }),
    notes: text("notes"),
    completedAt: utcTimestamp("completed_at"),
    inspectedAt: utcTimestamp("inspected_at"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_cleaning_tasks_queue").on(table.propertyId, table.status, table.priority, table.targetAt),
    index("ix_cleaning_tasks_room").on(table.roomUnitId, table.status),
    check("ck_cleaning_task_target", sql`${table.roomUnitId} is not null or ${table.publicArea} is not null`),
    check("ck_cleaning_task_status", sql`${table.status} in ('REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'INSPECTED', 'DEFERRED', 'UNABLE_TO_ACCESS', 'CANCELLED')`),
    check("ck_cleaning_priority", sql`${table.priority} in ('LOW', 'NORMAL', 'HIGH', 'URGENT')`),
  ],
);

export const cleaningTaskEvents = pgTable(
  "cleaning_task_events",
  {
    id: id(),
    cleaningTaskId: uuid("cleaning_task_id").notNull().references(() => cleaningTasks.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    reasonCode: varchar("reason_code", { length: 64 }),
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_cleaning_task_events").on(table.cleaningTaskId, table.createdAt)],
);

export const maintenanceIssues = pgTable(
  "maintenance_issues",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").references(() => roomUnits.id, { onDelete: "restrict" }),
    publicArea: varchar("public_area", { length: 120 }),
    category: varchar("category", { length: 64 }).notNull(),
    severity: status("severity").notNull(),
    status: status().notNull().default("REPORTED"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    serviceabilityImpact: status("serviceability_impact").notNull().default("NONE"),
    reportedByUserId: uuid("reported_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    resolvedAt: utcTimestamp("resolved_at"),
    verifiedAt: utcTimestamp("verified_at"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_maintenance_issue_queue").on(table.propertyId, table.status, table.severity),
    check("ck_maintenance_target", sql`${table.roomUnitId} is not null or ${table.publicArea} is not null`),
    check("ck_maintenance_status", sql`${table.status} in ('REPORTED', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'REOPENED', 'CANCELLED')`),
    check("ck_maintenance_impact", sql`${table.serviceabilityImpact} in ('NONE', 'BLOCKED', 'OUT_OF_ORDER')`),
  ],
);

export const maintenanceIssueEvents = pgTable(
  "maintenance_issue_events",
  {
    id: id(),
    maintenanceIssueId: uuid("maintenance_issue_id").notNull().references(() => maintenanceIssues.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    notes: text("notes"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_maintenance_issue_events").on(table.maintenanceIssueId, table.createdAt)],
);

export const damageCatalogItems = pgTable(
  "damage_catalog_items",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_damage_catalog_code").on(table.propertyId, table.code)],
);

export const damageCatalogVersions = pgTable(
  "damage_catalog_versions",
  {
    id: id(),
    damageCatalogItemId: uuid("damage_catalog_item_id").notNull().references(() => damageCatalogItems.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    referencePriceIdr: money("reference_price_idr").notNull(),
    taxProfileVersionId: uuid("tax_profile_version_id").references(() => taxProfileVersions.id, { onDelete: "restrict" }),
    evidenceRule: text("evidence_rule"),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_damage_catalog_versions").on(table.damageCatalogItemId, table.versionNumber),
    check("ck_damage_catalog_price", sql`${table.referencePriceIdr} >= 0`),
    check("ck_damage_catalog_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const damageIncidents = pgTable(
  "damage_incidents",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    roomStayId: uuid("room_stay_id").references(() => roomStays.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").references(() => roomUnits.id, { onDelete: "restrict" }),
    damageCatalogVersionId: uuid("damage_catalog_version_id").references(() => damageCatalogVersions.id, { onDelete: "restrict" }),
    status: status().notNull().default("REPORTED"),
    description: text("description").notNull(),
    reportedAt: utcTimestamp("reported_at").notNull().defaultNow(),
    reportedByUserId: uuid("reported_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [index("ix_damage_incident_booking").on(table.reservationId, table.status)],
);

export const damageIncidentEvidence = pgTable(
  "damage_incident_evidence",
  {
    incidentId: uuid("incident_id").notNull().references(() => damageIncidents.id, { onDelete: "restrict" }),
    fileId: uuid("file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    notes: text("notes"),
    ...appendOnlyColumns,
  },
  (table) => [uniqueIndex("uq_damage_incident_evidence").on(table.incidentId, table.fileId)],
);

export const damageAssessments = pgTable(
  "damage_assessments",
  {
    id: id(),
    incidentId: uuid("incident_id").notNull().references(() => damageIncidents.id, { onDelete: "restrict" }),
    decision: status("decision").notNull(),
    amountIdr: money("amount_idr").notNull().default("0"),
    reason: text("reason").notNull(),
    priceTaxSnapshot: metadata("price_tax_snapshot"),
    decidedByUserId: uuid("decided_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    decidedAt: utcTimestamp("decided_at").notNull(),
    folioEntryId: uuid("folio_entry_id").references(() => folioEntries.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_damage_assessment_folio_entry").on(table.folioEntryId),
    check("ck_damage_assessment_decision", sql`${table.decision} in ('APPROVED', 'WAIVED', 'DISPUTED')`),
    check("ck_damage_assessment_amount", sql`${table.amountIdr} >= 0`),
  ],
);

export const departureClearances = pgTable(
  "departure_clearances",
  {
    id: id(),
    roomStayId: uuid("room_stay_id").notNull().references(() => roomStays.id, { onDelete: "restrict" }),
    outcome: status("outcome").notNull(),
    checkedByUserId: uuid("checked_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    checkedAt: utcTimestamp("checked_at"),
    skipOrIssueReason: text("skip_or_issue_reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_departure_clearance_stay").on(table.roomStayId),
    check("ck_departure_clearance_outcome", sql`${table.outcome} in ('NOT_STARTED', 'CLEARED', 'ISSUE_FOUND', 'SKIPPED')`),
  ],
);

export const departureClearanceItems = pgTable(
  "departure_clearance_items",
  {
    id: id(),
    departureClearanceId: uuid("departure_clearance_id").notNull().references(() => departureClearances.id, { onDelete: "restrict" }),
    itemCode: varchar("item_code", { length: 80 }).notNull(),
    result: status("result").notNull(),
    notes: text("notes"),
    sourceType: varchar("source_type", { length: 64 }),
    sourceId: uuid("source_id"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_departure_clearance_item").on(table.departureClearanceId, table.itemCode)],
);

export const guestRequests = pgTable(
  "guest_requests",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    reservationRoomId: uuid("reservation_room_id").references(() => reservationRooms.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "restrict" }),
    category: varchar("category", { length: 64 }).notNull(),
    status: status().notNull().default("REQUESTED"),
    description: text("description").notNull(),
    notGuaranteed: boolean("not_guaranteed").notNull().default(true),
    targetAt: utcTimestamp("target_at"),
    routedSourceType: varchar("routed_source_type", { length: 64 }),
    routedSourceId: uuid("routed_source_id"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_guest_request_queue").on(table.status, table.targetAt),
    check("ck_guest_request_status", sql`${table.status} in ('REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED')`),
  ],
);

export const guestRequestEvents = pgTable(
  "guest_request_events",
  {
    id: id(),
    guestRequestId: uuid("guest_request_id").notNull().references(() => guestRequests.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    notes: text("notes"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_guest_request_events").on(table.guestRequestId, table.createdAt)],
);

export const bookingAmendments = pgTable(
  "booking_amendments",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    amendmentType: varchar("amendment_type", { length: 64 }).notNull(),
    status: status().notNull().default("DRAFT"),
    targetReservationRoomId: uuid("target_reservation_room_id").references(() => reservationRooms.id, { onDelete: "restrict" }),
    beforeSnapshot: metadata("before_snapshot").notNull(),
    proposedSnapshot: metadata("proposed_snapshot").notNull(),
    deltaIdr: money("delta_idr").notNull().default("0"),
    guestConfirmationEvidence: metadata("guest_confirmation_evidence"),
    reason: text("reason").notNull(),
    appliedAt: utcTimestamp("applied_at"),
    appliedByUserId: uuid("applied_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_booking_amendment_idempotency").on(table.idempotencyKey),
    index("ix_booking_amendment_reservation").on(table.reservationId, table.status),
    check("ck_booking_amendment_status", sql`${table.status} in ('DRAFT', 'PENDING_GUEST_CONFIRMATION', 'APPLIED', 'REJECTED', 'CANCELLED')`),
  ],
);

export const bookingAmendmentEvents = pgTable(
  "booking_amendment_events",
  {
    id: id(),
    amendmentId: uuid("amendment_id").notNull().references(() => bookingAmendments.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    guardResult: metadata("guard_result"),
    notes: text("notes"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_booking_amendment_events").on(table.amendmentId, table.createdAt)],
);

export const businessDayRuns = pgTable(
  "business_day_runs",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    businessDate: businessDate("business_date").notNull(),
    runType: varchar("run_type", { length: 48 }).notNull(),
    status: status().notNull().default("RUNNING"),
    startedAt: utcTimestamp("started_at").notNull(),
    finishedAt: utcTimestamp("finished_at"),
    summary: metadata("summary"),
    error: text("error"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_business_day_run").on(table.propertyId, table.businessDate, table.runType, table.idempotencyKey),
    index("ix_business_day_runs_status").on(table.status, table.startedAt),
  ],
);
