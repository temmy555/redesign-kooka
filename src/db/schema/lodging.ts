import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  appendOnlyColumns,
  businessDate,
  currency,
  exchangeRate,
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
  exchangeRateSnapshots,
  paymentInstructionVersions,
  policyVersions,
  taxProfileVersions,
} from "./configuration";
import { users } from "./identity";
import {
  ratePlanVersions,
  rateRules,
  resourcePools,
  roomTypes,
  roomUnits,
} from "./lodging-master";
import { properties } from "./property";

export const bookingQuotes = pgTable(
  "booking_quotes",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    status: status().notNull().default("ACTIVE"),
    language: locale("language").notNull().default("id"),
    displayCurrency: currency("display_currency").notNull().default("IDR"),
    exchangeRateSnapshotId: uuid("exchange_rate_snapshot_id").references(() => exchangeRateSnapshots.id, { onDelete: "restrict" }),
    totalIdr: money("total_idr").notNull(),
    displayTotal: money("display_total"),
    expiresAt: utcTimestamp("expires_at").notNull(),
    ...trackedColumns,
  },
  (table) => [
    index("ix_booking_quotes_expiry").on(table.status, table.expiresAt),
    check("ck_booking_quote_language", sql`${table.language} in ('id', 'en')`),
    check("ck_booking_quote_currency", sql`${table.displayCurrency} in ('IDR', 'USD', 'AUD')`),
    check("ck_booking_quote_total", sql`${table.totalIdr} >= 0`),
    check("ck_booking_quote_status", sql`${table.status} in ('ACTIVE', 'CONVERTED', 'EXPIRED')`),
  ],
);

export const bookingQuoteRooms = pgTable(
  "booking_quote_rooms",
  {
    id: id(),
    quoteId: uuid("quote_id").notNull().references(() => bookingQuotes.id, { onDelete: "cascade" }),
    roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    ratePlanVersionId: uuid("rate_plan_version_id").notNull().references(() => ratePlanVersions.id, { onDelete: "restrict" }),
    checkInDate: businessDate("check_in_date").notNull(),
    checkoutDate: businessDate("checkout_date").notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),
    extraBedQuantity: integer("extra_bed_quantity").notNull().default(0),
    totalIdr: money("total_idr").notNull(),
    ...trackedColumns,
  },
  (table) => [
    index("ix_booking_quote_rooms_quote").on(table.quoteId),
    check("ck_quote_room_dates", sql`${table.checkoutDate} > ${table.checkInDate}`),
    check("ck_quote_room_guests", sql`${table.adults} > 0 and ${table.children} >= 0 and ${table.infants} >= 0 and ${table.extraBedQuantity} >= 0`),
  ],
);

