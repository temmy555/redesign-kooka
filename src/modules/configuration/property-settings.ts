import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  exchangeRateSnapshots,
  properties,
  propertySettingSets,
  propertySettingVersions,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import type {
  ImpactPreview,
  MutationResult,
  ReviewDecision,
  StaffSession,
} from "./contracts";
import {
  assertEffectivePeriod,
  isEffectiveAt,
  lifecycleForPublish,
  nextVersionNumber,
  normalizeMasterCode,
  requirePublishable,
} from "./versioning";

export interface PropertySettingDraftInput {
  code: string;
  name: string;
  values: Record<string, unknown>;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
  requiresApproval?: boolean;
}

export async function updatePropertyProfile(params: {
  session: StaffSession;
  propertyId: string;
  name: string;
  address?: string | null;
  timezone: string;
  defaultLocale: "id" | "en";
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.manage",
  );
  const reason = assertReason(params.reason);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: params.timezone }).format();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid IANA timezone");
  }
  const db = getDatabase();
  const [current] = await db
    .select({
      name: properties.name,
      address: properties.address,
      timezone: properties.timezone,
      defaultLocale: properties.defaultLocale,
      baseCurrency: properties.baseCurrency,
    })
    .from(properties)
    .where(eq(properties.id, params.propertyId))
    .limit(1);
  if (!current) throw new AppError("NOT_FOUND", "Property not found");
  return db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({
        name: params.name.trim(),
        address: params.address ?? null,
        timezone: params.timezone,
        defaultLocale: params.defaultLocale,
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(properties.id, params.propertyId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "configuration.property_profile.update",
        targetType: "property",
        targetId: params.propertyId,
        before: current,
        after: {
          name: params.name.trim(),
          address: params.address ?? null,
          timezone: params.timezone,
          defaultLocale: params.defaultLocale,
          baseCurrency: "IDR",
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: params.propertyId };
  });
}

function assertReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A reason between 3 and 500 characters is required",
    );
  }
  return value;
}

export async function getPropertyConfigurationOverview(params: {
  session: StaffSession;
  propertyId: string;
  at?: Date;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.view",
  );
  const db = getDatabase();
  const at = params.at ?? new Date();

  const [property] = await db
    .select({
      id: properties.id,
      code: properties.code,
      name: properties.name,
      address: properties.address,
      timezone: properties.timezone,
      defaultLocale: properties.defaultLocale,
      baseCurrency: properties.baseCurrency,
      status: properties.status,
    })
    .from(properties)
    .where(eq(properties.id, params.propertyId))
    .limit(1);
  if (!property) throw new AppError("NOT_FOUND", "Property not found");

  const settingRows = await db
    .select({
      setId: propertySettingSets.id,
      code: propertySettingSets.code,
      name: propertySettingSets.name,
      versionId: propertySettingVersions.id,
      versionNumber: propertySettingVersions.versionNumber,
      lifecycleStatus: propertySettingVersions.lifecycleStatus,
      approvalStatus: propertySettingVersions.approvalStatus,
      effectiveFrom: propertySettingVersions.effectiveFrom,
      effectiveTo: propertySettingVersions.effectiveTo,
      values: propertySettingVersions.values,
    })
    .from(propertySettingSets)
    .leftJoin(
      propertySettingVersions,
      eq(propertySettingVersions.settingSetId, propertySettingSets.id),
    )
    .where(eq(propertySettingSets.propertyId, params.propertyId))
    .orderBy(
      propertySettingSets.code,
      desc(propertySettingVersions.versionNumber),
    );

  const sets = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      resolved: (typeof settingRows)[number] | null;
      versions: (typeof settingRows)[number][];
    }
  >();
  for (const row of settingRows) {
    const current = sets.get(row.setId) ?? {
      id: row.setId,
      code: row.code,
      name: row.name,
      resolved: null,
      versions: [],
    };
    if (row.versionId && row.effectiveFrom) {
      current.versions.push(row);
      if (
        !current.resolved &&
        isEffectiveAt(
          {
            lifecycleStatus: row.lifecycleStatus ?? "DRAFT",
            approvalStatus: row.approvalStatus,
            effectiveFrom: row.effectiveFrom,
            effectiveTo: row.effectiveTo,
          },
          at,
        )
      ) {
        current.resolved = row;
      }
    }
    sets.set(row.setId, current);
  }

  const displayRates = await db
    .select({
      id: exchangeRateSnapshots.id,
      quoteCurrency: exchangeRateSnapshots.quoteCurrency,
      rate: exchangeRateSnapshots.rate,
      source: exchangeRateSnapshots.source,
      asOfAt: exchangeRateSnapshots.asOfAt,
      expiresAt: exchangeRateSnapshots.expiresAt,
    })
    .from(exchangeRateSnapshots)
    .where(eq(exchangeRateSnapshots.propertyId, params.propertyId))
    .orderBy(
      exchangeRateSnapshots.quoteCurrency,
      desc(exchangeRateSnapshots.asOfAt),
    );

  return {
    property,
    resolvedAt: at.toISOString(),
    settings: [...sets.values()],
    displayRates,
  };
}

