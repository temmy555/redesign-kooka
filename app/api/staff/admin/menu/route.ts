import { NextResponse } from "next/server";
import { z } from "zod";

import {
  activateMenuItemVersion,
  createMenuCategory,
  createMenuItemVersion,
  getMenuAdminOverview,
  setMenuCategorySortOrder,
  setMenuItemSortOrder,
  setMenuItemAvailability,
} from "../../../../../src/modules/commerce/menu-admin-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(500);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_CATEGORY"),
    categoryCode: z.string().trim().min(1).max(80),
    nameId: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    sortOrder: z.number().int().min(0).max(10_000),
  }),
  z.object({
    action: z.literal("CREATE_ITEM_VERSION"),
    categoryId: z.string().uuid(),
    itemCode: z.string().trim().min(1).max(80),
    nameId: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    descriptionId: z.string().trim().max(2_000).optional(),
    descriptionEn: z.string().trim().max(2_000).optional(),
    priceIdr: z.number().int().nonnegative(),
    taxProfileVersionId: z.string().uuid().optional(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().optional(),
    reason,
  }),
  z.object({
    action: z.literal("SET_CATEGORY_SORT_ORDER"),
    categoryId: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(10_000),
    reason,
  }),
  z.object({
    action: z.literal("SET_ITEM_SORT_ORDER"),
    itemId: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(10_000),
    reason,
  }),
  z.object({
    action: z.literal("ACTIVATE_ITEM_VERSION"),
    versionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("SET_AVAILABILITY"),
    menuItemId: z.string().uuid(),
    available: z.boolean(),
    reason,
  }),
]);

function failure(error: unknown) {
  if (error instanceof AuthorizationError)
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  if (
    error instanceof Error &&
    error.message === "No authenticated staff session"
  )
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
      { status: 401 },
    );
  const response = toErrorResponse(
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid menu administration request")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

async function context() {
  return {
    session: await requireCurrentSession(),
    propertyId: await getActivePropertyId(),
  };
}

export async function GET() {
  try {
    return NextResponse.json(await getMenuAdminOverview(await context()));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestContext = await context();
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160)
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required",
      );
    const body = schema.parse(await request.json());
    switch (body.action) {
      case "CREATE_CATEGORY":
        return NextResponse.json(
          await createMenuCategory({
            ...requestContext,
            idempotencyKey,
            categoryCode: body.categoryCode,
            nameId: body.nameId,
            nameEn: body.nameEn,
            sortOrder: body.sortOrder,
          }),
          { status: 201 },
        );
      case "CREATE_ITEM_VERSION":
        return NextResponse.json(
          await createMenuItemVersion({
            ...requestContext,
            idempotencyKey,
            categoryId: body.categoryId,
            itemCode: body.itemCode,
            nameId: body.nameId,
            nameEn: body.nameEn,
            descriptionId: body.descriptionId,
            descriptionEn: body.descriptionEn,
            priceIdr: body.priceIdr,
            taxProfileVersionId: body.taxProfileVersionId,
            effectiveFrom: body.effectiveFrom,
            effectiveTo: body.effectiveTo,
            reason: body.reason,
          }),
          { status: 201 },
        );
      case "ACTIVATE_ITEM_VERSION":
        return NextResponse.json(
          await activateMenuItemVersion({
            ...requestContext,
            idempotencyKey,
            versionId: body.versionId,
            reason: body.reason,
          }),
        );
      case "SET_AVAILABILITY":
        return NextResponse.json(
          await setMenuItemAvailability({
            ...requestContext,
            idempotencyKey,
            menuItemId: body.menuItemId,
            available: body.available,
            reason: body.reason,
          }),
        );
      case "SET_CATEGORY_SORT_ORDER":
        return NextResponse.json(
          await setMenuCategorySortOrder({
            ...requestContext,
            idempotencyKey,
            categoryId: body.categoryId,
            sortOrder: body.sortOrder,
          }),
        );
      case "SET_ITEM_SORT_ORDER":
        return NextResponse.json(
          await setMenuItemSortOrder({
            ...requestContext,
            idempotencyKey,
            itemId: body.itemId,
            sortOrder: body.sortOrder,
          }),
        );
    }
  } catch (error) {
    return failure(error);
  }
}