export const bookingQuoteNights = pgTable(
  "booking_quote_nights",
  {
    id: id(),
    quoteRoomId: uuid("quote_room_id").notNull().references(() => bookingQuoteRooms.id, { onDelete: "cascade" }),
    stayDate: businessDate("stay_date").notNull(),
    rateRuleId: uuid("rate_rule_id").references(() => rateRules.id, { onDelete: "restrict" }),
    roomRateIdr: money("room_rate_idr").notNull(),
    discountIdr: money("discount_idr").notNull().default("0"),
    taxIdr: money("tax_idr").notNull().default("0"),
    serviceChargeIdr: money("service_charge_idr").notNull().default("0"),
    totalIdr: money("total_idr").notNull(),
    taxSnapshot: metadata("tax_snapshot"),
    priceSnapshot: metadata("price_snapshot").notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_booking_quote_nights").on(table.quoteRoomId, table.stayDate),
    check("ck_booking_quote_night_amounts", sql`${table.roomRateIdr} >= 0 and ${table.discountIdr} >= 0 and ${table.taxIdr} >= 0 and ${table.serviceChargeIdr} >= 0 and ${table.totalIdr} >= 0`),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    bookingCode: varchar("booking_code", { length: 24 }).notNull(),
    source: varchar("source", { length: 40 }).notNull(),
    status: status().notNull().default("DRAFT"),
    bookerName: varchar("booker_name", { length: 160 }).notNull(),
    bookerEmail: varchar("booker_email", { length: 320 }).notNull(),
    bookerEmailNormalized: varchar("booker_email_normalized", { length: 320 }).notNull(),
    bookerPhone: varchar("booker_phone", { length: 40 }),
    language: locale("language").notNull().default("id"),
    displayCurrency: currency("display_currency").notNull().default("IDR"),
    officialCurrency: currency("official_currency").notNull().default("IDR"),
    exchangeRate: exchangeRate("exchange_rate"),
    exchangeRateSnapshotId: uuid("exchange_rate_snapshot_id").references(() => exchangeRateSnapshots.id, { onDelete: "restrict" }),
    quoteId: uuid("quote_id").references(() => bookingQuotes.id, { onDelete: "restrict" }),
    paymentInstructionVersionId: uuid("payment_instruction_version_id").references(() => paymentInstructionVersions.id, { onDelete: "restrict" }),
    cancellationPolicyVersionId: uuid("cancellation_policy_version_id").references(() => policyVersions.id, { onDelete: "restrict" }),
    houseRulesVersionId: uuid("house_rules_version_id").references(() => policyVersions.id, { onDelete: "restrict" }),
    paymentDeadlineAt: utcTimestamp("payment_deadline_at"),
    paymentMode: varchar("payment_mode", { length: 40 }).notNull().default("FULL"),
    requiredPaymentIdr: money("required_payment_idr").notNull().default("0"),
    guaranteed: boolean("guaranteed").notNull().default(false),
    internalNotes: text("internal_notes"),
    completedAt: utcTimestamp("completed_at"),
    cancelledAt: utcTimestamp("cancelled_at"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_reservations_booking_code").on(table.bookingCode),
    index("ix_reservation_lookup").on(table.bookingCode, table.bookerEmailNormalized),
    index("ix_reservations_status_deadline").on(table.status, table.paymentDeadlineAt),
    index("ix_reservations_property_created").on(table.propertyId, table.createdAt),
    check("ck_reservation_status", sql`${table.status} in ('DRAFT', 'ON_HOLD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW')`),
    check("ck_reservation_source", sql`${table.source} in ('ONLINE', 'ADMIN_MANUAL', 'OPENING')`),
    check("ck_reservation_language", sql`${table.language} in ('id', 'en')`),
    check("ck_reservation_currencies", sql`${table.displayCurrency} in ('IDR', 'USD', 'AUD') and ${table.officialCurrency} = 'IDR'`),
    check("ck_reservation_payment_mode", sql`${table.paymentMode} in ('FULL', 'FIXED_DEPOSIT', 'PERCENTAGE_DEPOSIT', 'PAY_AT_CHECKIN', 'PAY_AT_CHECKOUT')`),
    check("ck_reservation_required_payment", sql`${table.requiredPaymentIdr} >= 0`),
  ],
);

/**
 * Immutable bank choices offered when a reservation was created. A booking
 * may show several active KOOKA accounts, while each row still references the
 * versioned encrypted master record instead of copying sensitive account data.
 */
export const reservationPaymentInstructions = pgTable(
  "reservation_payment_instructions",
  {
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservations.id, { onDelete: "restrict" }),
    paymentInstructionVersionId: uuid("payment_instruction_version_id")
      .notNull()
      .references(() => paymentInstructionVersions.id, {
        onDelete: "restrict",
      }),
    displayOrder: integer("display_order").notNull(),
    ...appendOnlyColumns,
  },
  (table) => [
    primaryKey({
      columns: [
        table.reservationId,
        table.paymentInstructionVersionId,
      ],
    }),
    uniqueIndex("uq_reservation_payment_instruction_order").on(
      table.reservationId,
      table.displayOrder,
    ),
    check(
      "ck_reservation_payment_instruction_order",
      sql`${table.displayOrder} > 0`,
    ),
  ],
);

export const reservationStatusEvents = pgTable(
  "reservation_status_events",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 80 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    guardResult: metadata("guard_result"),
    correlationId: varchar("correlation_id", { length: 100 }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_reservation_status_events").on(table.reservationId, table.createdAt)],
);

export const guests = pgTable(
  "guests",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 40 }),
    nationalityCode: varchar("nationality_code", { length: 3 }),
    archivedAt: utcTimestamp("archived_at"),
    ...trackedColumns,
  },
  (table) => [index("ix_guests_contact").on(table.propertyId, table.email, table.phone)],
);

