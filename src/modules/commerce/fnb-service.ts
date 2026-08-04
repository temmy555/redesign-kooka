import "server-only";

import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  exchangeRateSnapshots,
  folioEntries,
  foodOrderEvents,
  foodOrderItems,
  foodOrderPayments,
  foodOrderReceipts,
  foodOrders,
  menuCategories,
  menuItems,
  menuItemVersions,
  properties,
  roomStays,
  taxProfileVersions,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { getBusinessDate, toJakartaDateString } from "../../platform/clock";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import { paginationMeta } from "../../platform/pagination";
import { databaseDate } from "../../platform/database-values";
import { stableRequestHash } from "../booking/domain";
import { calculateNightAmounts } from "../booking/domain";
import type { PublicMenuCategory, PublicMenuData } from "../content/contracts";
import {
  foodOrderStatusLabel,
  foodOrderStatusesForFilter,
  type FoodOrderStatus,
} from "./fnb-status";

export interface FnbStaffSession {
  user: { id: string };
}

const FOOD_TRANSITIONS: Record<FoodOrderStatus, FoodOrderStatus[]> = {
  ENTERED: ["ACCEPTED", "PREPARING", "SERVED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "SERVED", "CANCELLED"],
  PREPARING: ["READY", "SERVED", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertFoodOrderTransition(
  from: FoodOrderStatus,
  to: FoodOrderStatus,
) {
  if (!FOOD_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `Status pesanan tidak dapat diubah dari ${foodOrderStatusLabel(from)} menjadi ${foodOrderStatusLabel(to)}`,
    );
  }
}

export function calculateFoodLineAmounts(input: {
  unitPriceIdr: number;
  quantity: number;
  discountAmountIdr?: number;
  taxRate: number;
  serviceChargeRate: number;
  taxInclusive: boolean;
  serviceChargeInclusive: boolean;
  noTax: boolean;
}) {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isInteger(input.unitPriceIdr) ||
    input.unitPriceIdr < 0
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Food quantity and price must be positive whole values",
    );
  }
  const unit = calculateNightAmounts({
    roomRateIdr: input.unitPriceIdr,
    taxRate: input.taxRate,
    serviceChargeRate: input.serviceChargeRate,
    taxInclusive: input.taxInclusive,
    serviceChargeInclusive: input.serviceChargeInclusive,
    noTax: input.noTax,
  });
  const discountAmountIdr = input.discountAmountIdr ?? 0;
  const grossNet = unit.netAmountIdr * input.quantity;
  if (
    !Number.isInteger(discountAmountIdr) ||
    discountAmountIdr < 0 ||
    discountAmountIdr > grossNet
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid food discount amount");
  }
  return {
    unitPriceIdr: input.unitPriceIdr,
    quantity: input.quantity,
    netAmountIdr: grossNet,
    discountAmountIdr,
    serviceChargeAmountIdr: unit.serviceChargeIdr * input.quantity,
    taxAmountIdr: unit.taxIdr * input.quantity,
    totalAmountIdr: unit.totalIdr * input.quantity - discountAmountIdr,
  };
}

export function formatDailyFoodOrderReference(
  orderDate: string,
  issuedValue: number,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(orderDate) ||
    !Number.isInteger(issuedValue) ||
    issuedValue < 1
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid food order sequence");
  }
  return `${orderDate.slice(2).replaceAll("-", "")}${String(issuedValue).padStart(2, "0")}`;
}

