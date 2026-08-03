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

import {
  appendOnlyColumns,
  businessDate,
  currency,
  id,
  locale,
  metadata,
  money,
  quantity,
  status,
  trackedColumns,
  utcTimestamp,
} from "./common";
import {
  documentProfileVersions,
  paymentInstructionVersions,
  taxProfileVersions,
} from "./configuration";
import { users } from "./identity";
import { guests, reservationRooms, reservations } from "./lodging";
import { roomUnits } from "./lodging-master";
import { properties } from "./property";
import { storedFiles } from "./system";

export const folios = pgTable(
  "folios",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    currency: currency().notNull().default("IDR"),
    status: status().notNull().default("OPEN"),
    closedAt: utcTimestamp("closed_at"),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_folios_reservation").on(table.reservationId),
    check("ck_folio_currency", sql`${table.currency} = 'IDR'`),
    check("ck_folio_status", sql`${table.status} in ('OPEN', 'CLOSED')`),
  ],
);

export const folioBillingBuckets = pgTable(
  "folio_billing_buckets",
  {
    id: id(),
    folioId: uuid("folio_id").notNull().references(() => folios.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    payerGuestId: uuid("payer_guest_id").references(() => guests.id, { onDelete: "restrict" }),
    billingDetails: metadata("billing_details"),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_folio_billing_bucket_code").on(table.folioId, table.code)],
);

export const folioEntries = pgTable(
  "folio_entries",
  {
    id: id(),
    folioId: uuid("folio_id").notNull().references(() => folios.id, { onDelete: "restrict" }),
    billingBucketId: uuid("billing_bucket_id").references(() => folioBillingBuckets.id, { onDelete: "restrict" }),
    entryType: varchar("entry_type", { length: 16 }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceLineId: uuid("source_line_id"),
    reservationRoomId: uuid("reservation_room_id").references(() => reservationRooms.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").references(() => roomUnits.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "restrict" }),
    serviceDate: businessDate("service_date").notNull(),
    quantity: quantity("quantity").notNull().default("1"),
    unitAmountIdr: money("unit_amount_idr").notNull(),
    netAmountIdr: money("net_amount_idr").notNull(),
    discountAmountIdr: money("discount_amount_idr").notNull().default("0"),
    serviceChargeAmountIdr: money("service_charge_amount_idr").notNull().default("0"),
    taxAmountIdr: money("tax_amount_idr").notNull().default("0"),
    totalAmountIdr: money("total_amount_idr").notNull(),
    currency: currency().notNull().default("IDR"),
    taxProfileVersionId: uuid("tax_profile_version_id").references(() => taxProfileVersions.id, { onDelete: "restrict" }),
    pricingSnapshot: jsonb("pricing_snapshot").$type<Record<string, unknown>>().notNull(),
    reversalOfEntryId: uuid("reversal_of_entry_id"),
    postedAt: utcTimestamp("posted_at").notNull().defaultNow(),
    postedByUserId: uuid("posted_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_folio_entries_idempotency").on(table.idempotencyKey),
    uniqueIndex("uq_folio_entry_single_reversal")
      .on(table.reversalOfEntryId)
      .where(sql`${table.reversalOfEntryId} is not null`),
    index("ix_folio_entries_folio_date").on(table.folioId, table.serviceDate, table.postedAt),
    index("ix_folio_entries_source").on(table.sourceType, table.sourceId),
    check("ck_folio_entry_type", sql`${table.entryType} in ('DEBIT', 'CREDIT')`),
    check("ck_folio_entry_currency", sql`${table.currency} = 'IDR'`),
    check("ck_folio_entry_quantity", sql`${table.quantity} > 0`),
    check("ck_folio_entry_amounts", sql`${table.unitAmountIdr} >= 0 and ${table.netAmountIdr} >= 0 and ${table.discountAmountIdr} >= 0 and ${table.serviceChargeAmountIdr} >= 0 and ${table.taxAmountIdr} >= 0 and ${table.totalAmountIdr} >= 0`),
    check("ck_folio_entry_not_self_reversal", sql`${table.reversalOfEntryId} is null or ${table.reversalOfEntryId} <> ${table.id}`),
  ],
);

export const folioStatusEvents = pgTable(
  "folio_status_events",
  {
    id: id(),
    folioId: uuid("folio_id").notNull().references(() => folios.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    reason: text("reason"),
    guardResult: metadata("guard_result"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_folio_status_events").on(table.folioId, table.createdAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    folioId: uuid("folio_id").notNull().references(() => folios.id, { onDelete: "restrict" }),
    paymentCode: varchar("payment_code", { length: 32 }).notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    amountIdr: money("amount_idr").notNull(),
    currency: currency().notNull().default("IDR"),
    status: status().notNull().default("PENDING_VERIFICATION"),
    receivedAt: utcTimestamp("received_at"),
    reference: varchar("reference", { length: 160 }),
    paymentInstructionVersionId: uuid("payment_instruction_version_id").references(() => paymentInstructionVersions.id, { onDelete: "restrict" }),
    destinationSnapshot: metadata("destination_snapshot"),
    verifiedAt: utcTimestamp("verified_at"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    folioEntryId: uuid("folio_entry_id").references(() => folioEntries.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_payments_code").on(table.paymentCode),
    uniqueIndex("uq_payments_idempotency").on(table.idempotencyKey),
    uniqueIndex("uq_payments_folio_entry").on(table.folioEntryId),
    index("ix_payments_verification_queue").on(table.status, table.createdAt),
    index("ix_payments_created").on(table.createdAt),
    check("ck_payment_amount", sql`${table.amountIdr} > 0 and ${table.currency} = 'IDR'`),
    check("ck_payment_status", sql`${table.status} in ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'VOIDED')`),
    check("ck_payment_method", sql`${table.method} in ('BANK_TRANSFER', 'CASH', 'PAY_AT_CHECKIN', 'PAY_AT_CHECKOUT', 'OTHER')`),
  ],
);

export const paymentProofs = pgTable(
  "payment_proofs",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
    fileId: uuid("file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    submittedVia: varchar("submitted_via", { length: 40 }).notNull(),
    notes: text("notes"),
    ...appendOnlyColumns,
  },
  (table) => [uniqueIndex("uq_payment_proof_file").on(table.paymentId, table.fileId)],
);

export const paymentStatusEvents = pgTable(
  "payment_status_events",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_payment_status_events").on(table.paymentId, table.createdAt)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    folioId: uuid("folio_id").notNull().references(() => folios.id, { onDelete: "restrict" }),
    refundCode: varchar("refund_code", { length: 32 }).notNull(),
    amountIdr: money("amount_idr").notNull(),
    currency: currency().notNull().default("IDR"),
    status: status().notNull().default("REQUESTED"),
    reason: text("reason").notNull(),
    policySnapshot: metadata("policy_snapshot"),
    destinationCiphertext: text("destination_ciphertext").notNull(),
    destinationLast4: varchar("destination_last4", { length: 4 }),
    approvedAt: utcTimestamp("approved_at"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    refundedAt: utcTimestamp("refunded_at"),
    folioEntryId: uuid("folio_entry_id").references(() => folioEntries.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_refunds_code").on(table.refundCode),
    uniqueIndex("uq_refunds_idempotency").on(table.idempotencyKey),
    uniqueIndex("uq_refunds_folio_entry").on(table.folioEntryId),
    index("ix_refunds_queue").on(table.status, table.createdAt),
    check("ck_refund_amount", sql`${table.amountIdr} > 0 and ${table.currency} = 'IDR'`),
    check("ck_refund_status", sql`${table.status} in ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED', 'CANCELLED')`),
  ],
);

export const refundAttempts = pgTable(
  "refund_attempts",
  {
    id: id(),
    refundId: uuid("refund_id").notNull().references(() => refunds.id, { onDelete: "restrict" }),
    attemptNumber: integer("attempt_number").notNull(),
    processorUserId: uuid("processor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    startedAt: utcTimestamp("started_at").notNull(),
    completedAt: utcTimestamp("completed_at"),
    result: status("result").notNull(),
    transferReference: varchar("transfer_reference", { length: 160 }),
    proofFileId: uuid("proof_file_id").references(() => storedFiles.id, { onDelete: "restrict" }),
    failureReason: text("failure_reason"),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_refund_attempt_number").on(table.refundId, table.attemptNumber),
    check("ck_refund_attempt_number", sql`${table.attemptNumber} > 0`),
  ],
);

export const refundStatusEvents = pgTable(
  "refund_status_events",
  {
    id: id(),
    refundId: uuid("refund_id").notNull().references(() => refunds.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_refund_status_events").on(table.refundId, table.createdAt)],
);

export const financialDocuments = pgTable(
  "financial_documents",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    folioId: uuid("folio_id").notNull().references(() => folios.id, { onDelete: "restrict" }),
    documentType: varchar("document_type", { length: 40 }).notNull(),
    documentNumber: varchar("document_number", { length: 80 }),
    status: status().notNull().default("DRAFT"),
    recipientName: varchar("recipient_name", { length: 200 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 320 }),
    language: locale("language").notNull().default("id"),
    currency: currency().notNull().default("IDR"),
    issuedAt: utcTimestamp("issued_at"),
    issuedByUserId: uuid("issued_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_financial_document_number")
      .on(table.propertyId, table.documentType, table.documentNumber)
      .where(sql`${table.documentNumber} is not null`),
    index("ix_financial_documents_folio").on(table.folioId, table.documentType, table.status),
    check("ck_financial_document_type", sql`${table.documentType} in ('PROFORMA', 'INVOICE', 'RECEIPT', 'REFUND_NOTE', 'FOLIO_STATEMENT')`),
    check("ck_financial_document_status", sql`${table.status} in ('DRAFT', 'ISSUED', 'VOIDED', 'SUPERSEDED')`),
    check("ck_financial_document_language", sql`${table.language} in ('id', 'en') and ${table.currency} = 'IDR'`),
  ],
);

export const financialDocumentVersions = pgTable(
  "financial_document_versions",
  {
    id: id(),
    documentId: uuid("document_id").notNull().references(() => financialDocuments.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    documentProfileVersionId: uuid("document_profile_version_id").notNull().references(() => documentProfileVersions.id, { onDelete: "restrict" }),
    renderedFileId: uuid("rendered_file_id").references(() => storedFiles.id, { onDelete: "restrict" }),
    subtotalIdr: money("subtotal_idr").notNull(),
    discountIdr: money("discount_idr").notNull().default("0"),
    serviceChargeIdr: money("service_charge_idr").notNull().default("0"),
    taxIdr: money("tax_idr").notNull().default("0"),
    totalIdr: money("total_idr").notNull(),
    renderedSnapshot: jsonb("rendered_snapshot").$type<Record<string, unknown>>().notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    createdAt: utcTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_financial_document_versions").on(table.documentId, table.versionNumber),
    check("ck_financial_document_version_amounts", sql`${table.subtotalIdr} >= 0 and ${table.discountIdr} >= 0 and ${table.serviceChargeIdr} >= 0 and ${table.taxIdr} >= 0 and ${table.totalIdr} >= 0`),
  ],
);

export const documentEntryCoverage = pgTable(
  "document_entry_coverage",
  {
    id: id(),
    documentVersionId: uuid("document_version_id").notNull().references(() => financialDocumentVersions.id, { onDelete: "restrict" }),
    folioEntryId: uuid("folio_entry_id").notNull().references(() => folioEntries.id, { onDelete: "restrict" }),
    coveredAmountIdr: money("covered_amount_idr").notNull(),
    activeFinalCoverage: status("active_final_coverage").notNull().default("NO"),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_document_entry_coverage_version").on(table.documentVersionId, table.folioEntryId),
    uniqueIndex("uq_document_entry_active_final")
      .on(table.folioEntryId)
      .where(sql`${table.activeFinalCoverage} = 'YES'`),
    check("ck_document_entry_coverage_amount", sql`${table.coveredAmountIdr} >= 0`),
    check("ck_document_entry_final", sql`${table.activeFinalCoverage} in ('YES', 'NO')`),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
    documentId: uuid("document_id").notNull().references(() => financialDocuments.id, { onDelete: "restrict" }),
    amountIdr: money("amount_idr").notNull(),
    allocatedAt: utcTimestamp("allocated_at").notNull().defaultNow(),
    allocatedByUserId: uuid("allocated_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    reversalOfAllocationId: uuid("reversal_of_allocation_id"),
    ...appendOnlyColumns,
  },
  (table) => [
    index("ix_payment_allocations_payment").on(table.paymentId),
    index("ix_payment_allocations_document").on(table.documentId),
    check("ck_payment_allocation_amount", sql`${table.amountIdr} > 0`),
    check("ck_payment_allocation_not_self", sql`${table.reversalOfAllocationId} is null or ${table.reversalOfAllocationId} <> ${table.id}`),
  ],
);
