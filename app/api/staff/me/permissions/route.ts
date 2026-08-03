import { NextResponse } from "next/server";

import { getActivePermissionCodes } from "../../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Default-deny demonstration route (Roadmap Langkah 7 exit gate): returns
 * only the caller's *own* resolved permissions for the active property.
 * Session-gated, not permission-gated -- any authenticated staff member can
 * see what they themselves are allowed to do, which is what a staff UI
 * needs to decide what to render. This never trusts a client-sent user id;
 * `requireCurrentSession()` resolves identity from the caller's own
 * server-verified session.
 */
export async function GET() {
  let session;
  try {
    session = await requireCurrentSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const propertyId = await getActivePropertyId();
  const codes = await getActivePermissionCodes(session.user.id, propertyId);

  return NextResponse.json({
    userId: session.user.id,
    propertyId,
    permissions: [...codes].sort(),
  });
}