export async function getPublicMenu(params: {
  propertyId: string;
  locale: "id" | "en";
  now?: Date;
}): Promise<PublicMenuData> {
  const now = params.now ?? new Date();
  const db = getDatabase();
  const rows = await db
    .select({
      categoryId: menuCategories.id,
      categoryCode: menuCategories.code,
      categoryNameId: menuCategories.nameId,
      categoryNameEn: menuCategories.nameEn,
      categorySortOrder: menuCategories.sortOrder,
      itemId: menuItems.id,
      itemCode: menuItems.code,
      itemSortOrder: menuItems.sortOrder,
      available: menuItems.currentlyAvailable,
      versionId: menuItemVersions.id,
      versionNumber: menuItemVersions.versionNumber,
      nameId: menuItemVersions.nameId,
      nameEn: menuItemVersions.nameEn,
      descriptionId: menuItemVersions.descriptionId,
      descriptionEn: menuItemVersions.descriptionEn,
      priceIdr: menuItemVersions.priceIdr,
      taxProfileVersionId: menuItemVersions.taxProfileVersionId,
      taxRate: taxProfileVersions.taxRate,
      serviceChargeRate: taxProfileVersions.serviceChargeRate,
      taxInclusive: taxProfileVersions.taxInclusive,
      serviceChargeInclusive: taxProfileVersions.serviceChargeInclusive,
      noTax: taxProfileVersions.noTax,
      effectiveFrom: menuItemVersions.effectiveFrom,
    })
    .from(menuCategories)
    .innerJoin(menuItems, eq(menuItems.categoryId, menuCategories.id))
    .innerJoin(menuItemVersions, eq(menuItemVersions.menuItemId, menuItems.id))
    .leftJoin(
      taxProfileVersions,
      eq(taxProfileVersions.id, menuItemVersions.taxProfileVersionId),
    )
    .where(
      and(
        eq(menuCategories.propertyId, params.propertyId),
        eq(menuCategories.status, "ACTIVE"),
        eq(menuItems.status, "ACTIVE"),
        eq(menuItemVersions.lifecycleStatus, "ACTIVE"),
        lte(menuItemVersions.effectiveFrom, now),
        or(
          isNull(menuItemVersions.effectiveTo),
          gt(menuItemVersions.effectiveTo, now),
        ),
      ),
    )
    .orderBy(
      asc(menuCategories.sortOrder),
      asc(menuCategories.code),
      asc(menuItems.sortOrder),
      asc(menuItems.code),
      desc(menuItemVersions.effectiveFrom),
    );

  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows)
    if (!latest.has(row.itemId)) latest.set(row.itemId, row);
  const rateRows = await db
    .select({
      currency: exchangeRateSnapshots.quoteCurrency,
      rate: exchangeRateSnapshots.rate,
      asOfAt: exchangeRateSnapshots.asOfAt,
    })
    .from(exchangeRateSnapshots)
    .where(
      and(
        eq(exchangeRateSnapshots.propertyId, params.propertyId),
        inArray(exchangeRateSnapshots.quoteCurrency, ["USD", "AUD"]),
        lte(exchangeRateSnapshots.asOfAt, now),
        gt(exchangeRateSnapshots.expiresAt, now),
      ),
    )
    .orderBy(desc(exchangeRateSnapshots.asOfAt));
  const displayRates: Record<string, number> = {};
  for (const rate of rateRows) {
    if (!displayRates[rate.currency])
      displayRates[rate.currency] = Number(rate.rate);
  }

  const categories = new Map<string, PublicMenuCategory>();
  for (const item of latest.values()) {
    const category = categories.get(item.categoryId) ?? {
      id: item.categoryId,
      code: item.categoryCode,
      name: params.locale === "en" ? item.categoryNameEn : item.categoryNameId,
      sortOrder: item.categorySortOrder,
      items: [],
    };
    const amounts = calculateFoodLineAmounts({
      unitPriceIdr: Number(item.priceIdr),
      quantity: 1,
      taxRate: Number(item.taxRate ?? 0),
      serviceChargeRate: Number(item.serviceChargeRate ?? 0),
      taxInclusive: item.taxInclusive ?? false,
      serviceChargeInclusive: item.serviceChargeInclusive ?? false,
      noTax: item.noTax ?? !item.taxProfileVersionId,
    });
    category.items.push({
      id: item.itemId,
      code: item.itemCode,
      versionId: item.versionId,
      versionNumber: item.versionNumber,
      name: params.locale === "en" ? item.nameEn : item.nameId,
      description:
        (params.locale === "en" ? item.descriptionEn : item.descriptionId) ??
        item.descriptionId ??
        item.descriptionEn,
      available: item.available,
      priceIdr: Number(item.priceIdr),
      estimatedTotalIdr: amounts.totalAmountIdr,
      taxIncluded: Boolean(item.taxInclusive),
      serviceChargeIncluded: Boolean(item.serviceChargeInclusive),
    });
    categories.set(item.categoryId, category);
  }
  return {
    locale: params.locale,
    officialCurrency: "IDR" as const,
    displayRates,
    categories: [...categories.values()],
    generatedAt: now.toISOString(),
  };
}

type PaperOrderItemInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  unitPriceOverrideIdr?: number;
  discountAmountIdr?: number;
  overrideReason?: string;
  guestInformed?: boolean;
};

