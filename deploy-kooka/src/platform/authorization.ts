import "server-only";

import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

import { getDatabase } from "../db";
import {
  employeeProfiles,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "../db/schema";

/**
 * Server-side authorization (Roadmap Langkah 7). Permission is checked here
 * -- on the server, per action -- never inferred from what a client shows
 * or hides. See docs/SECURITY-PRIVACY-RETENTION.md §3: "Permission
 * diperiksa server-side pada action dan field/file access, bukan hanya
 * menyembunyikan menu."
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolves the set of permission codes an active session actually has
 * *right now*, for one property. Two independent deny-all gates sit in
 * front of the role/permission join, both there specifically for the
 * "inactive employee" scenario the roadmap calls out:
 *
 * - `users.status !== 'ACTIVE'` (suspended/archived account).
 * - an existing `employee_profiles` row whose `employment_status` is not
 *   `ACTIVE` (e.g. terminated) -- this wins even if nobody remembered to
 *   revoke the `user_roles` grant, because employment lifecycle should not
 *   depend on someone else's follow-up cleanup task.
 *
 * A user with no employee profile at all is not denied by the second gate
 * (Better Auth accounts without an EmployeeProfile are allowed by the
 * schema -- Roadmap Langkah 7 links `User` to an *optional*
 * `EmployeeProfile`), only one whose profile explicitly says they're no
 * longer active.
 */
export async function getActivePermissionCodes(
  userId: string,
  propertyId: string,
  now: Date = new Date(),
): Promise<Set<string>> {
  const db = getDatabase();

  const [user] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status !== "ACTIVE") return new Set();

  const [employee] = await db
    .select({ employmentStatus: employeeProfiles.employmentStatus })
    .from(employeeProfiles)
    .where(eq(employeeProfiles.userId, userId))
    .limit(1);
  if (employee && employee.employmentStatus !== "ACTIVE") return new Set();

  const rows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.propertyId, propertyId),
        eq(roles.status, "ACTIVE"),
        lte(userRoles.effectiveFrom, now),
        or(isNull(userRoles.effectiveTo), gt(userRoles.effectiveTo, now)),
      ),
    );

  return new Set(rows.map((row) => row.code));
}

export async function hasPermission(
  userId: string,
  propertyId: string,
  code: string,
  now?: Date,
): Promise<boolean> {
  const codes = await getActivePermissionCodes(userId, propertyId, now);
  return codes.has(code);
}

interface SessionLike {
  user: { id: string };
}

/**
 * Throws `AuthorizationError` (never leaks *why* beyond the missing
 * permission code, and never trusts anything from the request other than
 * the server-verified session) when the caller lacks `code` on
 * `propertyId`. Route handlers should call this immediately after
 * resolving the session, before doing any work -- default-deny.
 */
export async function requirePermission(
  session: SessionLike,
  propertyId: string,
  code: string,
): Promise<void> {
  const allowed = await hasPermission(session.user.id, propertyId, code);
  if (!allowed) {
    throw new AuthorizationError(`Missing permission: ${code}`);
  }
}
