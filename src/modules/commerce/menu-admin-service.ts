import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  menuCategories,
  menuItems,
  menuItemVersions,
  taxProfiles,
  taxProfileVersions,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import { stableRequestHash } from "../booking/domain";
import type { FnbStaffSession } from "./fnb-service";

function code(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_");
  if (!normalized)
    throw new AppError("VALIDATION_ERROR", "Menu code is required");
  return normalized;
}

function isMenuSortColumnMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = String(error.message || "").toLowerCase();
  return (
    /sort_order/.test(message) &&
    (error as Error & { code?: string }).code === "42703"
  );
}

function getMenuAdminOverviewLegacy(params: {
  propertyId: string;
  session: FnbStaffSession;
}) {
  return getDatabase()
    .select({
      categoryId: menuCategories.id,
      categoryCode: menuCategories.code,
      categoryNameId: menuCategories.nameId,
      categoryNameEn: menuCategories.nameEn,
      categoryStatus: menuCategories.status,
      categorySortOrder: sql<number>`0`,
      itemId: menuItems.id,
      itemCode: menuItems.code,
      itemSortOrder: sql<number>`0`,
      itemStatus: menuItems.status,
      currentlyAvailable: menuItems.currentlyAvailable,
      versionId: menuItemVersions.id,
      versionNumber: menuItemVersions.versionNumber,
      nameId: menuItemVersions.nameId,
      nameEn: menuItemVersions.nameEn,
      priceIdr: menuItemVersions.priceIdr,
      taxProfileVersionId: menuItemVersions.taxProfileVersionId,
      lifecycleStatus: menuItemVersions.lifecycleStatus,
      effectiveFrom: menuItemVersions.effectiveFrom,
      effectiveTo: menuItemVersions.effectiveTo,
    })
    .from(menuCategories)
    .leftJoin(menuItems, eq(menuItems.categoryId, menuCategories.id))
    .leftJoin(menuItemVersions, eq(menuItemVersions.menuItemId, menuItems.id))
    .where(eq(menuCategories.propertyId, params.propertyId))
    .orderBy(menuCategories.code, desc(menuItemVersions.versionNumber));
}

export async function getMenuAdminOverview(params: {
  propertyId: string;
  session: FnbStaffSession;
}) {
  await requirePermission(params.session, params.propertyId, "commercial.view");
  try {
    return await getDatabase()
      .select({
        categoryId: menuCategories.id,
        categoryCode: menuCategories.code,
        categoryNameId: menuCategories.nameId,
        categoryNameEn: menuCategories.nameEn,
        categoryStatus: menuCategories.status,
        categorySortOrder: menuCategories.sortOrder,
        itemId: menuItems.id,
        itemCode: menuItems.code,
        itemSortOrder: menuItems.sortOrder,
        itemStatus: menuItems.status,
        currentlyAvailable: menuItems.currentlyAvailable,
        versionId: menuItemVersions.id,
        versionNumber: menuItemVersions.versionNumber,
        nameId: menuItemVersions.nameId,
        nameEn: menuItemVersions.nameEn,
        priceIdr: menuItemVersions.priceIdr,
        taxProfileVersionId: menuItemVersions.taxProfileVersionId,
        lifecycleStatus: menuItemVersions.lifecycleStatus,
        effectiveFrom: menuItemVersions.effectiveFrom,
        effectiveTo: menuItemVersions.effectiveTo,
      })
      .from(menuCategories)
      .leftJoin(menuItems, eq(menuItems.categoryId, menuCategories.id))
      .leftJoin(menuItemVersions, eq(menuItemVersions.menuItemId, menuItems.id))
      .where(eq(menuCategories.propertyId, params.propertyId))
      .orderBy(
        menuCategories.sortOrder,
        menuCategories.code,
        desc(menuItemVersions.versionNumber),
      );
  } catch (error) {
    if (isMenuSortColumnMissing(error)) {
      return getMenuAdminOverviewLegacy(params);
    }
    throw error;
  }
}

