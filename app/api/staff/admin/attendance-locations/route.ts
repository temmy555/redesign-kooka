import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createAttendanceLocation,
  getAttendanceLocationOverview,
  setAttendanceLocationStatus,
  updateAttendanceLocation,
} from "../../../../../src/modules/attendance/location-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(500);
const input = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(5).max(5000),
  maximumAccuracyMeters: z.number().int().min(5).max(1000),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  reason,
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_LOCATION"), input }),
  z.object({
    action: z.literal("UPDATE_LOCATION"),
    locationId: z.string().uuid(),
    input,
  }),
  z.object({
    action: z.literal("SET_LOCATION_STATUS"),
    locationId: z.string().uuid(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    reason,
  }),
]);

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError)
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  const normalized =
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Data titik absensi tidak valid")
      : error;
  const response = toErrorResponse(normalized);
  return NextResponse.json(response.body, { status: response.status });
}

async function context() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  return { session, propertyId };
}

export async function GET() {
  try {
    return NextResponse.json(
      await getAttendanceLocationOverview(await context()),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    )
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestContext = await context();
    const body = actionSchema.parse(await request.json());
    if (body.action === "CREATE_LOCATION")
      return NextResponse.json(
        await createAttendanceLocation({
          ...requestContext,
          input: body.input,
        }),
        { status: 201 },
      );
    if (body.action === "UPDATE_LOCATION")
      return NextResponse.json(
        await updateAttendanceLocation({
          ...requestContext,
          locationId: body.locationId,
          input: body.input,
        }),
      );
    return NextResponse.json(
      await setAttendanceLocationStatus({
        ...requestContext,
        locationId: body.locationId,
        status: body.status,
        reason: body.reason,
      }),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    )
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    return errorResponse(error);
  }
}
