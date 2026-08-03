import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCustomerLookupSession,
  getCustomerBooking,
} from "../../../../src/modules/booking/customer-lookup";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE = "kooka_booking_session";
const schema = z.object({
  bookingCode: z.string().trim().min(6).max(24),
  email: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().max(320).optional(),
  ),
});

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const session = await createCustomerLookupSession({
      propertyId: await getActivePropertyId(),
      ...input,
      ipAddress: clientIp(request),
    });
    const response = NextResponse.json({
      authenticated: true,
      expiresAt: session.expiresAt,
    });
    response.cookies.set(COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/booking/lookup",
      expires: new Date(session.expiresAt),
    });
    return response;
  } catch (error) {
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("UNAUTHORIZED", "Booking details could not be verified")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function GET(request: Request) {
  try {
    const bearer = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    const token = bearer || (await cookies()).get(COOKIE)?.value;
    if (!token)
      throw new AppError(
        "UNAUTHORIZED",
        "Booking details could not be verified",
      );
    return NextResponse.json(
      await getCustomerBooking({
        propertyId: await getActivePropertyId(),
        token,
      }),
    );
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
