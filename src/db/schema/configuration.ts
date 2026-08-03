import { sql } from "drizzle-orm";
import {
  boolean,
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
  currency,
  exchangeRate,
  id,
  metadata,
  status,
  trackedColumns,
  utcTimestamp,
} from "./common";
import { users } from "./identity";
import { properties } from "./property";
import { storedFiles } from "./system";

export const propertySettingSets = pgTable(
  "property_setting_sets",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_property_setting_sets_code").on(table.propertyId, table.code)],
);

export const propertySettingVersions = pgTable(
  "property_setting_versions",
  {
    id: id(),
    settingSetId: uuid("setting_set_id").notNull().references(() => propertySettingSets.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("NOT_REQUIRED"),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    values: jsonb("values").$type<Record<string, unknown>>().notNull(),
    reason: text("reason"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_property_setting_versions_number").on(table.settingSetId, table.versionNumber),
    index("ix_property_setting_versions_effective").on(table.settingSetId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_property_setting_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_property_setting_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_property_setting_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const policySets = pgTable(
  "policy_sets",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    policyType: varchar("policy_type", { length: 48 }).notNull(),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_policy_sets_code").on(table.propertyId, table.code)],
);

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: id(),
    policySetId: uuid("policy_set_id").notNull().references(() => policySets.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("PENDING"),
    titleId: varchar("title_id", { length: 200 }).notNull(),
    titleEn: varchar("title_en", { length: 200 }).notNull(),
    summaryId: text("summary_id"),
    summaryEn: text("summary_en"),
    contentId: text("content_id").notNull(),
    contentEn: text("content_en").notNull(),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_policy_versions_number").on(table.policySetId, table.versionNumber),
    index("ix_policy_versions_effective").on(table.policySetId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_policy_versions_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_policy_versions_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_policy_versions_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const taxProfiles = pgTable(
  "tax_profiles",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    domain: varchar("domain", { length: 48 }).notNull(),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_tax_profiles_code").on(table.propertyId, table.code)],
);

export const taxProfileVersions = pgTable(
  "tax_profile_versions",
  {
    id: id(),
    taxProfileId: uuid("tax_profile_id").notNull().references(() => taxProfiles.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("PENDING"),
    taxRate: exchangeRate("tax_rate").notNull().default("0"),
    serviceChargeRate: exchangeRate("service_charge_rate").notNull().default("0"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    serviceChargeInclusive: boolean("service_charge_inclusive").notNull().default(false),
    noTax: boolean("no_tax").notNull().default(false),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_tax_profile_versions_number").on(table.taxProfileId, table.versionNumber),
    index("ix_tax_profile_versions_effective").on(table.taxProfileId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_tax_profile_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_tax_profile_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_tax_profile_rates", sql`${table.taxRate} >= 0 and ${table.serviceChargeRate} >= 0`),
    check("ck_tax_profile_no_tax", sql`not ${table.noTax} or (${table.taxRate} = 0 and ${table.serviceChargeRate} = 0)`),
    check("ck_tax_profile_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const paymentInstructionSets = pgTable(
  "payment_instruction_sets",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_payment_instruction_sets_code").on(table.propertyId, table.code)],
);

export const paymentInstructionVersions = pgTable(
  "payment_instruction_versions",
  {
    id: id(),
    instructionSetId: uuid("instruction_set_id").notNull().references(() => paymentInstructionSets.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("PENDING"),
    bankName: varchar("bank_name", { length: 120 }).notNull(),
    accountHolder: varchar("account_holder", { length: 160 }).notNull(),
    accountNumberCiphertext: text("account_number_ciphertext").notNull(),
    accountNumberLast4: varchar("account_number_last4", { length: 4 }).notNull(),
    currency: currency().notNull().default("IDR"),
    instructionId: text("instruction_id").notNull(),
    instructionEn: text("instruction_en").notNull(),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_payment_instruction_versions_number").on(table.instructionSetId, table.versionNumber),
    index("ix_payment_instruction_versions_effective").on(table.instructionSetId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_payment_instruction_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_payment_instruction_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_payment_instruction_currency", sql`${table.currency} = 'IDR'`),
    check("ck_payment_instruction_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const exchangeRateSnapshots = pgTable(
  "exchange_rate_snapshots",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    baseCurrency: currency("base_currency").notNull().default("IDR"),
    quoteCurrency: currency("quote_currency").notNull(),
    rate: exchangeRate("rate").notNull(),
    source: varchar("source", { length: 120 }).notNull(),
    asOfAt: utcTimestamp("as_of_at").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    roundingRule: metadata("rounding_rule"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_exchange_rates_lookup").on(table.propertyId, table.quoteCurrency, table.asOfAt),
    uniqueIndex("uq_exchange_rate_snapshot_source_time").on(
      table.propertyId,
      table.quoteCurrency,
      table.asOfAt,
    ),
    check("ck_exchange_base", sql`${table.baseCurrency} = 'IDR'`),
    check("ck_exchange_quote", sql`${table.quoteCurrency} in ('USD', 'AUD')`),
    check("ck_exchange_rate_positive", sql`${table.rate} > 0 and ${table.expiresAt} > ${table.asOfAt}`),
  ],
);

export const documentProfiles = pgTable(
  "document_profiles",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_document_profiles_code").on(table.propertyId, table.code)],
);

export const documentProfileVersions = pgTable(
  "document_profile_versions",
  {
    id: id(),
    documentProfileId: uuid("document_profile_id").notNull().references(() => documentProfiles.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("PENDING"),
    legalName: varchar("legal_name", { length: 200 }).notNull(),
    displayName: varchar("display_name", { length: 200 }).notNull(),
    address: text("address").notNull(),
    contact: text("contact"),
    taxIdentityCiphertext: text("tax_identity_ciphertext"),
    logoFileId: uuid("logo_file_id").references(() => storedFiles.id, { onDelete: "restrict" }),
    footerId: text("footer_id"),
    footerEn: text("footer_en"),
    templateReference: varchar("template_reference", { length: 160 }).notNull(),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_document_profile_versions_number").on(table.documentProfileId, table.versionNumber),
    index("ix_document_profile_versions_effective").on(table.documentProfileId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_document_profile_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_document_profile_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_document_profile_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const documentSequences = pgTable(
  "document_sequences",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    documentType: varchar("document_type", { length: 40 }).notNull(),
    periodKey: varchar("period_key", { length: 20 }).notNull(),
    prefix: varchar("prefix", { length: 40 }).notNull(),
    nextValue: integer("next_value").notNull().default(1),
    padding: integer("padding").notNull().default(5),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_document_sequences_scope").on(table.propertyId, table.documentType, table.periodKey),
    check("ck_document_sequence_positive", sql`${table.nextValue} > 0 and ${table.padding} between 1 and 12`),
  ],
);
