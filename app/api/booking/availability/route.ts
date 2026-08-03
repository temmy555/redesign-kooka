import { NextResponse } from "next/server";
import { z } from "zod";

import { searchAvailability } from "../../../../src/modules/booking/availability";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getLogger } from "../../../../src/platform/logger";
import { getActivePropertyId } from "../../../../src/platform/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  checkInDate: z.string(),
  checkoutDate: z.string(),
  rooms: z.coerce.number().int().min(1).max(15),
  adults: z.coerce.number().int().min(1).max(60),
  children: z.coerce.number().int().min(0).max(60).default(0),
  infants: z.coerce.number().int().min(0).max(60).default(0),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams));
    return NextResponse.json(
      await searchAvailability(await getActivePropertyId(), input),
    );
  } catch (error) {
    if (!(error instanceof AppError) && !(error instanceof z.ZodError)) {
      const cause =
        error instanceof Error && "cause" in error ? error.cause : undefined;
      getLogger().error(
        {
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage:
            error instanceof Error ? error.message : "Non-Error thrown",
          causeName: cause instanceof Error ? cause.name : undefined,
          causeMessage: cause instanceof Error ? cause.message : undefined,
          causeCode:
            cause && typeof cause === "object" && "code" in cause
              ? String(cause.code)
              : undefined,
        },
        "Public availability search failed",
      );
    }
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid availability search")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
