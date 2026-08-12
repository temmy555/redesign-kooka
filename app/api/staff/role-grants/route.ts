import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthorizationError } from "../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../src/platform/property";
import {
  grantUserRole,
  revokeUserRole,
} from "../../../../src/platform/rbac-admin";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Default-deny demonstration route (Roadmap Langkah 7 exit gate):
 * grant/revoke a role requires an authenticated session (401 without one)
 * AND the `identity.role.manage` permission (403 without it, including for
 * an authenticated caller trying to edit their own role -- see
 * SelfRoleEditError in src/platform/rbac-admin.ts). Neither the actor nor
 * the property id ever comes from client input; only `targetUserId` and
 * `roleCode` are read from the request body.
 */
const bodySchema = z.object({
  targetUserId: z.string().uuid(),
  roleCode: z.string().min(1).max(64),
  reason: z.string().trim().min(3).max(500),
});

async function readBody(request: Request) {
  const json: unknown = await request.json();
  return bodySchema.parse(json);
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireCurrentSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const propertyId = await getActivePropertyId();

  let status: "granted" | "already_active";
  try {
    status = await grantUserRole({
      session,
      targetUserId: body.targetUserId,
      roleCode: body.roleCode,
      propertyId,
      reason: body.reason,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw error;
  }

  return NextResponse.json({ status });
}

export async function DELETE(request: Request) {
  let session;
  try {
    session = await requireCurrentSession();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const propertyId = await getActivePropertyId();

  try {
    await revokeUserRole({
      session,
      targetUserId: body.targetUserId,
      roleCode: body.roleCode,
      propertyId,
      reason: body.reason,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw error;
  }

  return NextResponse.json({ status: "revoked" });
}