export async function previewPropertySettingChange(params: {
  session: StaffSession;
  propertyId: string;
  input: PropertySettingDraftInput;
}): Promise<ImpactPreview> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.manage",
  );
  assertEffectivePeriod(params.input.effectiveFrom, params.input.effectiveTo);
  const code = normalizeMasterCode(params.input.code);
  const highRiskKeys = new Set([
    "bank",
    "tax",
    "checkInTime",
    "checkoutTime",
    "businessDateRolloverHour",
    "paymentDeadlineMinutes",
  ]);
  const touchedKeys = Object.keys(params.input.values);
  const highRisk = touchedKeys.some((key) => highRiskKeys.has(key));

  const db = getDatabase();
  const existing = await db
    .select({ id: propertySettingSets.id })
    .from(propertySettingSets)
    .where(
      and(
        eq(propertySettingSets.propertyId, params.propertyId),
        eq(propertySettingSets.code, code),
      ),
    )
    .limit(1);

  return {
    severity: highRisk ? "HIGH" : existing.length ? "MEDIUM" : "LOW",
    blockers: [],
    warnings: [
      ...(highRisk
        ? ["This change touches operational or financial configuration"]
        : []),
      ...(params.input.effectiveFrom <= new Date()
        ? ["Publishing will make this version effective immediately"]
        : []),
    ],
    references: { existingSettingSets: existing.length },
  };
}

