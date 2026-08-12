import { NextResponse } from "next/server";
import { z } from "zod";

import { createBookingQuote } from "../../../../src/modules/booking/quote-service";
import { getPublicCheckoutPolicies } from "../../../../src/modules/booking/public-checkout";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const room = z.object({
  roomTypeId: z.string().uuid(),
  ratePlanCode: z.string().trim().min(1).max(64).optional(),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).default(0),
  infants: z.number().int().min(0).max(20).default(0),
  extraBedQuantity: z.number().int().min(0).max(5).default(0),
});
const schema = z.object({
  checkInDate: z.string(),
  checkoutDate: z.string(),
  ratePlanCode: z.string().trim().min(1).max(64),
  language: z.enum(["id", "en"]),
  displayCurrency: z.enum(["IDR", "USD", "AUD"]),
  rooms: z.array(room).min(1).max(15),
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
    const input = schema.parse(await request.json());
    const propertyId = await getActivePropertyId();
    const policies = await getPublicCheckoutPolicies(
      propertyId,
      input.ratePlanCode,
    );
    const quote = await createBookingQuote({
      propertyId,
      input,
      idempotencyKey,
    });
    return NextResponse.json(
      {
        ...quote,
        policies,
      },
      { status: 201 },
    );
  } catch (error) {
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid quote request")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
