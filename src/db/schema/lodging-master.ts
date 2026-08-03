import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { businessDate, id, money, status, trackedColumns, utcTimestamp } from "./common";
import { paymentInstructionSets, policySets, taxProfiles } from "./configuration";
import { users } from "./identity";
import { properties } from "./property";

export const amenities = pgTable(
  "amenities",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    iconKey: varchar("icon_key", { length: 80 }),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_amenities_code").on(table.propertyId, table.code)],
);

export const amenityTranslations = pgTable(
  "amenity_translations",
  {
    amenityId: uuid("amenity_id").notNull().references(() => amenities.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    ...trackedColumns,
  },
  (table) => [
    primaryKey({ columns: [table.amenityId, table.locale] }),
    check("ck_amenity_translation_locale", sql`${table.locale} in ('id', 'en')`),
  ],
);

export const roomTypes = pgTable(
  "room_types",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 40 }).notNull(),
    status: status().notNull().default("ACTIVE"),
    archivedAt: utcTimestamp("archived_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_room_types_code").on(table.propertyId, table.code),
    check("ck_room_types_status", sql`${table.status} in ('ACTIVE', 'INACTIVE', 'ARCHIVED')`),
  ],
);

export const roomTypeVersions = pgTable(
  "room_type_versions",
  {
    id: id(),
    roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("NOT_REQUIRED"),
    nameId: varchar("name_id", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    descriptionId: text("description_id"),
    descriptionEn: text("description_en"),
    bedConfiguration: varchar("bed_configuration", { length: 160 }),
    standardAdults: integer("standard_adults").notNull().default(1),
    maximumAdults: integer("maximum_adults").notNull(),
    maximumChildren: integer("maximum_children").notNull().default(0),
    maximumTotalGuests: integer("maximum_total_guests").notNull(),
    extraBedAllowed: boolean("extra_bed_allowed").notNull().default(false),
    maximumExtraBeds: integer("maximum_extra_beds").notNull().default(0),
    extraBedCapacityIncrement: integer("extra_bed_capacity_increment").notNull().default(0),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_room_type_versions_number").on(table.roomTypeId, table.versionNumber),
    index("ix_room_type_versions_effective").on(table.roomTypeId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_room_type_version_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_room_type_version_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_room_type_capacity", sql`${table.standardAdults} >= 0 and ${table.maximumAdults} >= ${table.standardAdults} and ${table.maximumChildren} >= 0 and ${table.maximumTotalGuests} > 0`),
    check("ck_room_type_extra_bed", sql`${table.maximumExtraBeds} >= 0 and ${table.extraBedCapacityIncrement} >= 0 and (${table.extraBedAllowed} or ${table.maximumExtraBeds} = 0)`),
    check("ck_room_type_version_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const roomTypeAmenities = pgTable(
  "room_type_amenities",
  {
    roomTypeVersionId: uuid("room_type_version_id").notNull().references(() => roomTypeVersions.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id").notNull().references(() => amenities.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [primaryKey({ columns: [table.roomTypeVersionId, table.amenityId] })],
);

export const roomUnits = pgTable(
  "room_units",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    roomNumber: varchar("room_number", { length: 32 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    floorOrArea: varchar("floor_or_area", { length: 80 }),
    status: status().notNull().default("ACTIVE"),
    archivedAt: utcTimestamp("archived_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_room_units_number").on(table.propertyId, table.roomNumber),
    index("ix_room_units_board_order").on(table.propertyId, table.sortOrder),
    check("ck_room_units_status", sql`${table.status} in ('ACTIVE', 'INACTIVE', 'ARCHIVED')`),
  ],
);

export const roomUnitTypePeriods = pgTable(
  "room_unit_type_periods",
  {
    id: id(),
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "restrict" }),
    roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    reason: text("reason").notNull(),
    ...trackedColumns,
  },
  (table) => [
    index("ix_room_unit_type_periods_current").on(table.roomUnitId, table.effectiveFrom, table.effectiveTo),
    check("ck_room_unit_type_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const roomUnitStates = pgTable(
  "room_unit_states",
  {
    roomUnitId: uuid("room_unit_id").primaryKey().references(() => roomUnits.id, { onDelete: "cascade" }),
    occupancyStatus: status("occupancy_status").notNull().default("VACANT"),
    housekeepingStatus: status("housekeeping_status").notNull().default("DIRTY"),
    serviceabilityStatus: status("serviceability_status").notNull().default("IN_SERVICE"),
    changedAt: utcTimestamp("changed_at").notNull().defaultNow(),
    ...trackedColumns,
  },
  (table) => [
    check("ck_room_occupancy_status", sql`${table.occupancyStatus} in ('VACANT', 'OCCUPIED')`),
    check("ck_room_housekeeping_status", sql`${table.housekeepingStatus} in ('DIRTY', 'CLEANING', 'CLEANED', 'INSPECTED')`),
    check("ck_room_serviceability_status", sql`${table.serviceabilityStatus} in ('IN_SERVICE', 'BLOCKED', 'OUT_OF_ORDER')`),
  ],
);

export const roomUnitAmenityOverrides = pgTable(
  "room_unit_amenity_overrides",
  {
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "cascade" }),
    amenityId: uuid("amenity_id").notNull().references(() => amenities.id, { onDelete: "restrict" }),
    available: boolean("available").notNull(),
    reason: text("reason").notNull(),
    ...trackedColumns,
  },
  (table) => [primaryKey({ columns: [table.roomUnitId, table.amenityId] })],
);

export const ratePlans = pgTable(
  "rate_plans",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_rate_plans_code").on(table.propertyId, table.code)],
);

export const ratePlanVersions = pgTable(
  "rate_plan_versions",
  {
    id: id(),
    ratePlanId: uuid("rate_plan_id").notNull().references(() => ratePlans.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    approvalStatus: status("approval_status").notNull().default("PENDING"),
    nameId: varchar("name_id", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    sourceEligibility: varchar("source_eligibility", { length: 80 }).notNull().default("ALL"),
    paymentInstructionSetId: uuid("payment_instruction_set_id").references(() => paymentInstructionSets.id, { onDelete: "restrict" }),
    cancellationPolicySetId: uuid("cancellation_policy_set_id").references(() => policySets.id, { onDelete: "restrict" }),
    taxProfileId: uuid("tax_profile_id").references(() => taxProfiles.id, { onDelete: "restrict" }),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: utcTimestamp("approved_at"),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_rate_plan_versions_number").on(table.ratePlanId, table.versionNumber),
    index("ix_rate_plan_versions_effective").on(table.ratePlanId, table.lifecycleStatus, table.effectiveFrom),
    check("ck_rate_plan_version_lifecycle", sql`${table.lifecycleStatus} in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')`),
    check("ck_rate_plan_version_approval", sql`${table.approvalStatus} in ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')`),
    check("ck_rate_plan_version_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const rateRules = pgTable(
  "rate_rules",
  {
    id: id(),
    ratePlanVersionId: uuid("rate_plan_version_id").notNull().references(() => ratePlanVersions.id, { onDelete: "cascade" }),
    roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    ruleType: varchar("rule_type", { length: 32 }).notNull().default("BASE"),
    priority: integer("priority").notNull().default(0),
    startsOn: businessDate("starts_on").notNull(),
    endsOn: businessDate("ends_on").notNull(),
    weekdaysMask: integer("weekdays_mask").notNull().default(127),
    nightlyRateIdr: money("nightly_rate_idr").notNull(),
    minimumStay: integer("minimum_stay").notNull().default(1),
    maximumStay: integer("maximum_stay"),
    closedToArrival: boolean("closed_to_arrival").notNull().default(false),
    closedToDeparture: boolean("closed_to_departure").notNull().default(false),
    ...trackedColumns,
  },
  (table) => [
    index("ix_rate_rules_resolve").on(table.roomTypeId, table.startsOn, table.endsOn, table.priority),
    check("ck_rate_rule_dates", sql`${table.endsOn} >= ${table.startsOn}`),
    check("ck_rate_rule_type", sql`${table.ruleType} in ('BASE', 'WEEK_PATTERN', 'SEASONAL', 'SPECIAL_DATE')`),
    check("ck_rate_rule_amount", sql`${table.nightlyRateIdr} > 0`),
    check("ck_rate_rule_stay", sql`${table.minimumStay} > 0 and (${table.maximumStay} is null or ${table.maximumStay} >= ${table.minimumStay})`),
    check("ck_rate_rule_weekdays", sql`${table.weekdaysMask} between 1 and 127`),
  ],
);

export const rateRuleDates = pgTable(
  "rate_rule_dates",
  {
    id: id(),
    rateRuleId: uuid("rate_rule_id").notNull().references(() => rateRules.id, { onDelete: "cascade" }),
    stayDate: businessDate("stay_date").notNull(),
    nightlyRateIdr: money("nightly_rate_idr").notNull(),
    salesClosed: boolean("sales_closed").notNull().default(false),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_rate_rule_dates").on(table.rateRuleId, table.stayDate),
    check("ck_rate_rule_date_amount", sql`${table.nightlyRateIdr} > 0`),
  ],
);

export const resourcePools = pgTable(
  "resource_pools",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    nameId: varchar("name_id", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    inventoryTracked: boolean("inventory_tracked").notNull().default(true),
    physicalCapacity: integer("physical_capacity").notNull(),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_resource_pools_code").on(table.propertyId, table.code),
    check("ck_resource_pool_capacity", sql`${table.physicalCapacity} >= 0`),
  ],
);