export async function createPaperFoodOrder(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  settlementRoute: "STANDALONE" | "ROOM_CHARGE";
  customerName?: string;
  notes?: string;
  roomStayId?: string;
  expectedRoomNumber?: string;
  expectedLeadGuestName?: string;
  billingBucketId?: string;
  serviceDate?: string;
  items: PaperOrderItemInput[];
  now?: Date;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.order.manage",
  );
  if (params.settlementRoute === "ROOM_CHARGE") {
    await requirePermission(
      params.session,
      params.propertyId,
      "fnb.charge.manage",
    );
    await requirePermission(
      params.session,
      params.propertyId,
      "fnb.guest_lookup.view",
    );
  }
  if (params.items.length === 0 || params.items.length > 50) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Between one and 50 food order items are required",
    );
  }
  const now = params.now ?? new Date();
  const orderDate = toJakartaDateString(now);
  return withIdempotency(
    {
      scope: "fnb.paper_order.create",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({ ...params, session: undefined }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const sequence = await tx.execute<{ issuedValue: number }>(sql`
        insert into document_sequences
          (property_id, document_type, period_key, prefix, next_value, padding)
        values (
          ${params.propertyId},
          'FNB_ORDER',
          ${orderDate},
          ${orderDate.slice(2).replaceAll("-", "")},
          2,
          2
        )
        on conflict (property_id, document_type, period_key)
        do update set
          next_value = document_sequences.next_value + 1,
          prefix = excluded.prefix,
          padding = excluded.padding,
          updated_at = now(),
          version = document_sequences.version + 1
        returning next_value - 1 as "issuedValue"
      `);
      let issuedValue = Number(sequence.rows[0]?.issuedValue);
      let paperReference = formatDailyFoodOrderReference(
        orderDate,
        issuedValue,
      );
      for (let attempts = 0; attempts < 1_000; attempts += 1) {
        const [duplicate] = await tx
          .select({ id: foodOrders.id })
          .from(foodOrders)
          .where(
            and(
              eq(foodOrders.propertyId, params.propertyId),
              eq(foodOrders.paperReference, paperReference),
            ),
          )
          .limit(1)
          .for("update");
        if (!duplicate) break;

        const nextSequence = await tx.execute<{ issuedValue: number }>(sql`
          update document_sequences
             set next_value = next_value + 1,
                 updated_at = now(),
                 version = version + 1
           where property_id = ${params.propertyId}
             and document_type = 'FNB_ORDER'
             and period_key = ${orderDate}
          returning next_value - 1 as "issuedValue"
        `);
        issuedValue = Number(nextSequence.rows[0]?.issuedValue);
        paperReference = formatDailyFoodOrderReference(orderDate, issuedValue);
        if (attempts === 999) {
          throw new AppError(
            "CONFLICT",
            "Daily food order sequence is exhausted",
          );
        }
      }

      const requestedIds = [
        ...new Set(params.items.map((item) => item.menuItemId)),
      ];
      const menuRows = await tx
        .select({
          itemId: menuItems.id,
          itemCode: menuItems.code,
          available: menuItems.currentlyAvailable,
          versionId: menuItemVersions.id,
          versionNumber: menuItemVersions.versionNumber,
          nameId: menuItemVersions.nameId,
          priceIdr: menuItemVersions.priceIdr,
          taxProfileVersionId: menuItemVersions.taxProfileVersionId,
          taxRate: taxProfileVersions.taxRate,
          serviceChargeRate: taxProfileVersions.serviceChargeRate,
          taxInclusive: taxProfileVersions.taxInclusive,
          serviceChargeInclusive: taxProfileVersions.serviceChargeInclusive,
          noTax: taxProfileVersions.noTax,
          effectiveFrom: menuItemVersions.effectiveFrom,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .innerJoin(
          menuItemVersions,
          eq(menuItemVersions.menuItemId, menuItems.id),
        )
        .leftJoin(
          taxProfileVersions,
          eq(taxProfileVersions.id, menuItemVersions.taxProfileVersionId),
        )
        .where(
          and(
            inArray(menuItems.id, requestedIds),
            eq(menuCategories.propertyId, params.propertyId),
            eq(menuItems.status, "ACTIVE"),
            eq(menuItems.currentlyAvailable, true),
            eq(menuItemVersions.lifecycleStatus, "ACTIVE"),
            lte(menuItemVersions.effectiveFrom, now),
            or(
              isNull(menuItemVersions.effectiveTo),
              gt(menuItemVersions.effectiveTo, now),
            ),
          ),
        )
        .orderBy(desc(menuItemVersions.effectiveFrom));
      const active = new Map<string, (typeof menuRows)[number]>();
      for (const row of menuRows)
        if (!active.has(row.itemId)) active.set(row.itemId, row);
      if (active.size !== requestedIds.length) {
        throw new AppError(
          "CONFLICT",
          "One or more menu items are unavailable",
        );
      }

      let roomTarget:
        | {
            roomStayId: string;
            reservationId: string;
            reservationRoomId: string;
            folioId: string;
            billingBucketId: string;
            roomUnitId: string;
            roomNumber: string;
            leadGuestId: string;
            leadGuestName: string;
          }
        | undefined;
      if (params.settlementRoute === "ROOM_CHARGE") {
        if (
          !params.roomStayId ||
          !params.expectedRoomNumber ||
          !params.expectedLeadGuestName
        ) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Room and lead guest verification are required",
          );
        }
        const targetRows = await tx.execute<{
          roomStayId: string;
          stayStatus: string;
          chargePrivilege: string;
          reservationId: string;
          reservationRoomId: string;
          folioId: string;
          folioStatus: string;
          billingBucketId: string;
          roomUnitId: string;
          roomNumber: string;
          leadGuestId: string;
          leadGuestName: string;
        }>(sql`
          select rs.id as "roomStayId", rs.status as "stayStatus", rs.charge_privilege as "chargePrivilege",
                  r.id as "reservationId", rs.reservation_room_id as "reservationRoomId",
                  f.id as "folioId", f.status as "folioStatus", fb.id as "billingBucketId",
                  ru.id as "roomUnitId", ru.room_number as "roomNumber",
                  coalesce(g.id, rg.guest_id) as "leadGuestId",
                  coalesce(g.full_name, r.booker_name) as "leadGuestName"
             from room_stays rs
             join reservation_rooms rr on rr.id = rs.reservation_room_id
             join reservations r on r.id = rr.reservation_id
             join folios f on f.reservation_id = r.id
             join room_assignments ra on ra.room_stay_id = rs.id and ra.status = 'ACTIVE'
             join room_units ru on ru.id = ra.room_unit_id
             left join guests g on g.id = rs.lead_guest_id
             left join lateral (
               select reservation_guest.guest_id
               from reservation_guests reservation_guest
               where reservation_guest.reservation_id = r.id
                 and reservation_guest.role = 'BOOKER'
               order by reservation_guest.created_at
               limit 1
             ) rg on true
             join folio_billing_buckets fb on fb.folio_id = f.id and fb.status = 'ACTIVE'
            where rs.id = ${params.roomStayId}
              and r.property_id = ${params.propertyId}
              and (${params.billingBucketId ?? null}::uuid is null or fb.id = ${params.billingBucketId ?? null}::uuid)
            order by case
              when fb.code = 'MASTER' then 0
              when fb.code = 'MAIN' then 1
              else 2
            end, fb.code
            limit 1 for update of rs, f, fb, ra, ru
        `);
        const resolved = targetRows.rows[0];
        if (!resolved)
          throw new AppError("NOT_FOUND", "Active room stay not found");
        if (!["IN_HOUSE", "DUE_OUT"].includes(resolved.stayStatus)) {
          throw new AppError("CONFLICT", "Room stay is not currently in house");
        }
        if (resolved.chargePrivilege !== "ALLOWED") {
          throw new AppError(
            "CONFLICT",
            "Room charge privilege is not allowed",
          );
        }
        if (resolved.folioStatus !== "OPEN") {
          throw new AppError("CONFLICT", "Tagihan tamu sudah ditutup");
        }
        if (
          resolved.roomNumber.trim().toLowerCase() !==
            params.expectedRoomNumber.trim().toLowerCase() ||
          resolved.leadGuestName.trim().toLowerCase() !==
            params.expectedLeadGuestName.trim().toLowerCase()
        ) {
          throw new AppError(
            "CONFLICT",
            "Room or lead guest verification failed",
          );
        }
        roomTarget = resolved;
      }

      const [order] = await tx
        .insert(foodOrders)
        .values({
          propertyId: params.propertyId,
          orderCode: `FNB-${paperReference}`,
          paperReference,
          reservationId: roomTarget?.reservationId,
          reservationRoomId: roomTarget?.reservationRoomId,
          roomStayId: roomTarget?.roomStayId,
          folioId: roomTarget?.folioId,
          billingBucketId: roomTarget?.billingBucketId,
          settlementRoute: params.settlementRoute,
          status: "PREPARING",
          customerName: params.customerName ?? roomTarget?.leadGuestName,
          notes: params.notes,
          enteredByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: foodOrders.id, orderCode: foodOrders.orderCode });
      if (!order) throw new Error("Failed to create food order");

      let orderTotalIdr = 0;
      const createdItems: Array<{ id: string; folioEntryId: string | null }> =
        [];
      for (const input of params.items) {
        const menu = active.get(input.menuItemId)!;
        const activePrice = Number(menu.priceIdr);
        const unitPriceIdr = input.unitPriceOverrideIdr ?? activePrice;
        if (unitPriceIdr !== activePrice) {
          if (!input.overrideReason?.trim() || !input.guestInformed) {
            throw new AppError(
              "VALIDATION_ERROR",
              "Printed-price override requires reason and guest confirmation",
            );
          }
        }
        const amounts = calculateFoodLineAmounts({
          unitPriceIdr,
          quantity: input.quantity,
          discountAmountIdr: input.discountAmountIdr,
          taxRate: Number(menu.taxRate ?? 0),
          serviceChargeRate: Number(menu.serviceChargeRate ?? 0),
          taxInclusive: menu.taxInclusive ?? false,
          serviceChargeInclusive: menu.serviceChargeInclusive ?? false,
          noTax: menu.noTax ?? !menu.taxProfileVersionId,
        });
        const [item] = await tx
          .insert(foodOrderItems)
          .values({
            foodOrderId: order.id,
            menuItemVersionId: menu.versionId,
            quantity: String(input.quantity),
            unitPriceIdr: String(unitPriceIdr),
            taxAmountIdr: String(amounts.taxAmountIdr),
            serviceChargeAmountIdr: String(amounts.serviceChargeAmountIdr),
            discountAmountIdr: String(amounts.discountAmountIdr),
            totalIdr: String(amounts.totalAmountIdr),
            priceTaxSnapshot: {
              source: "PAPER_ROOM_FORM",
              menuItemId: menu.itemId,
              menuItemCode: menu.itemCode,
              menuVersionId: menu.versionId,
              menuVersionNumber: menu.versionNumber,
              nameId: menu.nameId,
              activeUnitPriceIdr: activePrice,
              enteredUnitPriceIdr: unitPriceIdr,
              overrideReason: input.overrideReason,
              guestInformed: input.guestInformed ?? false,
              taxProfileVersionId: menu.taxProfileVersionId,
              taxRate: menu.taxRate ?? "0",
              serviceChargeRate: menu.serviceChargeRate ?? "0",
              taxInclusive: menu.taxInclusive ?? false,
              serviceChargeInclusive: menu.serviceChargeInclusive ?? false,
              noTax: menu.noTax ?? !menu.taxProfileVersionId,
            },
            notes: input.notes,
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .returning({ id: foodOrderItems.id });
        if (!item) throw new Error("Failed to create food order item");
        let folioEntryId: string | null = null;
        if (roomTarget) {
          const [entry] = await tx
            .insert(folioEntries)
            .values({
              folioId: roomTarget.folioId,
              billingBucketId: roomTarget.billingBucketId,
              entryType: "DEBIT",
              category: "FNB",
              description: `${menu.nameId} · ${order.orderCode}`,
              sourceType: "FOOD_ORDER",
              sourceId: order.id,
              sourceLineId: item.id,
              reservationRoomId: roomTarget.reservationRoomId,
              roomUnitId: roomTarget.roomUnitId,
              guestId: roomTarget.leadGuestId,
              serviceDate: params.serviceDate ?? getBusinessDate(),
              quantity: String(input.quantity),
              unitAmountIdr: String(unitPriceIdr),
              netAmountIdr: String(amounts.netAmountIdr),
              discountAmountIdr: String(amounts.discountAmountIdr),
              serviceChargeAmountIdr: String(amounts.serviceChargeAmountIdr),
              taxAmountIdr: String(amounts.taxAmountIdr),
              totalAmountIdr: String(amounts.totalAmountIdr),
              taxProfileVersionId: menu.taxProfileVersionId,
              pricingSnapshot: {
                source: "FOOD_ORDER",
                orderId: order.id,
                orderItemId: item.id,
                paperReference,
                priceTaxSnapshot: true,
              },
              postedByUserId: params.session.user.id,
              idempotencyKey: `${params.idempotencyKey}:item:${item.id}`,
              createdByUserId: params.session.user.id,
            })
            .returning({ id: folioEntries.id });
          if (!entry) throw new Error("Failed to post food order charge");
          folioEntryId = entry.id;
          await tx
            .update(foodOrderItems)
            .set({ folioEntryId: entry.id, updatedAt: now })
            .where(eq(foodOrderItems.id, item.id));
        }
        orderTotalIdr += amounts.totalAmountIdr;
        createdItems.push({ id: item.id, folioEntryId });
      }
      await tx.insert(foodOrderEvents).values({
        foodOrderId: order.id,
        action: "PAPER_ORDER_ENTERED",
        toStatus: "PREPARING",
        notes: `Paper ${paperReference}`,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "fnb.paper_order.create",
          targetType: "food_order",
          targetId: order.id,
          after: {
            orderCode: order.orderCode,
            paperReference,
            settlementRoute: params.settlementRoute,
            itemCount: createdItems.length,
            orderTotalIdr,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "food_order",
        resultId: order.id,
        response: {
          orderId: order.id,
          orderCode: order.orderCode,
          paperReference,
          status: "PREPARING",
          settlementRoute: params.settlementRoute,
          orderTotalIdr,
          items: createdItems,
        },
      };
    },
  );
}

export async function setRoomChargePrivilege(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  roomStayId: string;
  privilege: "ALLOWED" | "NOT_ALLOWED" | "APPROVAL_REQUIRED";
  reason: string;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: "fnb.room_charge_privilege.set",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const rows = await tx.execute<{
        id: string;
        chargePrivilege: string;
      }>(sql`
        select rs.id, rs.charge_privilege as "chargePrivilege"
           from room_stays rs
           join reservation_rooms rr on rr.id = rs.reservation_room_id
           join reservations r on r.id = rr.reservation_id
          where rs.id = ${params.roomStayId} and r.property_id = ${params.propertyId}
          for update
      `);
      const stay = rows.rows[0];
      if (!stay) throw new AppError("NOT_FOUND", "Room stay not found");
      await tx
        .update(roomStays)
        .set({
          chargePrivilege: params.privilege,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(roomStays.id, params.roomStayId));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "fnb.room_charge_privilege.set",
          targetType: "room_stay",
          targetId: params.roomStayId,
          before: { chargePrivilege: stay.chargePrivilege },
          after: { chargePrivilege: params.privilege },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_stay",
        resultId: params.roomStayId,
        response: {
          roomStayId: params.roomStayId,
          chargePrivilege: params.privilege,
        },
      };
    },
  );
}

export async function getFoodOrderQueue(params: {
  propertyId: string;
  session: FnbStaffSession;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.order.manage",
  );
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.guest_lookup.view",
  );
  const db = getDatabase();
  const orders = await db
    .select({
      id: foodOrders.id,
      orderCode: foodOrders.orderCode,
      paperReference: foodOrders.paperReference,
      settlementRoute: foodOrders.settlementRoute,
      status: foodOrders.status,
      customerName: foodOrders.customerName,
      roomStayId: foodOrders.roomStayId,
      folioId: foodOrders.folioId,
      notes: foodOrders.notes,
      createdAt: foodOrders.createdAt,
    })
    .from(foodOrders)
    .where(
      and(
        eq(foodOrders.propertyId, params.propertyId),
        notInArray(foodOrders.status, ["SERVED", "COMPLETED", "CANCELLED"]),
      ),
    )
    .orderBy(desc(foodOrders.createdAt));
  return enrichFoodOrders(orders);
}

type FoodOrderQueueRow = {
  id: string;
  orderCode: string;
  paperReference: string;
  settlementRoute: string;
  status: string;
  customerName: string | null;
  roomStayId: string | null;
  folioId: string | null;
  notes: string | null;
  createdAt: Date | string | null;
};

async function enrichFoodOrders(orders: FoodOrderQueueRow[]) {
  if (orders.length === 0) return [];

  const db = getDatabase();
  const orderIds = orders.map((order) => order.id);
  const items = await db
    .select({
      id: foodOrderItems.id,
      foodOrderId: foodOrderItems.foodOrderId,
      name: sql<string>`coalesce(${foodOrderItems.priceTaxSnapshot} ->> 'nameId', 'Menu')`,
      quantity: foodOrderItems.quantity,
      unitPriceIdr: foodOrderItems.unitPriceIdr,
      taxAmountIdr: foodOrderItems.taxAmountIdr,
      serviceChargeAmountIdr: foodOrderItems.serviceChargeAmountIdr,
      discountAmountIdr: foodOrderItems.discountAmountIdr,
      totalIdr: foodOrderItems.totalIdr,
      notes: foodOrderItems.notes,
    })
    .from(foodOrderItems)
    .where(inArray(foodOrderItems.foodOrderId, orderIds))
    .orderBy(asc(foodOrderItems.createdAt), asc(foodOrderItems.id));
  const paymentRows = await db
    .select({
      foodOrderId: foodOrderPayments.foodOrderId,
      amountIdr: foodOrderPayments.amountIdr,
    })
    .from(foodOrderPayments)
    .where(
      and(
        inArray(foodOrderPayments.foodOrderId, orderIds),
        eq(foodOrderPayments.status, "PAID"),
      ),
    );
  const receiptRows = await db
    .select({
      id: foodOrderReceipts.id,
      foodOrderId: foodOrderReceipts.foodOrderId,
      receiptCode: foodOrderReceipts.receiptCode,
      recipientName: foodOrderReceipts.recipientName,
      status: foodOrderReceipts.status,
      issuedAt: foodOrderReceipts.issuedAt,
    })
    .from(foodOrderReceipts)
    .where(inArray(foodOrderReceipts.foodOrderId, orderIds));

  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const current = itemsByOrder.get(item.foodOrderId) ?? [];
    current.push(item);
    itemsByOrder.set(item.foodOrderId, current);
  }
  const paidByOrder = new Map<string, number>();
  for (const payment of paymentRows) {
    paidByOrder.set(
      payment.foodOrderId,
      (paidByOrder.get(payment.foodOrderId) ?? 0) + Number(payment.amountIdr),
    );
  }
  const receiptByOrder = new Map(
    receiptRows.map((receipt) => [receipt.foodOrderId, receipt]),
  );

  return orders.map((order) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    const receipt = receiptByOrder.get(order.id);
    return {
      ...order,
      createdAt: databaseDate(order.createdAt),
      items: orderItems,
      orderTotalIdr: String(
        orderItems.reduce((sum, item) => sum + Number(item.totalIdr), 0),
      ),
      paidAmountIdr: String(paidByOrder.get(order.id) ?? 0),
      receiptId: receipt?.id ?? null,
      receiptCode: receipt?.receiptCode ?? null,
      receiptStatus: receipt?.status ?? null,
      receiptRecipientName: receipt?.recipientName ?? null,
      receiptIssuedAt: receipt?.issuedAt ?? null,
    };
  });
}

