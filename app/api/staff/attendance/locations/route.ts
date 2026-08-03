import { NextResponse } from "next/server";
import { z } from "zod";

import {
  checkAttendanceLocation,
  getEligibleAttendanceLocations,
} from "../../../../../src/modules/attendance/location-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(100000),
});

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError)
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  const normalized =
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Data lokasi perangkat tidak valid")
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
      await getEligibleAttendanceLocations(await context()),
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
    const position = positionSchema.parse(await request.json());
    return NextResponse.json(
      await checkAttendanceLocation({ ...(await context()), position }),
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
