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
  appendOnlyColumns,
  id,
  locale,
  metadata,
  money,
  quantity,
  status,
  trackedColumns,
  utcTimestamp,
} from "./common";
import { taxProfileVersions } from "./configuration";
import {
  folioBillingBuckets,
  folioEntries,
  folios,
} from "./finance";
import { users } from "./identity";
import { reservationRooms, reservations, roomStays } from "./lodging";
import { properties } from "./property";
import { storedFiles } from "./system";

export const contentPages = pgTable(
  "content_pages",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    routeKey: varchar("route_key", { length: 160 }).notNull(),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_content_pages_route").on(table.propertyId, table.routeKey)],
);

export const contentPageVersions = pgTable(
  "content_page_versions",
  {
    id: id(),
    contentPageId: uuid("content_page_id").notNull().references(() => contentPages.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    effectiveFrom: utcTimestamp("effective_from"),
    publishedAt: utcTimestamp("published_at"),
    publishedByUserId: uuid("published_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_content_page_versions").on(table.contentPageId, table.versionNumber)],
);

export const contentSections = pgTable(
  "content_sections",
  {
    id: id(),
    pageVersionId: uuid("page_version_id").notNull().references(() => contentPageVersions.id, { onDelete: "cascade" }),
    sectionKey: varchar("section_key", { length: 120 }).notNull(),
    sectionType: varchar("section_type", { length: 64 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    settings: metadata("settings"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_content_sections_key").on(table.pageVersionId, table.sectionKey)],
);

export const contentTranslations = pgTable(
  "content_translations",
  {
    id: id(),
    contentSectionId: uuid("content_section_id").notNull().references(() => contentSections.id, { onDelete: "cascade" }),
    locale: locale().notNull(),
    translationStatus: status("translation_status").notNull().default("DRAFT"),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_content_translations").on(table.contentSectionId, table.locale),
    check("ck_content_translation_locale", sql`${table.locale} in ('id', 'en')`),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    fileId: uuid("file_id").notNull().references(() => storedFiles.id, { onDelete: "restrict" }),
    mediaType: varchar("media_type", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }),
    altId: text("alt_id"),
    altEn: text("alt_en"),
    captionId: text("caption_id"),
    captionEn: text("caption_en"),
    rightsSource: text("rights_source"),
    authenticPropertyMedia: boolean("authentic_property_media").notNull().default(false),
    status: status().notNull().default("DRAFT"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_media_asset_file").on(table.fileId)],
);

export const mediaUsages = pgTable(
  "media_usages",
  {
    id: id(),
    mediaAssetId: uuid("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
    usageType: varchar("usage_type", { length: 64 }).notNull(),
    targetId: uuid("target_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    cropFocalMetadata: metadata("crop_focal_metadata"),
    ...trackedColumns,
  },
  (table) => [
    index("ix_media_usages_target").on(table.usageType, table.targetId, table.sortOrder),
    uniqueIndex("uq_media_usage_asset_target").on(
      table.mediaAssetId,
      table.usageType,
      table.targetId,
    ),
  ],
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    nameId: varchar("name_id", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_menu_categories_code").on(table.propertyId, table.code)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: id(),
    categoryId: uuid("category_id").notNull().references(() => menuCategories.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: status().notNull().default("ACTIVE"),
    currentlyAvailable: boolean("currently_available").notNull().default(true),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_menu_items_code").on(table.categoryId, table.code)],
);

export const menuItemVersions = pgTable(
  "menu_item_versions",
  {
    id: id(),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    nameId: varchar("name_id", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }).notNull(),
    descriptionId: text("description_id"),
    descriptionEn: text("description_en"),
    priceIdr: money("price_idr").notNull(),
    taxProfileVersionId: uuid("tax_profile_version_id").references(() => taxProfileVersions.id, { onDelete: "restrict" }),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    effectiveFrom: utcTimestamp("effective_from").notNull(),
    effectiveTo: utcTimestamp("effective_to"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_menu_item_versions").on(table.menuItemId, table.versionNumber),
    check("ck_menu_item_price", sql`${table.priceIdr} >= 0`),
    check("ck_menu_item_period", sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`),
  ],
);

export const foodOrders = pgTable(
  "food_orders",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    orderCode: varchar("order_code", { length: 32 }).notNull(),
    paperReference: varchar("paper_reference", { length: 80 }).notNull(),
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "restrict" }),
    reservationRoomId: uuid("reservation_room_id").references(() => reservationRooms.id, { onDelete: "restrict" }),
    roomStayId: uuid("room_stay_id").references(() => roomStays.id, { onDelete: "restrict" }),
    folioId: uuid("folio_id").references(() => folios.id, { onDelete: "restrict" }),
    billingBucketId: uuid("billing_bucket_id").references(() => folioBillingBuckets.id, { onDelete: "restrict" }),
    settlementRoute: varchar("settlement_route", { length: 32 }).notNull(),
    status: status().notNull().default("ENTERED"),
    customerName: varchar("customer_name", { length: 160 }),
    notes: text("notes"),
    enteredByUserId: uuid("entered_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_food_orders_code").on(table.orderCode),
    uniqueIndex("uq_food_orders_paper_ref").on(table.propertyId, table.paperReference),
    index("ix_food_orders_queue").on(table.propertyId, table.status, table.createdAt),
    check("ck_food_order_route", sql`${table.settlementRoute} in ('STANDALONE', 'ROOM_CHARGE')`),
    check("ck_food_order_room_charge", sql`${table.settlementRoute} <> 'ROOM_CHARGE' or (${table.folioId} is not null and ${table.roomStayId} is not null)`),
  ],
);

export const foodOrderItems = pgTable(
  "food_order_items",
  {
    id: id(),
    foodOrderId: uuid("food_order_id").notNull().references(() => foodOrders.id, { onDelete: "restrict" }),
    menuItemVersionId: uuid("menu_item_version_id").notNull().references(() => menuItemVersions.id, { onDelete: "restrict" }),
    quantity: quantity("quantity").notNull(),
    unitPriceIdr: money("unit_price_idr").notNull(),
    taxAmountIdr: money("tax_amount_idr").notNull().default("0"),
    serviceChargeAmountIdr: money("service_charge_amount_idr").notNull().default("0"),
    discountAmountIdr: money("discount_amount_idr").notNull().default("0"),
    totalIdr: money("total_idr").notNull(),
    priceTaxSnapshot: metadata("price_tax_snapshot").notNull(),
    notes: text("notes"),
    folioEntryId: uuid("folio_entry_id").references(() => folioEntries.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_food_order_item_folio_entry").on(table.folioEntryId),
    index("ix_food_order_items_order").on(table.foodOrderId),
    check("ck_food_order_item_amount", sql`${table.quantity} > 0 and ${table.unitPriceIdr} >= 0 and ${table.taxAmountIdr} >= 0 and ${table.serviceChargeAmountIdr} >= 0 and ${table.discountAmountIdr} >= 0 and ${table.totalIdr} >= 0`),
  ],
);

export const foodOrderPayments = pgTable(
  "food_order_payments",
  {
    id: id(),
    foodOrderId: uuid("food_order_id").notNull().references(() => foodOrders.id, { onDelete: "restrict" }),
    paymentCode: varchar("payment_code", { length: 32 }).notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    amountIdr: money("amount_idr").notNull(),
    status: status().notNull().default("PAID"),
    reference: varchar("reference", { length: 160 }),
    receivedAt: utcTimestamp("received_at").notNull().defaultNow(),
    voidedAt: utcTimestamp("voided_at"),
    voidReason: text("void_reason"),
    receivedByUserId: uuid("received_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    voidedByUserId: uuid("voided_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_food_order_payment_code").on(table.paymentCode),
    uniqueIndex("uq_food_order_payment_idempotency").on(table.idempotencyKey),
    index("ix_food_order_payments_order").on(table.foodOrderId, table.status),
    check("ck_food_order_payment_amount", sql`${table.amountIdr} > 0`),
    check("ck_food_order_payment_status", sql`${table.status} in ('PAID', 'VOIDED')`),
    check("ck_food_order_payment_method", sql`${table.method} in ('CASH', 'BANK_TRANSFER', 'OTHER')`),
  ],
);

export const foodOrderReceipts = pgTable(
  "food_order_receipts",
  {
    id: id(),
    foodOrderId: uuid("food_order_id").notNull().references(() => foodOrders.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id").notNull().references(() => foodOrderPayments.id, { onDelete: "restrict" }),
    receiptCode: varchar("receipt_code", { length: 40 }).notNull(),
    status: status().notNull().default("ISSUED"),
    recipientName: varchar("recipient_name", { length: 160 }).notNull(),
    totalsSnapshot: metadata("totals_snapshot").notNull(),
    issuedAt: utcTimestamp("issued_at").notNull().defaultNow(),
    issuedByUserId: uuid("issued_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_food_order_receipt_order").on(table.foodOrderId),
    uniqueIndex("uq_food_order_receipt_payment").on(table.paymentId),
    uniqueIndex("uq_food_order_receipt_code").on(table.receiptCode),
    check("ck_food_order_receipt_status", sql`${table.status} in ('ISSUED', 'VOIDED')`),
  ],
);

export const foodOrderEvents = pgTable(
  "food_order_events",
  {
    id: id(),
    foodOrderId: uuid("food_order_id").notNull().references(() => foodOrders.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    fromStatus: status("from_status"),
    toStatus: status("to_status").notNull(),
    notes: text("notes"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    ...appendOnlyColumns,
  },
  (table) => [index("ix_food_order_events").on(table.foodOrderId, table.createdAt)],
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 100 }).notNull(),
    channel: varchar("channel", { length: 32 }).notNull(),
    status: status().notNull().default("ACTIVE"),
    ...trackedColumns,
  },
  (table) => [uniqueIndex("uq_notification_templates_code").on(table.propertyId, table.code, table.channel)],
);

export const notificationTemplateVersions = pgTable(
  "notification_template_versions",
  {
    id: id(),
    templateId: uuid("template_id").notNull().references(() => notificationTemplates.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    locale: locale().notNull(),
    subjectTemplate: text("subject_template"),
    bodyTemplate: text("body_template").notNull(),
    lifecycleStatus: status("lifecycle_status").notNull().default("DRAFT"),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_notification_template_versions").on(table.templateId, table.versionNumber, table.locale),
    check("ck_notification_template_locale", sql`${table.locale} in ('id', 'en')`),
  ],
);

export const notificationMessages = pgTable(
  "notification_messages",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, { onDelete: "restrict" }),
    templateVersionId: uuid("template_version_id").references(() => notificationTemplateVersions.id, { onDelete: "restrict" }),
    channel: varchar("channel", { length: 32 }).notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    status: status().notNull().default("QUEUED"),
    renderedSubject: text("rendered_subject"),
    renderedBody: text("rendered_body").notNull(),
    scheduledAt: utcTimestamp("scheduled_at").notNull(),
    sentAt: utcTimestamp("sent_at"),
    providerReference: varchar("provider_reference", { length: 160 }),
    lastError: text("last_error"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    ...trackedColumns,
  },
  (table) => [
    uniqueIndex("uq_notification_message_idempotency").on(table.idempotencyKey),
    index("ix_notification_queue").on(table.status, table.scheduledAt),
  ],
);
