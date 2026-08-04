import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "../../../../../src/db";
import {
  employeeProfiles,
  roles,
  userRoles,
  users,
} from "../../../../../src/db/schema";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { recordAuditEvent } from "../../../../../src/platform/audit";
import { getStaffProvisioningAuth } from "../../../../../src/platform/auth";
import { getActivePropertyId } from "../../../../../src/platform/property";
import {
  AuthorizationError,
  requirePermission,
} from "../../../../../src/platform/authorization";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const roleCodeSchema = z.string().trim().min(2).max(64).optional();

const bodySchema = z.object({
  action: z.literal("CREATE_STAFF"),
  name: z.string().trim().min(2).max(160),
  email: z.email().max(320),
  password: z.string().min(12).max(128),
  employeeCode: z.string().trim().min(1).max(40),
  displayName: z.string().trim().max(160).optional(),
  roleCode: roleCodeSchema,
  reason: z.string().trim().min(3).max(500).default("Provisioning user"),
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isSameUserProfileConflict(
  existingProfile: typeof employeeProfiles.$inferSelect | undefined,
  propertyId: string,
) {
  return existingProfile && existingProfile.propertyId !== propertyId;
}

function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (error instanceof AuthorizationError)
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 },
    );
  if (
    error instanceof AppError &&
    ["VALIDATION_ERROR", "CONFLICT", "INTERNAL_ERROR"].includes(error.code)
  ) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
  if (
    error instanceof Error &&
    error.message === "No authenticated staff session"
  ) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const response = toErrorResponse(
    error instanceof AppError
      ? error
      : new AppError("INTERNAL_ERROR", "An unexpected error occurred"),
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    await requirePermission(session, propertyId, "identity.employee.manage");

    const body = bodySchema.parse(await request.json());
    const emailNormalized = normalizeEmail(body.email);

    const db = getDatabase();

    const [existingUser] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.emailNormalized, emailNormalized))
      .limit(1);

    let userId: string;
    if (existingUser) {
      if (existingUser.status !== "ACTIVE") {
        throw new AppError(
          "CONFLICT",
          "Akun dengan email ini tidak aktif dan tidak bisa dipakai lagi",
        );
      }
      userId = existingUser.id;
    } else {
      await getStaffProvisioningAuth().api.signUpEmail({
        body: {
          name: body.name,
          email: body.email,
          emailNormalized,
          password: body.password,
        } as never,
      });

      const [createdUser] = await db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.emailNormalized, emailNormalized))
        .limit(1);
      if (!createdUser) throw new Error("Staff account provisioning failed");
      userId = createdUser.id;
    }

    const result = await db.transaction(async (tx) => {
      const [existingProfile] = await tx
        .select({ id: employeeProfiles.id, propertyId: employeeProfiles.propertyId })
        .from(employeeProfiles)
        .where(eq(employeeProfiles.userId, userId))
        .limit(1);

      if (existingProfile) {
        if (isSameUserProfileConflict(existingProfile, propertyId))
          throw new AppError(
            "CONFLICT",
            "Pengguna ini sudah terikat ke properti lain.",
          );
        throw new AppError(
          "CONFLICT",
          "Pengguna ini sudah terdaftar sebagai staf.",
        );
      }

      await tx.insert(employeeProfiles).values({
        userId,
        propertyId,
        employeeCode: body.employeeCode,
        displayName: body.displayName?.trim() || body.name,
        employmentStatus: "ACTIVE",
        defaultAttendanceMode: "FREE",
        createdByUserId: session.user.id,
      });

      let roleAssigned = false;
      if (body.roleCode) {
        await requirePermission(session, propertyId, "identity.role.manage");
        const [roleRow] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(and(eq(roles.code, body.roleCode), eq(roles.status, "ACTIVE")))
          .limit(1);
        if (!roleRow) throw new AppError("VALIDATION_ERROR", "Role tidak valid");
        const [activeRole] = await tx
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, userId),
              eq(userRoles.propertyId, propertyId),
              eq(userRoles.roleId, roleRow.id),
              isNull(userRoles.effectiveTo),
            ),
          )
          .limit(1);
        if (activeRole) {
          throw new AppError(
            "CONFLICT",
            `Staf sudah memiliki role ${body.roleCode}.`,
          );
        }
        await tx.insert(userRoles).values({
          userId,
          roleId: roleRow.id,
          propertyId,
          effectiveFrom: new Date(),
          grantedByUserId: session.user.id,
        });
        roleAssigned = true;
      }

      await recordAuditEvent(
        {
          propertyId,
          actorUserId: session.user.id,
          actorType: "user",
          action: "identity.staff.create",
          targetType: "user",
          targetId: userId,
          before: {},
          after: {
            email: emailNormalized,
            name: body.name,
            employeeCode: body.employeeCode,
            roleCode: body.roleCode ?? null,
            roleAssigned,
          },
          reason: body.reason,
          result: "SUCCESS",
        },
        tx,
      );

      return { userId, roleAssigned };
    });

    return NextResponse.json({ status: "created", ...result }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