export const reservationGuests = pgTable(
  "reservation_guests",
  {
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").notNull().references(() => guests.id, { onDelete: "restrict" }),
    role: varchar("role", { length: 40 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    primaryKey({ columns: [table.reservationId, table.guestId, table.role] }),
    check("ck_reservation_guest_role", sql`${table.role} in ('BOOKER', 'GUEST', 'PAYER', 'INVOICE_RECIPIENT')`),
  ],
);

export const reservationRooms = pgTable(
  "reservation_rooms",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    bookedRoomTypeId: uuid("booked_room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    fulfilledRoomTypeId: uuid("fulfilled_room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    ratePlanVersionId: uuid("rate_plan_version_id").notNull().references(() => ratePlanVersions.id, { onDelete: "restrict" }),
    checkInDate: businessDate("check_in_date").notNull(),
    checkoutDate: businessDate("checkout_date").notNull(),
    adults: integer("adults").notNull(),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),
    extraBedQuantity: integer("extra_bed_quantity").notNull().default(0),
    lineStatus: status("line_status").notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_reservation_rooms_line").on(table.reservationId, table.lineNumber),
    index("ix_reservation_rooms_dates").on(table.fulfilledRoomTypeId, table.checkInDate, table.checkoutDate),
    check("ck_reservation_room_dates", sql`${table.checkoutDate} > ${table.checkInDate}`),
    check("ck_reservation_room_guests", sql`${table.adults} > 0 and ${table.children} >= 0 and ${table.infants} >= 0 and ${table.extraBedQuantity} >= 0`),
    check("ck_reservation_room_status", sql`${table.lineStatus} in ('ACTIVE', 'CANCELLED', 'COMPLETED')`),
  ],
);

export const reservationRoomNights = pgTable(
  "reservation_room_nights",
  {
    id: id(),
    reservationRoomId: uuid("reservation_room_id").notNull().references(() => reservationRooms.id, { onDelete: "restrict" }),
    stayDate: businessDate("stay_date").notNull(),
    roomRateIdr: money("room_rate_idr").notNull(),
    discountIdr: money("discount_idr").notNull().default("0"),
    taxIdr: money("tax_idr").notNull().default("0"),
    serviceChargeIdr: money("service_charge_idr").notNull().default("0"),
    totalIdr: money("total_idr").notNull(),
    taxProfileVersionId: uuid("tax_profile_version_id").references(() => taxProfileVersions.id, { onDelete: "restrict" }),
    priceSnapshot: jsonb("price_snapshot").$type<Record<string, unknown>>().notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_reservation_room_nights").on(table.reservationRoomId, table.stayDate),
    index("ix_reservation_room_nights_date").on(table.stayDate),
    check("ck_reservation_night_amounts", sql`${table.roomRateIdr} >= 0 and ${table.discountIdr} >= 0 and ${table.taxIdr} >= 0 and ${table.serviceChargeIdr} >= 0 and ${table.totalIdr} >= 0`),
  ],
);

export const roomStays = pgTable(
  "room_stays",
  {
    id: id(),
    reservationRoomId: uuid("reservation_room_id").notNull().references(() => reservationRooms.id, { onDelete: "restrict" }),
    status: status().notNull().default("NOT_STARTED"),
    leadGuestId: uuid("lead_guest_id").references(() => guests.id, { onDelete: "restrict" }),
    plannedArrivalAt: utcTimestamp("planned_arrival_at"),
    plannedDepartureAt: utcTimestamp("planned_departure_at"),
    actualCheckInAt: utcTimestamp("actual_check_in_at"),
    actualCheckOutAt: utcTimestamp("actual_check_out_at"),
    earlyCheckInApprovedAt: utcTimestamp("early_check_in_approved_at"),
    lateCheckoutApprovedUntil: utcTimestamp("late_checkout_approved_until"),
    chargePrivilege: status("charge_privilege")
      .notNull()
      .default("APPROVAL_REQUIRED"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_room_stays_reservation_room").on(table.reservationRoomId),
    index("ix_room_stays_operational").on(table.status, table.plannedArrivalAt, table.plannedDepartureAt),
    check("ck_room_stay_status", sql`${table.status} in ('NOT_STARTED', 'DUE_IN', 'IN_HOUSE', 'DUE_OUT', 'CHECKED_OUT', 'NO_SHOW')`),
    check("ck_room_stay_charge_privilege", sql`${table.chargePrivilege} in ('ALLOWED', 'NOT_ALLOWED', 'APPROVAL_REQUIRED')`),
  ],
);

export const roomStayGuests = pgTable(
  "room_stay_guests",
  {
    roomStayId: uuid("room_stay_id").notNull().references(() => roomStays.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").notNull().references(() => guests.id, { onDelete: "restrict" }),
    occupancyStartsAt: utcTimestamp("occupancy_starts_at"),
    occupancyEndsAt: utcTimestamp("occupancy_ends_at"),
    ...trackedColumns,
  },
  (table) => [
    primaryKey({ columns: [table.roomStayId, table.guestId] }),
    check("ck_room_stay_guest_period", sql`${table.occupancyEndsAt} is null or ${table.occupancyStartsAt} is null or ${table.occupancyEndsAt} > ${table.occupancyStartsAt}`),
  ],
);

export const stayStatusEvents = pgTable(
  "stay_status_events",
  {
    id: id(),
    roomStayId: uuid("room_stay_id").notNull().references(() => roomStays.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 80 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    guardResult: metadata("guard_result"),
    correlationId: varchar("correlation_id", { length: 100 }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_stay_status_events").on(table.roomStayId, table.createdAt)],
);

export const inventoryDays = pgTable(
  "inventory_days",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    roomTypeId: uuid("room_type_id").notNull().references(() => roomTypes.id, { onDelete: "restrict" }),
    stayDate: businessDate("stay_date").notNull(),
    physicalCapacity: integer("physical_capacity").notNull(),
    salesClosed: boolean("sales_closed").notNull().default(false),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_inventory_days").on(table.propertyId, table.roomTypeId, table.stayDate),
    check("ck_inventory_day_capacity", sql`${table.physicalCapacity} >= 0`),
  ],
);

export const inventoryClaims = pgTable(
  "inventory_claims",
  {
    id: id(),
    inventoryDayId: uuid("inventory_day_id").notNull().references(() => inventoryDays.id, { onDelete: "restrict" }),
    claimType: status("claim_type").notNull(),
    claimStatus: status("claim_status").notNull().default("ACTIVE"),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceId: uuid("source_id").notNull(),
    reservationRoomId: uuid("reservation_room_id").references(() => reservationRooms.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    expiresAt: utcTimestamp("expires_at"),
    releasedAt: utcTimestamp("released_at"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_inventory_claim_idempotency").on(table.idempotencyKey),
    index("ix_inventory_claims_active").on(table.inventoryDayId, table.claimStatus),
    index("ix_inventory_claims_source").on(table.sourceType, table.sourceId),
    check("ck_inventory_claim_type", sql`${table.claimType} in ('CHECKOUT_HOLD', 'PAYMENT_HOLD', 'COMMITTED', 'BLOCKED', 'WHOLE_HOUSE')`),
    check("ck_inventory_claim_status", sql`${table.claimStatus} in ('ACTIVE', 'RELEASED', 'EXPIRED')`),
    check("ck_inventory_claim_quantity", sql`${table.quantity} > 0`),
  ],
);

export const inventoryClaimEvents = pgTable(
  "inventory_claim_events",
  {
    id: id(),
    inventoryClaimId: uuid("inventory_claim_id").notNull().references(() => inventoryClaims.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    reason: text("reason"),
    correlationId: varchar("correlation_id", { length: 100 }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_inventory_claim_events").on(table.inventoryClaimId, table.createdAt)],
);

export const roomUnitNightClaims = pgTable(
  "room_unit_night_claims",
  {
    id: id(),
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "restrict" }),
    stayDate: businessDate("stay_date").notNull(),
    claimType: status("claim_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    claimStatus: status("claim_status").notNull().default("ACTIVE"),
    releasedAt: utcTimestamp("released_at"),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_room_unit_night_claim_active")
      .on(table.roomUnitId, table.stayDate)
      .where(sql`${table.claimStatus} = 'ACTIVE'`),
    index("ix_room_unit_night_claim_source").on(table.claimType, table.sourceId),
    check("ck_room_unit_night_claim_type", sql`${table.claimType} in ('ASSIGNMENT', 'BLOCK')`),
    check("ck_room_unit_night_claim_status", sql`${table.claimStatus} in ('ACTIVE', 'RELEASED')`),
  ],
);

export const roomAssignments = pgTable(
  "room_assignments",
  {
    id: id(),
    roomStayId: uuid("room_stay_id").notNull().references(() => roomStays.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "restrict" }),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    status: status().notNull().default("ACTIVE"),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_room_assignments_stay").on(table.roomStayId, table.status),
    index("ix_room_assignments_unit").on(table.roomUnitId, table.status, table.effectiveFrom),
    check("ck_room_assignment_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
    check("ck_room_assignment_status", sql`${table.status} in ('PLANNED', 'ACTIVE', 'RELEASED', 'CANCELLED')`),
  ],
);

export const roomAssignmentNights = pgTable(
  "room_assignment_nights",
  {
    id: id(),
    roomAssignmentId: uuid("room_assignment_id").notNull().references(() => roomAssignments.id, { onDelete: "restrict" }),
    roomUnitNightClaimId: uuid("room_unit_night_claim_id").notNull().references(() => roomUnitNightClaims.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "restrict" }),
    stayDate: businessDate("stay_date").notNull(),
    releasedAt: utcTimestamp("released_at"),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_room_assignment_night_claim").on(table.roomUnitNightClaimId),
    uniqueIndex("uq_room_assignment_night_active")
      .on(table.roomUnitId, table.stayDate)
      .where(sql`${table.releasedAt} is null`),
    index("ix_room_assignment_nights_assignment").on(table.roomAssignmentId),
  ],
);

export const roomMoves = pgTable(
  "room_moves",
  {
    id: id(),
    roomStayId: uuid("room_stay_id").notNull().references(() => roomStays.id, { onDelete: "restrict" }),
    fromAssignmentId: uuid("from_assignment_id").notNull().references(() => roomAssignments.id, { onDelete: "restrict" }),
    toAssignmentId: uuid("to_assignment_id").references(() => roomAssignments.id, { onDelete: "restrict" }),
    status: status().notNull().default("PREPARED"),
    effectiveAt: utcTimestamp("effective_at").notNull(),
    reason: text("reason").notNull(),
    priceTreatment: status("price_treatment").notNull().default("NO_CHANGE"),
    priceAdjustmentIdr: money("price_adjustment_idr").notNull().default("0"),
    incidentalNoCharge: boolean("incidental_no_charge").notNull().default(false),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    index("ix_room_moves_stay").on(table.roomStayId, table.effectiveAt),
    check("ck_room_move_status", sql`${table.status} in ('PREPARED', 'APPLIED', 'REJECTED', 'CANCELLED')`),
    check("ck_room_move_price_treatment", sql`${table.priceTreatment} in ('NO_CHANGE', 'CHARGE', 'CREDIT')`),
  ],
);

export const roomMoveEvents = pgTable(
  "room_move_events",
  {
    id: id(),
    roomMoveId: uuid("room_move_id").notNull().references(() => roomMoves.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    guardResult: metadata("guard_result"),
    reason: text("reason"),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_room_move_events").on(table.roomMoveId, table.createdAt)],
);

export const roomBlocks = pgTable(
  "room_blocks",
  {
    id: id(),
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "restrict" }),
    blockType: varchar("block_type", { length: 48 }).notNull(),
    status: status().notNull().default("DRAFT"),
    startsAt: utcTimestamp("starts_at").notNull(),
    endsAt: utcTimestamp("ends_at").notNull(),
    reason: text("reason").notNull(),
    sourceType: varchar("source_type", { length: 64 }),
    sourceId: uuid("source_id"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_room_blocks_unit_period").on(table.roomUnitId, table.startsAt, table.endsAt),
    check("ck_room_block_period", sql`${table.endsAt} > ${table.startsAt}`),
    check("ck_room_block_status", sql`${table.status} in ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')`),
  ],
);

export const roomBlockNights = pgTable(
  "room_block_nights",
  {
    id: id(),
    roomBlockId: uuid("room_block_id").notNull().references(() => roomBlocks.id, { onDelete: "restrict" }),
    roomUnitNightClaimId: uuid("room_unit_night_claim_id").notNull().references(() => roomUnitNightClaims.id, { onDelete: "restrict" }),
    roomUnitId: uuid("room_unit_id").notNull().references(() => roomUnits.id, { onDelete: "restrict" }),
    stayDate: businessDate("stay_date").notNull(),
    releasedAt: utcTimestamp("released_at"),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_room_block_night_claim").on(table.roomUnitNightClaimId),
    uniqueIndex("uq_room_block_night_active")
      .on(table.roomUnitId, table.stayDate)
      .where(sql`${table.releasedAt} is null`),
    index("ix_room_block_nights_block").on(table.roomBlockId),
  ],
);

export const resourceInventoryDays = pgTable(
  "resource_inventory_days",
  {
    id: id(),
    resourcePoolId: uuid("resource_pool_id").notNull().references(() => resourcePools.id, { onDelete: "restrict" }),
    stayDate: businessDate("stay_date").notNull(),
    physicalCapacity: integer("physical_capacity").notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_resource_inventory_days").on(table.resourcePoolId, table.stayDate),
    check("ck_resource_inventory_capacity", sql`${table.physicalCapacity} >= 0`),
  ],
);

export const resourceClaims = pgTable(
  "resource_claims",
  {
    id: id(),
    resourceInventoryDayId: uuid("resource_inventory_day_id").notNull().references(() => resourceInventoryDays.id, { onDelete: "restrict" }),
    bookingQuoteRoomId: uuid("booking_quote_room_id").references(() => bookingQuoteRooms.id, { onDelete: "restrict" }),
    reservationRoomId: uuid("reservation_room_id").references(() => reservationRooms.id, { onDelete: "restrict" }),
    claimStatus: status("claim_status").notNull().default("ACTIVE"),
    quantity: integer("quantity").notNull(),
    expiresAt: utcTimestamp("expires_at"),
    releasedAt: utcTimestamp("released_at"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_resource_claim_idempotency").on(table.idempotencyKey),
    index("ix_resource_claim_active").on(table.resourceInventoryDayId, table.claimStatus),
    check("ck_resource_claim_quantity", sql`${table.quantity} > 0`),
    check("ck_resource_claim_status", sql`${table.claimStatus} in ('ACTIVE', 'RELEASED', 'EXPIRED')`),
    check("ck_resource_claim_source", sql`num_nonnulls(${table.bookingQuoteRoomId}, ${table.reservationRoomId}) = 1`),
  ],
);

export const reservationAddons = pgTable(
  "reservation_addons",
  {
    id: id(),
    reservationRoomId: uuid("reservation_room_id").notNull().references(() => reservationRooms.id, { onDelete: "restrict" }),
    resourcePoolId: uuid("resource_pool_id").references(() => resourcePools.id, { onDelete: "restrict" }),
    addonType: varchar("addon_type", { length: 64 }).notNull(),
    quantity: quantity("quantity").notNull(),
    chargeBasis: varchar("charge_basis", { length: 32 }).notNull(),
    unitPriceIdr: money("unit_price_idr").notNull(),
    totalIdr: money("total_idr").notNull(),
    taxSnapshot: metadata("tax_snapshot"),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_reservation_addons_room").on(table.reservationRoomId),
    check("ck_reservation_addon_amount", sql`${table.quantity} > 0 and ${table.unitPriceIdr} >= 0 and ${table.totalIdr} >= 0`),
  ],
);

export const bookingLookupSessions = pgTable(
  "booking_lookup_sessions",
  {
    id: id(),
    reservationId: uuid("reservation_id").notNull().references(() => reservations.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    matchedEmailHash: varchar("matched_email_hash", { length: 128 }).notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    revokedAt: utcTimestamp("revoked_at"),
    ipAddress: varchar("ip_address", { length: 64 }),
    ...appendOnlyColumns,
  },
  (table) => [
    uniqueIndex("uq_booking_lookup_token").on(table.tokenHash),
    index("ix_booking_lookup_expiry").on(table.reservationId, table.expiresAt),
  ],
);
