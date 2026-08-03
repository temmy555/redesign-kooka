import { NextResponse } from "next/server";

import { getFrontOfficeCatalog } from "../../../../../src/modules/operations/front-office-catalog";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    return NextResponse.json(
      await getFrontOfficeCatalog({ session, propertyId }),
    );
  } catch (error) {
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
    throw error;
  }
}