export async function getFoodOrderPage(params: {
  propertyId: string;
  session: FnbStaffSession;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.order.manage",
  );
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.guest_lookup.view",
  );
  const search = params.search?.trim().slice(0, 120) ?? "";
  const status = params.status?.trim().slice(0, 40) || "ALL";
  const filteredStatuses = foodOrderStatusesForFilter(status);
  const statusCondition = filteredStatuses
    ? inArray(foodOrders.status, filteredStatuses)
    : sql`true`;
  const offset = (params.page - 1) * params.pageSize;
  const database = getDatabase();
  const [countResult, rowsResult] = await Promise.all([
    database.execute<{ total: string }>(sql`
      select count(*)::text as total
      from food_orders
      where property_id = ${params.propertyId}
        and (${search} = '' or order_code ilike ${`%${search}%`}
          or paper_reference ilike ${`%${search}%`}
          or coalesce(customer_name, '') ilike ${`%${search}%`})
        and ${statusCondition}
    `),
    database.execute<FoodOrderQueueRow>(sql`
      select id, order_code as "orderCode", paper_reference as "paperReference",
        settlement_route as "settlementRoute", status,
        customer_name as "customerName", room_stay_id as "roomStayId",
        folio_id as "folioId", notes, created_at as "createdAt"
      from food_orders
      where property_id = ${params.propertyId}
        and (${search} = '' or order_code ilike ${`%${search}%`}
          or paper_reference ilike ${`%${search}%`}
          or coalesce(customer_name, '') ilike ${`%${search}%`})
        and ${statusCondition}
      order by created_at desc, id desc
      limit ${params.pageSize} offset ${offset}
    `),
  ]);
  const totalItems = Number(countResult.rows[0]?.total ?? 0);
  return {
    orders: await enrichFoodOrders(rowsResult.rows),
    pagination: paginationMeta(params.page, params.pageSize, totalItems),
  };
}

