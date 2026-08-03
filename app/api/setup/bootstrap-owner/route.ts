import { timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDatabase } from "../../../../src/db";
import {
  employeeProfiles,
  properties,
  roles,
  userRoles,
  users,
} from "../../../../src/db/schema";
import { recordAuditEvent } from "../../../../src/platform/audit";
import { getStaffProvisioningAuth } from "../../../../src/platform/auth";
import { parseApplicationEnvironment } from "../../../../src/platform/environment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.email().max(320),
  password: z.string().min(12).max(128),
  employeeCode: z.string().trim().min(1).max(40).default("OWNER-001"),
  propertyCode: z.string().trim().min(1).max(32).default("KOOKA-SBY"),
  propertyName: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .default("KOOKA Residence Surabaya"),
});

function tokenMatches(request: Request, expected: string | undefined) {
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/iu, "");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

async function ownerAlreadyExists() {
  const now = new Date();
  const [owner] = await getDatabase()
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(roles.code, "OWNER"),
        lte(userRoles.effectiveFrom, now),
        or(isNull(userRoles.effectiveTo), gt(userRoles.effectiveTo, now)),
      ),
    )
    .limit(1);
  return Boolean(owner);
}

export async function POST(request: Request) {
  const environment = parseApplicationEnvironment(process.env);
  if (!tokenMatches(request, environment.OWNER_BOOTSTRAP_TOKEN)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (await ownerAlreadyExists()) {
    return NextResponse.json(
      { error: "bootstrap_already_completed" },
      { status: 409 },
    );
  }

  const emailNormalized = body.email.toLowerCase();
  let [user] = await getDatabase()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailNormalized, emailNormalized))
    .limit(1);

  if (!user) {
    await getStaffProvisioningAuth().api.signUpEmail({
      body: {
        name: body.name,
        email: body.email,
        emailNormalized,
        password: body.password,
      } as never,
    });
    [user] = await getDatabase()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailNormalized, emailNormalized))
      .limit(1);
  }
  if (!user)
    throw new Error("Staff account provisioning did not create a user");

  const result = await getDatabase().transaction(async (tx) => {
    // Serializes the one-time bootstrap grant across application instances.
    await tx.execute(sql`select pg_advisory_xact_lock(2026080208)`);

    const now = new Date();
    const [existingOwner] = await tx
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(roles.code, "OWNER"),
          lte(userRoles.effectiveFrom, now),
          or(isNull(userRoles.effectiveTo), gt(userRoles.effectiveTo, now)),
        ),
      )
      .limit(1);
    if (existingOwner) return null;

    let [property] = await tx
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.status, "ACTIVE"))
      .limit(1);
    if (!property) {
      [property] = await tx
        .insert(properties)
        .values({ code: body.propertyCode, name: body.propertyName })
        .returning({ id: properties.id });
    }

    const [ownerRole] = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.code, "OWNER"), eq(roles.status, "ACTIVE")))
      .limit(1);
    if (!ownerRole) throw new Error("OWNER role catalog is not installed");

    await tx
      .insert(employeeProfiles)
      .values({
        userId: user.id,
        propertyId: property.id,
        employeeCode: body.employeeCode,
        displayName: body.name,
        employmentStatus: "ACTIVE",
        defaultAttendanceMode: "FREE",
        createdByUserId: user.id,
      })
      .onConflictDoNothing({ target: employeeProfiles.userId });

    await tx.insert(userRoles).values({
      userId: user.id,
      roleId: ownerRole.id,
      propertyId: property.id,
      effectiveFrom: now,
      grantedByUserId: user.id,
      createdByUserId: user.id,
    });

    await recordAuditEvent(
      {
        propertyId: property.id,
        actorType: "system",
        action: "identity.owner.bootstrap",
        targetType: "user",
        targetId: user.id,
        after: { roleCode: "OWNER", employeeCode: body.employeeCode },
        reason: "Initial deployment bootstrap",
        result: "SUCCESS",
      },
      tx,
    );

    return { propertyId: property.id, userId: user.id };
  });

  if (!result) {
    return NextResponse.json(
      { error: "bootstrap_already_completed" },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { status: "owner_bootstrapped", propertyId: result.propertyId },
    { status: 201 },
  );
}
