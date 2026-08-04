import { NextResponse } from "next/server";
import { z } from "zod";

import { createReservation } from "../../../../src/modules/booking/reservation-service";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getLogger } from "../../../../src/platform/logger";
import { getActivePropertyId } from "../../../../src/platform/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  quoteId: z.string().uuid(),
  booker: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().email().max(320),
    phone: z.string().trim().max(40).nullable().optional(),
  }),
  acknowledgedPolicyVersionIds: z.array(z.string().uuid()).max(20),
});

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required",
      );
    }
    const body = schema.parse(await request.json());
    return NextResponse.json(
      await createReservation({
        propertyId: await getActivePropertyId(),
        input: { ...body, source: "ONLINE" },
        idempotencyKey,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (!(error instanceof AppError) && !(error instanceof z.ZodError)) {
      const cause =
        error instanceof Error && "cause" in error ? error.cause : undefined;
      getLogger().error(
        {
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage:
            error instanceof Error
              ? error.message.split("\n", 1)[0]
              : "Non-Error thrown",
          causeName: cause instanceof Error ? cause.name : undefined,
          causeMessage:
            cause instanceof Error
              ? cause.message.split("\n", 1)[0]
              : undefined,
          causeCode:
            cause && typeof cause === "object" && "code" in cause
              ? String(cause.code)
              : undefined,
        },
        "Public reservation creation failed",
      );
    }
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid reservation request")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
