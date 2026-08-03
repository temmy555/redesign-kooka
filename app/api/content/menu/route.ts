import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicMenu } from "../../../../src/modules/commerce/fnb-service";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  locale: z.enum(["id", "en"]).default("id"),
});

export async function GET(request: Request) {
  try {
    const query = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return NextResponse.json(
      await getPublicMenu({
        propertyId: await getActivePropertyId(),
        locale: query.locale,
      }),
      {
        headers: {
          "cache-control": "public, max-age=60, stale-while-revalidate=300",
          vary: "accept-language",
        },
      },
    );
  } catch (error) {
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid menu request")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
