import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDatabase } from "../../../../../src/db";
import {
  employeeProfiles,
  roles,
  userRoles,
  users,
} from "../../../../../src/db/schema";
import {
  AuthorizationError,
  requirePermission,
} from "../../../../../src/platform/authorization";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";
import {
  paginationMeta,
  parsePagination,
} from "../../../../../src/platform/pagination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request?: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    await requirePermission(session, propertyId, "identity.employee.manage");
    await requirePermission(session, propertyId, "audit.view");
    const now = new Date();
    const db = getDatabase();
    const url = new URL(
      request?.url ?? "http://localhost/api/staff/admin/overview",
    );
    const pagination = parsePagination(
      {
        page: url.searchParams.get("auditPage"),
        pageSize: url.searchParams.get("auditPageSize"),
      },
      { defaultPageSize: 50, allowedPageSizes: [50, 100] },
    );
    const search = (url.searchParams.get("auditSearch") ?? "")
      .trim()
      .slice(0, 120);
    type AuditRow = {
      id: string;
      action: string;
      targetType: string;
      targetId: string | null;
      actorUserId: string | null;
      result: string;
      reason: string | null;
      createdAt: Date;
    };
    const [team, grants, auditCount, auditResult] = await Promise.all([
      db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          accountStatus: users.status,
          employeeCode: employeeProfiles.employeeCode,
          displayName: employeeProfiles.displayName,
          employmentStatus: employeeProfiles.employmentStatus,
        })
        .from(employeeProfiles)
        .innerJoin(users, eq(users.id, employeeProfiles.userId))
        .where(eq(employeeProfiles.propertyId, propertyId))
        .orderBy(employeeProfiles.displayName),
      db
        .select({
          userId: userRoles.userId,
          roleCode: roles.code,
          roleName: roles.name,
          effectiveFrom: userRoles.effectiveFrom,
          effectiveTo: userRoles.effectiveTo,
        })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(userRoles.propertyId, propertyId),
            lte(userRoles.effectiveFrom, now),
            or(isNull(userRoles.effectiveTo), gt(userRoles.effectiveTo, now)),
          ),
        )
        .orderBy(roles.name),
      db.execute<{ total: string }>(sql`
        select count(*)::text as total
        from audit_events
        where property_id = ${propertyId}
          and (${search} = '' or action ilike ${`%${search}%`}
            or target_type ilike ${`%${search}%`}
            or coalesce(reason, '') ilike ${`%${search}%`})
      `),
      db.execute<AuditRow>(sql`
        select id, action, target_type as "targetType",
          target_id as "targetId", actor_user_id as "actorUserId",
          result, reason, created_at as "createdAt"
        from audit_events
        where property_id = ${propertyId}
          and (${search} = '' or action ilike ${`%${search}%`}
            or target_type ilike ${`%${search}%`}
            or coalesce(reason, '') ilike ${`%${search}%`})
        order by created_at desc, id desc
        limit ${pagination.pageSize} offset ${pagination.offset}
      `),
    ]);
    return NextResponse.json({
      team,
      grants,
      audit: auditResult.rows,
      auditPagination: paginationMeta(
        pagination.page,
        pagination.pageSize,
        Number(auditCount.rows[0]?.total ?? 0),
      ),
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    )
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw error;
  }
}