export async function getStandaloneFoodInvoice(params: {
  propertyId: string;
  foodOrderId: string;
  session: FnbStaffSession;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.charge.manage",
  );
  const db = getDatabase();
  const [document] = await db
    .select({
      foodOrderId: foodOrders.id,
      orderCode: foodOrders.orderCode,
      paperReference: foodOrders.paperReference,
      customerName: foodOrders.customerName,
      orderStatus: foodOrders.status,
      settlementRoute: foodOrders.settlementRoute,
      orderNotes: foodOrders.notes,
      orderedAt: foodOrders.createdAt,
      propertyName: properties.name,
      propertyAddress: properties.address,
      paymentCode: foodOrderPayments.paymentCode,
      paymentMethod: foodOrderPayments.method,
      paymentReference: foodOrderPayments.reference,
      paidAmountIdr: foodOrderPayments.amountIdr,
      paidAt: foodOrderPayments.receivedAt,
      receiptId: foodOrderReceipts.id,
      receiptCode: foodOrderReceipts.receiptCode,
      receiptStatus: foodOrderReceipts.status,
      recipientName: foodOrderReceipts.recipientName,
      issuedAt: foodOrderReceipts.issuedAt,
    })
    .from(foodOrders)
    .innerJoin(properties, eq(properties.id, foodOrders.propertyId))
    .innerJoin(
      foodOrderPayments,
      and(
        eq(foodOrderPayments.foodOrderId, foodOrders.id),
        eq(foodOrderPayments.status, "PAID"),
      ),
    )
    .innerJoin(
      foodOrderReceipts,
      and(
        eq(foodOrderReceipts.foodOrderId, foodOrders.id),
        eq(foodOrderReceipts.paymentId, foodOrderPayments.id),
        eq(foodOrderReceipts.status, "ISSUED"),
      ),
    )
    .where(
      and(
        eq(foodOrders.id, params.foodOrderId),
        eq(foodOrders.propertyId, params.propertyId),
        eq(foodOrders.settlementRoute, "STANDALONE"),
      ),
    )
    .limit(1);
  if (!document)
    throw new AppError(
      "NOT_FOUND",
      "Invoice F&B tersedia setelah pembayaran standalone tercatat",
    );

  const items = await db
    .select({
      id: foodOrderItems.id,
      name: sql<string>`coalesce(${foodOrderItems.priceTaxSnapshot} ->> 'nameId', 'Menu')`,
      quantity: foodOrderItems.quantity,
      unitPriceIdr: foodOrderItems.unitPriceIdr,
      taxAmountIdr: foodOrderItems.taxAmountIdr,
      serviceChargeAmountIdr: foodOrderItems.serviceChargeAmountIdr,
      discountAmountIdr: foodOrderItems.discountAmountIdr,
      totalIdr: foodOrderItems.totalIdr,
      notes: foodOrderItems.notes,
    })
    .from(foodOrderItems)
    .where(eq(foodOrderItems.foodOrderId, document.foodOrderId))
    .orderBy(asc(foodOrderItems.createdAt), asc(foodOrderItems.id));
  if (!items.length)
    throw new AppError("CONFLICT", "Pesanan F&B tidak memiliki item");

  const totals = items.reduce(
    (result, item) => ({
      subtotalIdr:
        result.subtotalIdr + Number(item.unitPriceIdr) * Number(item.quantity),
      taxIdr: result.taxIdr + Number(item.taxAmountIdr),
      serviceChargeIdr:
        result.serviceChargeIdr + Number(item.serviceChargeAmountIdr),
      discountIdr: result.discountIdr + Number(item.discountAmountIdr),
      totalIdr: result.totalIdr + Number(item.totalIdr),
    }),
    {
      subtotalIdr: 0,
      taxIdr: 0,
      serviceChargeIdr: 0,
      discountIdr: 0,
      totalIdr: 0,
    },
  );
  if (totals.totalIdr !== Number(document.paidAmountIdr))
    throw new AppError(
      "CONFLICT",
      "Total invoice dan pembayaran F&B tidak sesuai",
    );

  return { ...document, items, ...totals, currency: "IDR" as const };
}

