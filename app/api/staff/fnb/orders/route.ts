import { NextResponse } from "next/server";
import { z } from "zod";

import {
  cancelFoodOrder,
  createPaperFoodOrder,
  getFoodOrderQueue,
  recordStandaloneFoodPayment,
  setRoomChargePrivilege,
  transitionFoodOrder,
} from "../../../../../src/modules/commerce/fnb-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(1_000);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_PAPER_ORDER"),
    settlementRoute: z.enum(["STANDALONE", "ROOM_CHARGE"]),
    customerName: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(2_000).optional(),
    roomStayId: z.string().uuid().optional(),
    expectedRoomNumber: z.string().trim().min(1).max(20).optional(),
    expectedLeadGuestName: z.string().trim().min(1).max(160).optional(),
    billingBucketId: z.string().uuid().optional(),
    serviceDate: z.iso.date().optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().min(1).max(100),
          notes: z.string().trim().max(500).optional(),
          unitPriceOverrideIdr: z.number().int().nonnegative().optional(),
          discountAmountIdr: z.number().int().nonnegative().optional(),
          overrideReason: z.string().trim().min(3).max(500).optional(),
          guestInformed: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({
    action: z.literal("SET_ROOM_CHARGE_PRIVILEGE"),
    roomStayId: z.string().uuid(),
    privilege: z.enum(["ALLOWED", "NOT_ALLOWED", "APPROVAL_REQUIRED"]),
    reason,
  }),
  z.object({
    action: z.literal("TRANSITION_ORDER"),
    foodOrderId: z.string().uuid(),
    toStatus: z.enum(["ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED"]),
    notes: z.string().trim().max(1_000).optional(),
  }),
  z.object({
    action: z.literal("CANCEL_ORDER"),
    foodOrderId: z.string().uuid(),
    reason,
    serviceDate: z.iso.date().optional(),
  }),
  z.object({
    action: z.literal("RECORD_STANDALONE_PAYMENT"),
    foodOrderId: z.string().uuid(),
    method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
    amountIdr: z.number().int().positive(),
    reference: z.string().trim().max(160).optional(),
    recipientName: z.string().trim().min(1).max(160),
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
      ? new AppError("VALIDATION_ERROR", "Invalid F&B request")
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
    return NextResponse.json(await getFoodOrderQueue(await context()));
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
      case "CREATE_PAPER_ORDER":
        return NextResponse.json(
          await createPaperFoodOrder({
            ...requestContext,
            idempotencyKey,
            settlementRoute: body.settlementRoute,
            customerName: body.customerName,
            notes: body.notes,
            roomStayId: body.roomStayId,
            expectedRoomNumber: body.expectedRoomNumber,
            expectedLeadGuestName: body.expectedLeadGuestName,
            billingBucketId: body.billingBucketId,
            serviceDate: body.serviceDate,
            items: body.items,
          }),
          { status: 201 },
        );
      case "SET_ROOM_CHARGE_PRIVILEGE":
        return NextResponse.json(
          await setRoomChargePrivilege({
            ...requestContext,
            idempotencyKey,
            roomStayId: body.roomStayId,
            privilege: body.privilege,
            reason: body.reason,
          }),
        );
      case "TRANSITION_ORDER":
        return NextResponse.json(
          await transitionFoodOrder({
            ...requestContext,
            idempotencyKey,
            foodOrderId: body.foodOrderId,
            toStatus: body.toStatus,
            notes: body.notes,
          }),
        );
      case "CANCEL_ORDER":
        return NextResponse.json(
          await cancelFoodOrder({
            ...requestContext,
            idempotencyKey,
            foodOrderId: body.foodOrderId,
            reason: body.reason,
            serviceDate: body.serviceDate,
          }),
        );
      case "RECORD_STANDALONE_PAYMENT":
        return NextResponse.json(
          await recordStandaloneFoodPayment({
            ...requestContext,
            idempotencyKey,
            foodOrderId: body.foodOrderId,
            method: body.method,
            amountIdr: body.amountIdr,
            reference: body.reference,
            recipientName: body.recipientName,
          }),
          { status: 201 },
        );
    }
  } catch (error) {
    return failure(error);
  }
}
