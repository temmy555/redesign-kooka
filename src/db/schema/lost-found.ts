import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { appendOnlyColumns, id, metadata, status, trackedColumns, utcTimestamp } from "./common";
import { guests, reservations, roomStays } from "./lodging";
import { roomUnits } from "./lodging-master";
import { users } from "./identity";
import { properties } from "./property";
import { storedFiles } from "./system";

export const lostFoundItems = pgTable(
  "lost_found_items",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    itemCode: varchar("item_code", { length: 32 }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    description: text("description").notNull(),
    foundAt: utcTimestamp("found_at").notNull(),
    foundLocation: varchar("found_location", { length: 160 }).notNull(),
    roomUnitId: uuid("room_unit_id").references(() => roomUnits.id, { onDelete: "restrict" }),
    roomStayId: uuid("room_stay_id").references(() => roomStays.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "restrict" }),
    status: status().notNull().default("FOUND"),
    storageLocation: varchar("storage_location", { length: 160 }),
    sealReference: varchar("seal_reference", { length: 80 }),
    highValue: status("high_value").notNull().default("NO"),
    retentionDueAt: utcTimestamp("retention_due_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_lost_found_item_code").on(table.itemCode),
    index("ix_lost_found_queue").on(table.propertyId, table.status, table.retentionDueAt),
    check("ck_lost_found_item_status", sql`${table.status} in ('FOUND', 'STORED', 'CLAIM_PENDING', 'CLAIMED', 'RETURNED', 'SHIPPED', 'DISPOSED', 'TRANSFERRED_TO_AUTHORITY')`),
    check("ck_lost_found_high_value", sql`${table.highValue} in ('YES', 'NO')`),
  ],
);

export const lostFoundEvidence = pgTable(
  "lost_found_evidence",
  {
    itemId: uuid("item_id").notNull().references(() => lostFoundItems.id, { onDelete: "restrict" }),
    fileId: uuid("file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    evidenceType: varchar("evidence_type", { length: 48 }).notNull(),
    notes: text("notes"),
    ...appendOnlyColumns,
  },
  (table) => [uniqueIndex("uq_lost_found_evidence").on(table.itemId, table.fileId)],
);

export const lostFoundClaims = pgTable(
  "lost_found_claims",
  {
    id: id(),
    itemId: uuid("item_id").notNull().references(() => lostFoundItems.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "restrict" }),
    claimantName: varchar("claimant_name", { length: 200 }).notNull(),
    claimantContactCiphertext: text("claimant_contact_ciphertext").notNull(),
    verificationDetails: metadata("verification_details").notNull(),
    status: status().notNull().default("PENDING"),
    decisionReason: text("decision_reason"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    decidedAt: utcTimestamp("decided_at"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_lost_found_claim_queue").on(table.status, table.createdAt),
    check("ck_lost_found_claim_status", sql`${table.status} in ('PENDING', 'VERIFIED', 'REJECTED', 'CANCELLED')`),
  ],
);

export const lostFoundCustodyEvents = pgTable(
  "lost_found_custody_events",
  {
    id: id(),
    itemId: uuid("item_id").notNull().references(() => lostFoundItems.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromLocation: varchar("from_location", { length: 160 }),
    toLocation: varchar("to_location", { length: 160 }),
    handedByUserId: uuid("handed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    receivedByUserId: uuid("received_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"),
    evidenceFileId: uuid("evidence_file_id").references(() => storedFiles.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_lost_found_custody_item").on(table.itemId, table.createdAt)],
);