export async function transitionFoodOrder(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  foodOrderId: string;
  toStatus: Exclude<FoodOrderStatus, "CANCELLED">;
  notes?: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.order.manage",
  );
  return withIdempotency(
    {
      scope: "fnb.order.transition",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [order] = await tx
        .select({ id: foodOrders.id, status: foodOrders.status })
        .from(foodOrders)
        .where(
          and(
            eq(foodOrders.id, params.foodOrderId),
            eq(foodOrders.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!order) throw new AppError("NOT_FOUND", "Food order not found");
      assertFoodOrderTransition(
        order.status as FoodOrderStatus,
        params.toStatus,
      );
      await tx
        .update(foodOrders)
        .set({
          status: params.toStatus,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(foodOrders.id, order.id));
      await tx.insert(foodOrderEvents).values({
        foodOrderId: order.id,
        action: "STATUS_CHANGED",
        fromStatus: order.status,
        toStatus: params.toStatus,
        notes: params.notes,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      return {
        resultType: "food_order",
        resultId: order.id,
        response: { foodOrderId: order.id, status: params.toStatus },
      };
    },
  );
}

export async function cancelFoodOrder(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  foodOrderId: string;
  reason: string;
  serviceDate?: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.order.manage",
  );
  return withIdempotency(
    {
      scope: "fnb.order.cancel",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [order] = await tx
        .select({
          id: foodOrders.id,
          status: foodOrders.status,
          settlementRoute: foodOrders.settlementRoute,
        })
        .from(foodOrders)
        .where(
          and(
            eq(foodOrders.id, params.foodOrderId),
            eq(foodOrders.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!order) throw new AppError("NOT_FOUND", "Food order not found");
      assertFoodOrderTransition(order.status as FoodOrderStatus, "CANCELLED");
      const entries = await tx
        .select()
        .from(folioEntries)
        .where(
          and(
            eq(folioEntries.sourceType, "FOOD_ORDER"),
            eq(folioEntries.sourceId, order.id),
            eq(folioEntries.entryType, "DEBIT"),
          ),
        );
      const reversalIds: string[] = [];
      for (const source of entries) {
        const [reversal] = await tx
          .insert(folioEntries)
          .values({
            folioId: source.folioId,
            billingBucketId: source.billingBucketId,
            entryType: "CREDIT",
            category: "REVERSAL",
            description: `F&B cancellation: ${source.description}`,
            sourceType: "FOOD_ORDER_REVERSAL",
            sourceId: order.id,
            sourceLineId: source.sourceLineId,
            reservationRoomId: source.reservationRoomId,
            roomUnitId: source.roomUnitId,
            guestId: source.guestId,
            serviceDate: params.serviceDate ?? getBusinessDate(),
            quantity: source.quantity,
            unitAmountIdr: source.unitAmountIdr,
            netAmountIdr: source.netAmountIdr,
            discountAmountIdr: source.discountAmountIdr,
            serviceChargeAmountIdr: source.serviceChargeAmountIdr,
            taxAmountIdr: source.taxAmountIdr,
            totalAmountIdr: source.totalAmountIdr,
            taxProfileVersionId: source.taxProfileVersionId,
            pricingSnapshot: {
              cancellationReason: params.reason,
              originalEntryId: source.id,
            },
            reversalOfEntryId: source.id,
            postedByUserId: params.session.user.id,
            idempotencyKey: `${params.idempotencyKey}:reverse:${source.id}`,
            createdByUserId: params.session.user.id,
          })
          .returning({ id: folioEntries.id });
        if (!reversal) throw new Error("Failed to reverse food charge");
        reversalIds.push(reversal.id);
      }
      await tx
        .update(foodOrders)
        .set({
          status: "CANCELLED",
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(foodOrders.id, order.id));
      await tx.insert(foodOrderEvents).values({
        foodOrderId: order.id,
        action: "CANCELLED",
        fromStatus: order.status,
        toStatus: "CANCELLED",
        notes: params.reason,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      const payments = await tx
        .select({ status: foodOrderPayments.status })
        .from(foodOrderPayments)
        .where(eq(foodOrderPayments.foodOrderId, order.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "fnb.order.cancel",
          targetType: "food_order",
          targetId: order.id,
          before: { status: order.status },
          after: { status: "CANCELLED", reversalIds },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "food_order",
        resultId: order.id,
        response: {
          foodOrderId: order.id,
          status: "CANCELLED",
          reversalIds,
          paidStandaloneRequiresRefund: payments.some(
            (payment) => payment.status === "PAID",
          ),
        },
      };
    },
  );
}

export async function recordStandaloneFoodPayment(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  foodOrderId: string;
  method: "CASH" | "BANK_TRANSFER" | "OTHER";
  amountIdr: number;
  reference?: string;
  recipientName: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.charge.manage",
  );
  return withIdempotency(
    {
      scope: "fnb.standalone_payment.record",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [order] = await tx
        .select({
          id: foodOrders.id,
          orderCode: foodOrders.orderCode,
          status: foodOrders.status,
          settlementRoute: foodOrders.settlementRoute,
        })
        .from(foodOrders)
        .where(
          and(
            eq(foodOrders.id, params.foodOrderId),
            eq(foodOrders.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!order) throw new AppError("NOT_FOUND", "Food order not found");
      if (order.settlementRoute !== "STANDALONE") {
        throw new AppError("CONFLICT", "Order is not standalone");
      }
      if (order.status === "CANCELLED") {
        throw new AppError("CONFLICT", "Cancelled order cannot be paid");
      }
      const items = await tx
        .select({ totalIdr: foodOrderItems.totalIdr })
        .from(foodOrderItems)
        .where(eq(foodOrderItems.foodOrderId, order.id));
      const totalIdr = items.reduce(
        (sum, item) => sum + Number(item.totalIdr),
        0,
      );
      if (params.amountIdr !== totalIdr || totalIdr <= 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Standalone payment must equal the order total",
        );
      }
      const existing = await tx
        .select({ id: foodOrderPayments.id })
        .from(foodOrderPayments)
        .where(
          and(
            eq(foodOrderPayments.foodOrderId, order.id),
            eq(foodOrderPayments.status, "PAID"),
          ),
        );
      if (existing.length) {
        throw new AppError("CONFLICT", "Food order is already paid");
      }
      const paymentCode = `FPY-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const [payment] = await tx
        .insert(foodOrderPayments)
        .values({
          foodOrderId: order.id,
          paymentCode,
          method: params.method,
          amountIdr: String(params.amountIdr),
          status: "PAID",
          reference: params.reference,
          receivedByUserId: params.session.user.id,
          idempotencyKey: params.idempotencyKey,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: foodOrderPayments.id });
      if (!payment) throw new Error("Failed to record standalone payment");
      const receiptCode = `FRC-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const [receipt] = await tx
        .insert(foodOrderReceipts)
        .values({
          foodOrderId: order.id,
          paymentId: payment.id,
          receiptCode,
          status: "ISSUED",
          recipientName: params.recipientName,
          totalsSnapshot: {
            orderCode: order.orderCode,
            totalIdr,
            officialCurrency: "IDR",
            method: params.method,
          },
          issuedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: foodOrderReceipts.id });
      if (!receipt) throw new Error("Failed to issue standalone receipt");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "fnb.standalone_payment.record",
          targetType: "food_order_payment",
          targetId: payment.id,
          after: { orderId: order.id, amountIdr: totalIdr, receiptCode },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "food_order_payment",
        resultId: payment.id,
        response: {
          foodOrderId: order.id,
          paymentId: payment.id,
          paymentCode,
          receiptId: receipt.id,
          receiptCode,
          amountIdr: totalIdr,
          status: "PAID",
        },
      };
    },
  );
}