export async function createPropertySettingDraft(params: {
  session: StaffSession;
  propertyId: string;
  input: PropertySettingDraftInput;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.manage",
  );
  const reason = assertReason(params.input.reason);
  assertEffectivePeriod(params.input.effectiveFrom, params.input.effectiveTo);
  const code = normalizeMasterCode(params.input.code);
  if (Object.keys(params.input.values).length === 0) {
    throw new AppError("VALIDATION_ERROR", "Setting values cannot be empty");
  }

  return getDatabase().transaction(async (tx) => {
    await tx
      .insert(propertySettingSets)
      .values({
        propertyId: params.propertyId,
        code,
        name: params.input.name.trim(),
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .onConflictDoNothing();

    const [settingSet] = await tx
      .select({ id: propertySettingSets.id })
      .from(propertySettingSets)
      .where(
        and(
          eq(propertySettingSets.propertyId, params.propertyId),
          eq(propertySettingSets.code, code),
        ),
      )
      .limit(1);
    if (!settingSet) throw new Error("Failed to resolve setting set");

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`property-setting:${settingSet.id}`}, 0))`,
    );

    const existing = await tx
      .select({ versionNumber: propertySettingVersions.versionNumber })
      .from(propertySettingVersions)
      .where(eq(propertySettingVersions.settingSetId, settingSet.id));
    const versionNumber = nextVersionNumber(existing);
    const approvalStatus = params.input.requiresApproval
      ? "PENDING"
      : "NOT_REQUIRED";
    const [created] = await tx
      .insert(propertySettingVersions)
      .values({
        settingSetId: settingSet.id,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus,
        effectiveFrom: params.input.effectiveFrom,
        effectiveTo: params.input.effectiveTo ?? null,
        values: params.input.values,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: propertySettingVersions.id });
    if (!created) throw new Error("Failed to create setting version");

    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "configuration.setting.version.create",
        targetType: "property_setting_version",
        targetId: created.id,
        after: {
          code,
          versionNumber,
          approvalStatus,
          effectiveFrom: params.input.effectiveFrom.toISOString(),
          effectiveTo: params.input.effectiveTo?.toISOString() ?? null,
          valueKeys: Object.keys(params.input.values).sort(),
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: created.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus,
    };
  });
}

async function getOwnedSettingVersion(versionId: string, propertyId: string) {
  const [row] = await getDatabase()
    .select({
      id: propertySettingVersions.id,
      settingSetId: propertySettingVersions.settingSetId,
      lifecycleStatus: propertySettingVersions.lifecycleStatus,
      approvalStatus: propertySettingVersions.approvalStatus,
      effectiveFrom: propertySettingVersions.effectiveFrom,
      effectiveTo: propertySettingVersions.effectiveTo,
      createdByUserId: propertySettingVersions.createdByUserId,
    })
    .from(propertySettingVersions)
    .innerJoin(
      propertySettingSets,
      eq(propertySettingSets.id, propertySettingVersions.settingSetId),
    )
    .where(
      and(
        eq(propertySettingVersions.id, versionId),
        eq(propertySettingSets.propertyId, propertyId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Setting version not found");
  return row;
}

export async function reviewPropertySettingVersion(params: {
  session: StaffSession;
  propertyId: string;
  versionId: string;
  decision: ReviewDecision;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.approve",
  );
  const reason = assertReason(params.reason);
  const current = await getOwnedSettingVersion(
    params.versionId,
    params.propertyId,
  );
  if (
    current.lifecycleStatus !== "DRAFT" ||
    current.approvalStatus !== "PENDING"
  ) {
    throw new AppError("CONFLICT", "Only a pending draft can be reviewed");
  }
  const approvalStatus =
    params.decision === "APPROVE" ? "APPROVED" : "REJECTED";

  return getDatabase().transaction(async (tx) => {
    await tx
      .update(propertySettingVersions)
      .set({
        approvalStatus,
        approvedByUserId: params.session.user.id,
        approvedAt: new Date(),
        reason,
        updatedByUserId: params.session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(propertySettingVersions.id, params.versionId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: `configuration.setting.${params.decision.toLowerCase()}`,
        targetType: "property_setting_version",
        targetId: params.versionId,
        before: { approvalStatus: current.approvalStatus },
        after: { approvalStatus },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: params.versionId, lifecycleStatus: "DRAFT", approvalStatus };
  });
}

export async function publishPropertySettingVersion(params: {
  session: StaffSession;
  propertyId: string;
  versionId: string;
  reason: string;
  now?: Date;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.manage",
  );
  const reason = assertReason(params.reason);
  const current = await getOwnedSettingVersion(
    params.versionId,
    params.propertyId,
  );
  try {
    requirePublishable(current);
  } catch (error) {
    throw new AppError(
      "CONFLICT",
      error instanceof Error ? error.message : "Version cannot be published",
    );
  }
  const now = params.now ?? new Date();
  const lifecycleStatus = lifecycleForPublish(current.effectiveFrom, now);

  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`property-setting:${current.settingSetId}`}, 0))`,
    );
    const siblings = await tx
      .select({
        id: propertySettingVersions.id,
        lifecycleStatus: propertySettingVersions.lifecycleStatus,
        effectiveFrom: propertySettingVersions.effectiveFrom,
        effectiveTo: propertySettingVersions.effectiveTo,
      })
      .from(propertySettingVersions)
      .where(
        and(
          eq(propertySettingVersions.settingSetId, current.settingSetId),
          ne(propertySettingVersions.id, current.id),
          inArray(propertySettingVersions.lifecycleStatus, [
            "ACTIVE",
            "SCHEDULED",
          ]),
        ),
      );

    for (const sibling of siblings) {
      const overlaps =
        sibling.effectiveFrom <
          (current.effectiveTo ?? new Date(8640000000000000)) &&
        (sibling.effectiveTo ?? new Date(8640000000000000)) >
          current.effectiveFrom;
      if (!overlaps) continue;
      if (
        sibling.lifecycleStatus === "ACTIVE" &&
        sibling.effectiveFrom < current.effectiveFrom
      ) {
        await tx
          .update(propertySettingVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(propertySettingVersions.id, sibling.id));
      } else {
        throw new AppError(
          "CONFLICT",
          "Effective period overlaps another scheduled or active version",
        );
      }
    }

    await tx
      .update(propertySettingVersions)
      .set({
        lifecycleStatus,
        reason,
        updatedAt: now,
        updatedByUserId: params.session.user.id,
      })
      .where(eq(propertySettingVersions.id, params.versionId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "configuration.setting.publish",
        targetType: "property_setting_version",
        targetId: params.versionId,
        before: { lifecycleStatus: current.lifecycleStatus },
        after: {
          lifecycleStatus,
          effectiveFrom: current.effectiveFrom.toISOString(),
          effectiveTo: current.effectiveTo?.toISOString() ?? null,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: params.versionId,
      lifecycleStatus,
      approvalStatus: current.approvalStatus,
    };
  });
}

export async function retirePropertySettingVersion(params: {
  session: StaffSession;
  propertyId: string;
  versionId: string;
  reason: string;
  now?: Date;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "configuration.manage",
  );
  const reason = assertReason(params.reason);
  const current = await getOwnedSettingVersion(
    params.versionId,
    params.propertyId,
  );
  if (!["ACTIVE", "SCHEDULED"].includes(current.lifecycleStatus)) {
    throw new AppError(
      "CONFLICT",
      "Only an active or scheduled version can be retired",
    );
  }
  const now = params.now ?? new Date();

  return getDatabase().transaction(async (tx) => {
    await tx
      .update(propertySettingVersions)
      .set({
        lifecycleStatus: "RETIRED",
        effectiveTo: current.effectiveFrom < now ? now : current.effectiveTo,
        reason,
        updatedAt: now,
        updatedByUserId: params.session.user.id,
      })
      .where(eq(propertySettingVersions.id, params.versionId));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "configuration.setting.retire",
        targetType: "property_setting_version",
        targetId: params.versionId,
        before: { lifecycleStatus: current.lifecycleStatus },
        after: { lifecycleStatus: "RETIRED" },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: params.versionId,
      lifecycleStatus: "RETIRED",
      approvalStatus: current.approvalStatus,
    };
  });
}
