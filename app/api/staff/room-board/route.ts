import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assignRoom,
  blockRoom,
  getRoomBoard,
  moveRoom,
} from "../../../../src/modules/operations/room-service";
import { AuthorizationError } from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getLogger } from "../../../../src/platform/logger";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ASSIGN"),
    reservationRoomId: z.string().uuid(),
    roomUnitId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("BLOCK"),
    roomUnitId: z.string().uuid(),
    blockType: z.enum(["MAINTENANCE", "OUT_OF_ORDER", "OWNER", "OTHER"]),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    reason: z.string().trim().min(3).max(500),
    sourceType: z.string().trim().max(64).optional(),
    sourceId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("MOVE"),
    roomStayId: z.string().uuid(),
    toRoomUnitId: z.string().uuid(),
    effectiveOn: z.iso.date(),
    reason: z.string().trim().min(3).max(500),
    priceTreatment: z.enum(["NO_CHANGE", "CHARGE", "CREDIT"]),
    priceAdjustmentIdr: z.number().int().nonnegative(),
    incidentalNoCharge: z.boolean(),
  }),
]);

function responseFor(error: unknown) {
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
  if (!(error instanceof AppError) && !(error instanceof z.ZodError)) {
    getLogger().error(
      {
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "Unexpected room-board operation failure",
    );
  }
  const response = toErrorResponse(
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid room operation")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const sharedDisplay =
      new URL(request.url).searchParams.get("display") === "shared";
    return NextResponse.json(
      await getRoomBoard({ propertyId, session, sharedDisplay }),
    );
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160)
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required",
      );
    const body = schema.parse(await request.json());
    if (body.action === "ASSIGN")
      return NextResponse.json(
        await assignRoom({
          propertyId,
          session,
          idempotencyKey,
          reservationRoomId: body.reservationRoomId,
          roomUnitId: body.roomUnitId,
          reason: body.reason,
        }),
        { status: 201 },
      );
    if (body.action === "BLOCK")
      return NextResponse.json(
        await blockRoom({
          propertyId,
          session,
          idempotencyKey,
          roomUnitId: body.roomUnitId,
          blockType: body.blockType,
          startsOn: body.startsOn,
          endsOn: body.endsOn,
          reason: body.reason,
          sourceType: body.sourceType,
          sourceId: body.sourceId,
        }),
        { status: 201 },
      );
    return NextResponse.json(
      await moveRoom({
        propertyId,
        session,
        idempotencyKey,
        roomStayId: body.roomStayId,
        toRoomUnitId: body.toRoomUnitId,
        effectiveOn: body.effectiveOn,
        reason: body.reason,
        priceTreatment: body.priceTreatment,
        priceAdjustmentIdr: body.priceAdjustmentIdr,
        incidentalNoCharge: body.incidentalNoCharge,
      }),
      { status: 201 },
    );
  } catch (error) {
    return responseFor(error);
  }
}
