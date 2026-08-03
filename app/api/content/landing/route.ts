import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicMenu } from "../../../../src/modules/commerce/fnb-service";
import { getPublicLandingPage } from "../../../../src/modules/content/cms-service";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  locale: z.enum(["id", "en"]).default("id"),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const propertyId = await getActivePropertyId();
    const [data, menu] = await Promise.all([
      getPublicLandingPage({ propertyId, locale: query.locale }),
      getPublicMenu({ propertyId, locale: query.locale }).catch(
        () => undefined,
      ),
    ]);
    return NextResponse.json(menu ? { ...data, menu } : data, {
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
        vary: "accept-language",
      },
    });
  } catch (error) {
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid landing content request")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