export async function createMenuCategory(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  categoryCode: string;
  nameId: string;
  nameEn: string;
  sortOrder: number;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const categoryCode = code(params.categoryCode);
  return withIdempotency(
    {
      scope: "commercial.menu.category.create",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [category] = await tx
        .insert(menuCategories)
        .values({
          propertyId: params.propertyId,
          code: categoryCode,
          nameId: params.nameId.trim(),
          nameEn: params.nameEn.trim(),
          sortOrder: params.sortOrder,
          status: "ACTIVE",
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: menuCategories.id });
      if (!category) throw new Error("Failed to create menu category");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "commercial.menu.category.create",
          targetType: "menu_category",
          targetId: category.id,
          after: {
            code: categoryCode,
            nameId: params.nameId,
            nameEn: params.nameEn,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "menu_category",
        resultId: category.id,
        response: { categoryId: category.id, code: categoryCode },
      };
    },
  );
}

export async function createMenuItemVersion(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  categoryId: string;
  itemCode: string;
  nameId: string;
  nameEn: string;
  descriptionId?: string;
  descriptionEn?: string;
  priceIdr: number;
  taxProfileVersionId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  reason: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  if (!Number.isInteger(params.priceIdr) || params.priceIdr < 0) {
    throw new AppError("VALIDATION_ERROR", "Menu price must be whole IDR");
  }
  if (params.effectiveTo && params.effectiveTo <= params.effectiveFrom) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Menu effective end must be after its start",
    );
  }
  const itemCode = code(params.itemCode);
  return withIdempotency(
    {
      scope: "commercial.menu.item_version.create",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [category] = await tx
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(
          and(
            eq(menuCategories.id, params.categoryId),
            eq(menuCategories.propertyId, params.propertyId),
            eq(menuCategories.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!category) throw new AppError("NOT_FOUND", "Menu category not found");
      if (params.taxProfileVersionId) {
        const [tax] = await tx
          .select({ id: taxProfileVersions.id })
          .from(taxProfileVersions)
          .innerJoin(
            taxProfiles,
            eq(taxProfiles.id, taxProfileVersions.taxProfileId),
          )
          .where(
            and(
              eq(taxProfileVersions.id, params.taxProfileVersionId),
              eq(taxProfiles.propertyId, params.propertyId),
              inArray(taxProfileVersions.lifecycleStatus, [
                "ACTIVE",
                "SCHEDULED",
              ]),
            ),
          )
          .limit(1);
        if (!tax)
          throw new AppError("NOT_FOUND", "Tax profile version not found");
      }
      await tx
        .insert(menuItems)
        .values({
          categoryId: category.id,
          code: itemCode,
          status: "ACTIVE",
          currentlyAvailable: true,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .onConflictDoNothing();
      const [item] = await tx
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(
          and(
            eq(menuItems.categoryId, category.id),
            eq(menuItems.code, itemCode),
          ),
        )
        .limit(1)
        .for("update");
      if (!item) throw new Error("Failed to resolve menu item");
      const version = await tx.execute<{ nextVersion: number }>(sql`
        select coalesce(max(version_number), 0)::int + 1 as "nextVersion"
          from menu_item_versions where menu_item_id = ${item.id}
      `);
      const versionNumber = version.rows[0]?.nextVersion ?? 1;
      const [created] = await tx
        .insert(menuItemVersions)
        .values({
          menuItemId: item.id,
          versionNumber,
          nameId: params.nameId.trim(),
          nameEn: params.nameEn.trim(),
          descriptionId: params.descriptionId?.trim(),
          descriptionEn: params.descriptionEn?.trim(),
          priceIdr: String(params.priceIdr),
          taxProfileVersionId: params.taxProfileVersionId,
          lifecycleStatus: "DRAFT",
          effectiveFrom: params.effectiveFrom,
          effectiveTo: params.effectiveTo,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: menuItemVersions.id });
      if (!created) throw new Error("Failed to create menu item version");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "commercial.menu.item_version.create",
          targetType: "menu_item_version",
          targetId: created.id,
          after: {
            itemId: item.id,
            itemCode,
            versionNumber,
            priceIdr: params.priceIdr,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "menu_item_version",
        resultId: created.id,
        response: { menuItemId: item.id, versionId: created.id, versionNumber },
      };
    },
  );
}

export async function activateMenuItemVersion(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  versionId: string;
  reason: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  return withIdempotency(
    {
      scope: "commercial.menu.item_version.activate",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [version] = await tx
        .select({
          id: menuItemVersions.id,
          itemId: menuItems.id,
          status: menuItemVersions.lifecycleStatus,
        })
        .from(menuItemVersions)
        .innerJoin(menuItems, eq(menuItems.id, menuItemVersions.menuItemId))
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(
          and(
            eq(menuItemVersions.id, params.versionId),
            eq(menuCategories.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!version)
        throw new AppError("NOT_FOUND", "Menu item version not found");
      if (version.status !== "DRAFT" && version.status !== "SCHEDULED") {
        throw new AppError(
          "CONFLICT",
          "Only draft or scheduled menu versions can activate",
        );
      }
      await tx
        .update(menuItemVersions)
        .set({
          lifecycleStatus: "RETIRED",
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(
          and(
            eq(menuItemVersions.menuItemId, version.itemId),
            eq(menuItemVersions.lifecycleStatus, "ACTIVE"),
            ne(menuItemVersions.id, version.id),
          ),
        );
      await tx
        .update(menuItemVersions)
        .set({
          lifecycleStatus: "ACTIVE",
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(menuItemVersions.id, version.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "commercial.menu.item_version.activate",
          targetType: "menu_item_version",
          targetId: version.id,
          before: { lifecycleStatus: version.status },
          after: { lifecycleStatus: "ACTIVE" },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "menu_item_version",
        resultId: version.id,
        response: { versionId: version.id, lifecycleStatus: "ACTIVE" },
      };
    },
  );
}

export async function setMenuItemAvailability(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  menuItemId: string;
  available: boolean;
  reason: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "fnb.order.manage",
  );
  return withIdempotency(
    {
      scope: "fnb.menu.availability.set",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [item] = await tx
        .select({ id: menuItems.id, available: menuItems.currentlyAvailable })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(
          and(
            eq(menuItems.id, params.menuItemId),
            eq(menuCategories.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!item) throw new AppError("NOT_FOUND", "Menu item not found");
      await tx
        .update(menuItems)
        .set({
          currentlyAvailable: params.available,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(menuItems.id, item.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "fnb.menu.availability.set",
          targetType: "menu_item",
          targetId: item.id,
          before: { available: item.available },
          after: { available: params.available },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "menu_item",
        resultId: item.id,
        response: { menuItemId: item.id, available: params.available },
      };
    },
  );
}

export async function setMenuCategorySortOrder(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  categoryId: string;
  sortOrder: number;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  return withIdempotency(
    {
      scope: "commercial.menu.category.sort",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [category] = await tx
        .select({
          id: menuCategories.id,
          previousSortOrder: menuCategories.sortOrder,
        })
        .from(menuCategories)
        .where(
          and(
            eq(menuCategories.id, params.categoryId),
            eq(menuCategories.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!category) throw new AppError("NOT_FOUND", "Menu category not found");
      await tx
        .update(menuCategories)
        .set({
          sortOrder: params.sortOrder,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(menuCategories.id, category.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "commercial.menu.category.sort_order.set",
          targetType: "menu_category",
          targetId: category.id,
          before: { sortOrder: category.previousSortOrder },
          after: { sortOrder: params.sortOrder },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "menu_category",
        resultId: category.id,
        response: { categoryId: category.id, sortOrder: params.sortOrder },
      };
    },
  );
}

export async function setMenuItemSortOrder(params: {
  propertyId: string;
  session: FnbStaffSession;
  idempotencyKey: string;
  itemId: string;
  sortOrder: number;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  return withIdempotency(
    {
      scope: "commercial.menu.item.sort",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [item] = await tx
        .select({
          id: menuItems.id,
          categoryId: menuItems.categoryId,
          previousSortOrder: menuItems.sortOrder,
          code: menuItems.code,
          currentStatus: menuItems.status,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(
          and(
            eq(menuItems.id, params.itemId),
            eq(menuCategories.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!item) throw new AppError("NOT_FOUND", "Menu item not found");
      if (item.currentStatus !== "ACTIVE")
        throw new AppError(
          "CONFLICT",
          "Only active menu items can be reordered",
        );
      await tx
        .update(menuItems)
        .set({
          sortOrder: params.sortOrder,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        })
        .where(eq(menuItems.id, item.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "commercial.menu.item.sort_order.set",
          targetType: "menu_item",
          targetId: item.id,
          before: { sortOrder: item.previousSortOrder },
          after: { sortOrder: params.sortOrder },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "menu_item",
        resultId: item.id,
        response: {
          itemId: item.id,
          itemCode: item.code,
          sortOrder: params.sortOrder,
        },
      };
    },
  );
}
