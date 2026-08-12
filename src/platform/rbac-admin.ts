import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDatabase } from "../db";
import { roles, userRoles } from "../db/schema";
import type * as schema from "../db/schema";
import { recordAuditEvent } from "./audit";
import { AuthorizationError, requirePermission } from "./authorization";
import { recordSecurityEvent } from "./security-events";

/**
 * Role grant/revoke (Roadmap Langkah 7: "Implement named permissions,
 * user-role grant/effective period, dan route/action guard"). Both actions
 * require the actor to already hold `identity.role.manage`, and both
 * reject the actor targeting their own user id.
 *
 * The self-target rejection is a deliberate privilege-escalation guard
 * (the roadmap's own verification list calls out "self-role-edit" as a
 * required negative test), not an oversight to relax later without
 * thought. docs/SECURITY-PRIVACY-RETENTION.md §2 does allow an "Owner
 * self-approval path for high-risk configuration
 * changes in general, but that path depends on a re-authentication
 * mechanism that does not exist yet (Roadmap Langkah 8 shared services).
 * Until that lands, self-role-edit stays hard-denied rather than
 * half-built.
 */
export class SelfRoleEditError extends AuthorizationError {
  constructor() {
    super("Cannot modify your own role assignment");
  }
}

interface SessionLike {
  user: { id: string };
}

type RbacDb = Pick<
  NodePgDatabase<typeof schema>,
  "select" | "insert" | "update"
>;

async function getRoleIdByCode(db: RbacDb, code: string): Promise<string> {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, code))
    .limit(1);
  if (!role) throw new Error(`Unknown role code: ${code}`);
  return role.id;
}

export async function grantUserRole(params: {
  session: SessionLike;
  targetUserId: string;
  roleCode: string;
  propertyId: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  reason: string;
}): Promise<"granted" | "already_active"> {
  const { session, targetUserId, roleCode, propertyId } = params;

  if (session.user.id === targetUserId) throw new SelfRoleEditError();
  await requirePermission(session, propertyId, "identity.role.manage");

  const effectiveFrom = params.effectiveFrom ?? new Date();

  const result = await getDatabase().transaction(async (tx) => {
    const roleId = await getRoleIdByCode(tx, roleCode);
    const [inserted] = await tx
      .insert(userRoles)
      .values({
        userId: targetUserId,
        roleId,
        propertyId,
        effectiveFrom,
        effectiveTo: params.effectiveTo,
        grantedByUserId: session.user.id,
      })
      // The exclusion constraint also protects concurrent double-clicks.
      // Repeating an overlapping grant is an idempotent no-op, not a 500.
      .onConflictDoNothing()
      .returning({ userId: userRoles.userId });

    if (!inserted) return "already_active" as const;

    await recordAuditEvent(
      {
        propertyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "identity.role.grant",
        targetType: "user",
        targetId: targetUserId,
        after: {
          roleCode,
          effectiveFrom: effectiveFrom.toISOString(),
          effectiveTo: params.effectiveTo?.toISOString() ?? null,
        },
        reason: params.reason,
        result: "SUCCESS",
      },
      tx,
    );

    return "granted" as const;
  });

  if (result === "granted") {
    await recordSecurityEvent({
      actorUserId: session.user.id,
      category: "RBAC_ROLE_GRANTED",
      result: "SUCCESS",
      targetType: "user",
      targetId: targetUserId,
      details: { roleCode, propertyId },
    });
  }

  return result;
}

/**
 * Closes the caller's currently-open grant for `roleCode` on `propertyId`
 * by setting `effectiveTo = now` -- `user_roles` is not one of the
 * append-only-triggered tables (see
 * database/migrations/after-drizzle/0001_hard_constraints.sql), so this is
 * a genuine in-place update, matching what the `effectiveTo` column and
 * its `ck_user_roles_period` check constraint are there for.
 */
export async function revokeUserRole(params: {
  session: SessionLike;
  targetUserId: string;
  roleCode: string;
  propertyId: string;
  reason: string;
}): Promise<void> {
  const { session, targetUserId, roleCode, propertyId } = params;

  if (session.user.id === targetUserId) throw new SelfRoleEditError();
  await requirePermission(session, propertyId, "identity.role.manage");

  const now = new Date();

  await getDatabase().transaction(async (tx) => {
    const roleId = await getRoleIdByCode(tx, roleCode);
    const revoked = await tx
      .update(userRoles)
      .set({ effectiveTo: now })
      .where(
        and(
          eq(userRoles.userId, targetUserId),
          eq(userRoles.roleId, roleId),
          eq(userRoles.propertyId, propertyId),
          isNull(userRoles.effectiveTo),
        ),
      )
      .returning({ userId: userRoles.userId });

    if (revoked.length === 0) {
      throw new Error("No active grant found for that user/role/property");
    }

    await recordAuditEvent(
      {
        propertyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "identity.role.revoke",
        targetType: "user",
        targetId: targetUserId,
        before: { roleCode, effectiveTo: null },
        after: { roleCode, effectiveTo: now.toISOString() },
        reason: params.reason,
        result: "SUCCESS",
      },
      tx,
    );
  });

  await recordSecurityEvent({
    actorUserId: session.user.id,
    category: "RBAC_ROLE_REVOKED",
    result: "SUCCESS",
    targetType: "user",
    targetId: targetUserId,
    details: { roleCode, propertyId },
  });
}
