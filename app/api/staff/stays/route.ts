import { NextResponse } from "next/server";
import { z } from "zod";

import {
  decideStayTiming,
  recordCheckinCapture,
  transitionStay,
} from "../../../../src/modules/operations/stay-service";
import { AuthorizationError } from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum([
      "MARK_DUE_IN",
      "CHECK_IN",
      "MARK_DUE_OUT",
      "CHECK_OUT",
      "MARK_NO_SHOW",
      "REOPEN_NO_SHOW",
      "RELEASE_NO_SHOW",
    ]),
    roomStayId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
    overrideReadiness: z.boolean().optional(),
    departureOutcome: z.enum(["CLEARED", "ISSUE_FOUND", "SKIPPED"]).optional(),
  }),
  z.object({
    action: z.literal("CAPTURE_CHECKIN"),
    roomStayId: z.string().uuid().optional(),
    reservationRoomId: z.string().uuid().optional(),
    guestId: z.string().uuid().optional(),
    captureType: z.enum(["IDENTITY_DOCUMENT", "GUEST_PHOTO", "SIGNATURE"]),
    outcome: z.enum(["CAPTURED", "DECLINED", "SKIPPED", "FAILED"]),
    fileId: z.string().uuid().optional(),
    reason: z.string().trim().max(500).optional(),
    identity: z
      .object({
        type: z.string().trim().min(2).max(40),
        number: z.string().trim().min(3).max(100),
        nameOnIdentity: z.string().trim().max(200).optional(),
        expiresOn: z.string().trim().max(40).optional(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal("TIMING_DECISION"),
    roomStayId: z.string().uuid(),
    decision: z.enum([
      "APPROVE_EARLY_CHECKIN",
      "APPROVE_LATE_CHECKOUT",
      "DECLINE",
    ]),
    approvedUntil: z.coerce.date().optional(),
    reason: z.string().trim().min(3).max(500),
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
  const response = toErrorResponse(
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid stay operation")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
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
    if (body.action === "CAPTURE_CHECKIN")
      if (!body.roomStayId && !body.reservationRoomId)
        throw new AppError(
          "VALIDATION_ERROR",
          "A room stay or reservation room is required",
        );
    if (body.action === "CAPTURE_CHECKIN")
      return NextResponse.json(
        await recordCheckinCapture({
          propertyId,
          session,
          idempotencyKey,
          roomStayId: body.roomStayId,
          reservationRoomId: body.reservationRoomId,
          guestId: body.guestId,
          captureType: body.captureType,
          outcome: body.outcome,
          fileId: body.fileId,
          reason: body.reason,
          identity: body.identity,
        }),
        { status: 201 },
      );
    if (body.action === "TIMING_DECISION")
      return NextResponse.json(
        await decideStayTiming({
          propertyId,
          session,
          idempotencyKey,
          roomStayId: body.roomStayId,
          decision: body.decision,
          approvedUntil: body.approvedUntil,
          reason: body.reason,
        }),
      );
    return NextResponse.json(
      await transitionStay({
        propertyId,
        session,
        idempotencyKey,
        roomStayId: body.roomStayId,
        action: body.action,
        reason: body.reason,
        overrideReadiness: body.overrideReadiness,
        departureOutcome: body.departureOutcome,
      }),
    );
  } catch (error) {
    return responseFor(error);
  }
}
