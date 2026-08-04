import "server-only";

import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  documentProfiles,
  documentProfileVersions,
  paymentInstructionSets,
  paymentInstructionVersions,
  policySets,
  policyVersions,
  ratePlans,
  ratePlanVersions,
  taxProfiles,
  taxProfileVersions,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import type { MutationResult, ReviewDecision, StaffSession } from "./contracts";
import { lifecycleForPublish, requirePublishable } from "./versioning";

export type CommercialVersionSubject =
  | "TAX_PROFILE"
  | "POLICY"
  | "PAYMENT_INSTRUCTION"
  | "DOCUMENT_PROFILE"
  | "RATE_PLAN";

interface OwnedVersion {
  id: string;
  parentId: string;
  lifecycleStatus: string;
  approvalStatus: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

function checkedReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A reason between 3 and 500 characters is required",
    );
  }
  return value;
}

async function getOwnedVersion(
  subject: CommercialVersionSubject,
  versionId: string,
  propertyId: string,
): Promise<OwnedVersion> {
  const db = getDatabase();
  if (subject === "TAX_PROFILE") {
    const [row] = await db
      .select({
        id: taxProfileVersions.id,
        parentId: taxProfileVersions.taxProfileId,
        lifecycleStatus: taxProfileVersions.lifecycleStatus,
        approvalStatus: taxProfileVersions.approvalStatus,
        effectiveFrom: taxProfileVersions.effectiveFrom,
        effectiveTo: taxProfileVersions.effectiveTo,
      })
      .from(taxProfileVersions)
      .innerJoin(
        taxProfiles,
        eq(taxProfiles.id, taxProfileVersions.taxProfileId),
      )
      .where(
        and(
          eq(taxProfileVersions.id, versionId),
          eq(taxProfiles.propertyId, propertyId),
        ),
      )
      .limit(1);
    if (row) return row;
  }
  if (subject === "POLICY") {
    const [row] = await db
      .select({
        id: policyVersions.id,
        parentId: policyVersions.policySetId,
        lifecycleStatus: policyVersions.lifecycleStatus,
        approvalStatus: policyVersions.approvalStatus,
        effectiveFrom: policyVersions.effectiveFrom,
        effectiveTo: policyVersions.effectiveTo,
      })
      .from(policyVersions)
      .innerJoin(policySets, eq(policySets.id, policyVersions.policySetId))
      .where(
        and(
          eq(policyVersions.id, versionId),
          eq(policySets.propertyId, propertyId),
        ),
      )
      .limit(1);
    if (row) return row;
  }
  if (subject === "PAYMENT_INSTRUCTION") {
    const [row] = await db
      .select({
        id: paymentInstructionVersions.id,
        parentId: paymentInstructionVersions.instructionSetId,
        lifecycleStatus: paymentInstructionVersions.lifecycleStatus,
        approvalStatus: paymentInstructionVersions.approvalStatus,
        effectiveFrom: paymentInstructionVersions.effectiveFrom,
        effectiveTo: paymentInstructionVersions.effectiveTo,
      })
      .from(paymentInstructionVersions)
      .innerJoin(
        paymentInstructionSets,
        eq(
          paymentInstructionSets.id,
          paymentInstructionVersions.instructionSetId,
        ),
      )
      .where(
        and(
          eq(paymentInstructionVersions.id, versionId),
          eq(paymentInstructionSets.propertyId, propertyId),
        ),
      )
      .limit(1);
    if (row) return row;
  }
  if (subject === "DOCUMENT_PROFILE") {
    const [row] = await db
      .select({
        id: documentProfileVersions.id,
        parentId: documentProfileVersions.documentProfileId,
        lifecycleStatus: documentProfileVersions.lifecycleStatus,
        approvalStatus: documentProfileVersions.approvalStatus,
        effectiveFrom: documentProfileVersions.effectiveFrom,
        effectiveTo: documentProfileVersions.effectiveTo,
      })
      .from(documentProfileVersions)
      .innerJoin(
        documentProfiles,
        eq(documentProfiles.id, documentProfileVersions.documentProfileId),
      )
      .where(
        and(
          eq(documentProfileVersions.id, versionId),
          eq(documentProfiles.propertyId, propertyId),
        ),
      )
      .limit(1);
    if (row) return row;
  }
  if (subject === "RATE_PLAN") {
    const [row] = await db
      .select({
        id: ratePlanVersions.id,
        parentId: ratePlanVersions.ratePlanId,
        lifecycleStatus: ratePlanVersions.lifecycleStatus,
        approvalStatus: ratePlanVersions.approvalStatus,
        effectiveFrom: ratePlanVersions.effectiveFrom,
        effectiveTo: ratePlanVersions.effectiveTo,
      })
      .from(ratePlanVersions)
      .innerJoin(ratePlans, eq(ratePlans.id, ratePlanVersions.ratePlanId))
      .where(
        and(
          eq(ratePlanVersions.id, versionId),
          eq(ratePlans.propertyId, propertyId),
        ),
      )
      .limit(1);
    if (row) return row;
  }
  throw new AppError("NOT_FOUND", "Commercial version not found");
}

export async function reviewCommercialVersion(params: {
  session: StaffSession;
  propertyId: string;
  subject: CommercialVersionSubject;
  versionId: string;
  decision: ReviewDecision;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.approve",
  );
  const reason = checkedReason(params.reason);
  const current = await getOwnedVersion(
    params.subject,
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
  const reviewedAt = new Date();

  return getDatabase().transaction(async (tx) => {
    const update = {
      approvalStatus,
      approvedByUserId: params.session.user.id,
      approvedAt: reviewedAt,
      reason,
      updatedAt: reviewedAt,
      updatedByUserId: params.session.user.id,
    };
    switch (params.subject) {
      case "TAX_PROFILE":
        await tx
          .update(taxProfileVersions)
          .set(update)
          .where(eq(taxProfileVersions.id, params.versionId));
        break;
      case "POLICY":
        await tx
          .update(policyVersions)
          .set(update)
          .where(eq(policyVersions.id, params.versionId));
        break;
      case "PAYMENT_INSTRUCTION":
        await tx
          .update(paymentInstructionVersions)
          .set(update)
          .where(eq(paymentInstructionVersions.id, params.versionId));
        break;
      case "DOCUMENT_PROFILE":
        await tx
          .update(documentProfileVersions)
          .set(update)
          .where(eq(documentProfileVersions.id, params.versionId));
        break;
      case "RATE_PLAN":
        await tx
          .update(ratePlanVersions)
          .set(update)
          .where(eq(ratePlanVersions.id, params.versionId));
        break;
    }
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: `commercial.${params.subject.toLowerCase()}.${params.decision.toLowerCase()}`,
        targetType: params.subject.toLowerCase(),
        targetId: params.versionId,
        before: { approvalStatus: current.approvalStatus },
        after: { approvalStatus },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: params.versionId,
      lifecycleStatus: "DRAFT",
      approvalStatus,
    };
  });
}

function overlaps(
  sibling: { effectiveFrom: Date; effectiveTo: Date | null },
  current: OwnedVersion,
): boolean {
  const infinity = new Date(8640000000000000);
  return (
    sibling.effectiveFrom < (current.effectiveTo ?? infinity) &&
    (sibling.effectiveTo ?? infinity) > current.effectiveFrom
  );
}

export async function publishCommercialVersion(params: {
  session: StaffSession;
  propertyId: string;
  subject: CommercialVersionSubject;
  versionId: string;
  reason: string;
  now?: Date;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  const current = await getOwnedVersion(
    params.subject,
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
      sql`select pg_advisory_xact_lock(hashtextextended(${`commercial:${params.subject}:${current.parentId}`}, 0))`,
    );
    if (params.subject === "TAX_PROFILE") {
      const siblings = await tx
        .select({
          id: taxProfileVersions.id,
          lifecycleStatus: taxProfileVersions.lifecycleStatus,
          effectiveFrom: taxProfileVersions.effectiveFrom,
          effectiveTo: taxProfileVersions.effectiveTo,
        })
        .from(taxProfileVersions)
        .where(
          and(
            eq(taxProfileVersions.taxProfileId, current.parentId),
            ne(taxProfileVersions.id, current.id),
            inArray(taxProfileVersions.lifecycleStatus, [
              "ACTIVE",
              "SCHEDULED",
            ]),
          ),
        );
      for (const sibling of siblings) {
        if (!overlaps(sibling, current)) continue;
        if (
          sibling.lifecycleStatus !== "ACTIVE" ||
          sibling.effectiveFrom >= current.effectiveFrom
        ) {
          throw new AppError(
            "CONFLICT",
            "Effective period overlaps another tax version",
          );
        }
        await tx
          .update(taxProfileVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(taxProfileVersions.id, sibling.id));
      }
      await tx
        .update(taxProfileVersions)
        .set({
          lifecycleStatus,
          reason,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(taxProfileVersions.id, current.id));
    } else if (params.subject === "POLICY") {
      const siblings = await tx
        .select({
          id: policyVersions.id,
          lifecycleStatus: policyVersions.lifecycleStatus,
          effectiveFrom: policyVersions.effectiveFrom,
          effectiveTo: policyVersions.effectiveTo,
        })
        .from(policyVersions)
        .where(
          and(
            eq(policyVersions.policySetId, current.parentId),
            ne(policyVersions.id, current.id),
            inArray(policyVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          ),
        );
      for (const sibling of siblings) {
        if (!overlaps(sibling, current)) continue;
        if (
          sibling.lifecycleStatus !== "ACTIVE" ||
          sibling.effectiveFrom >= current.effectiveFrom
        )
          throw new AppError(
            "CONFLICT",
            "Effective period overlaps another policy version",
          );
        await tx
          .update(policyVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(policyVersions.id, sibling.id));
      }
      await tx
        .update(policyVersions)
        .set({
          lifecycleStatus,
          reason,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(policyVersions.id, current.id));
    } else if (params.subject === "PAYMENT_INSTRUCTION") {
      const siblings = await tx
        .select({
          id: paymentInstructionVersions.id,
          lifecycleStatus: paymentInstructionVersions.lifecycleStatus,
          effectiveFrom: paymentInstructionVersions.effectiveFrom,
          effectiveTo: paymentInstructionVersions.effectiveTo,
        })
        .from(paymentInstructionVersions)
        .where(
          and(
            eq(paymentInstructionVersions.instructionSetId, current.parentId),
            ne(paymentInstructionVersions.id, current.id),
            inArray(paymentInstructionVersions.lifecycleStatus, [
              "ACTIVE",
              "SCHEDULED",
            ]),
          ),
        );
      for (const sibling of siblings) {
        if (!overlaps(sibling, current)) continue;
        if (
          sibling.lifecycleStatus !== "ACTIVE" ||
          sibling.effectiveFrom >= current.effectiveFrom
        )
          throw new AppError(
            "CONFLICT",
            "Effective period overlaps another payment instruction version",
          );
        await tx
          .update(paymentInstructionVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(paymentInstructionVersions.id, sibling.id));
      }
      await tx
        .update(paymentInstructionVersions)
        .set({
          lifecycleStatus,
          reason,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(paymentInstructionVersions.id, current.id));
    } else if (params.subject === "DOCUMENT_PROFILE") {
      const siblings = await tx
        .select({
          id: documentProfileVersions.id,
          lifecycleStatus: documentProfileVersions.lifecycleStatus,
          effectiveFrom: documentProfileVersions.effectiveFrom,
          effectiveTo: documentProfileVersions.effectiveTo,
        })
        .from(documentProfileVersions)
        .where(
          and(
            eq(documentProfileVersions.documentProfileId, current.parentId),
            ne(documentProfileVersions.id, current.id),
            inArray(documentProfileVersions.lifecycleStatus, [
              "ACTIVE",
              "SCHEDULED",
            ]),
          ),
        );
      for (const sibling of siblings) {
        if (!overlaps(sibling, current)) continue;
        if (
          sibling.lifecycleStatus !== "ACTIVE" ||
          sibling.effectiveFrom >= current.effectiveFrom
        )
          throw new AppError(
            "CONFLICT",
            "Effective period overlaps another document profile version",
          );
        await tx
          .update(documentProfileVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(documentProfileVersions.id, sibling.id));
      }
      await tx
        .update(documentProfileVersions)
        .set({
          lifecycleStatus,
          reason,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(documentProfileVersions.id, current.id));
    } else {
      const siblings = await tx
        .select({
          id: ratePlanVersions.id,
          lifecycleStatus: ratePlanVersions.lifecycleStatus,
          effectiveFrom: ratePlanVersions.effectiveFrom,
          effectiveTo: ratePlanVersions.effectiveTo,
        })
        .from(ratePlanVersions)
        .where(
          and(
            eq(ratePlanVersions.ratePlanId, current.parentId),
            ne(ratePlanVersions.id, current.id),
            inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          ),
        );
      for (const sibling of siblings) {
        if (!overlaps(sibling, current)) continue;
        if (
          sibling.lifecycleStatus !== "ACTIVE" ||
          sibling.effectiveFrom >= current.effectiveFrom
        )
          throw new AppError(
            "CONFLICT",
            "Effective period overlaps another rate plan version",
          );
        await tx
          .update(ratePlanVersions)
          .set({
            effectiveTo: current.effectiveFrom,
            updatedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(ratePlanVersions.id, sibling.id));
      }
      await tx
        .update(ratePlanVersions)
        .set({
          lifecycleStatus,
          reason,
          updatedAt: now,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(ratePlanVersions.id, current.id));
    }

    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: `commercial.${params.subject.toLowerCase()}.publish`,
        targetType: params.subject.toLowerCase(),
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

export async function retireCommercialVersion(params: {
  session: StaffSession;
  propertyId: string;
  subject: CommercialVersionSubject;
  versionId: string;
  reason: string;
  now?: Date;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  const current = await getOwnedVersion(
    params.subject,
    params.versionId,
    params.propertyId,
  );
  if (!["ACTIVE", "SCHEDULED"].includes(current.lifecycleStatus)) {
    throw new AppError(
      "CONFLICT",
      "Only an active or scheduled commercial version can be retired",
    );
  }
  const now = params.now ?? new Date();
  const linkedRateField =
    params.subject === "TAX_PROFILE"
      ? ratePlanVersions.taxProfileId
      : params.subject === "POLICY"
        ? ratePlanVersions.cancellationPolicySetId
        : null;
  if (linkedRateField) {
    const [linkedRate] = await getDatabase()
      .select({ name: ratePlanVersions.nameId })
      .from(ratePlanVersions)
      .innerJoin(ratePlans, eq(ratePlans.id, ratePlanVersions.ratePlanId))
      .where(
        and(
          eq(ratePlans.propertyId, params.propertyId),
          eq(linkedRateField, current.parentId),
          inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
          or(
            isNull(ratePlanVersions.effectiveTo),
            gt(ratePlanVersions.effectiveTo, now),
          ),
        ),
      )
      .limit(1);
    if (linkedRate) {
      const subjectName =
        params.subject === "TAX_PROFILE" ? "Pengaturan pajak" : "Kebijakan";
      throw new AppError(
        "CONFLICT",
        `${subjectName} masih dipakai oleh harga kamar ${linkedRate.name}. Edit harga kamar tersebut terlebih dahulu.`,
      );
    }
  }
  const update = {
    lifecycleStatus: "RETIRED",
    effectiveTo: current.effectiveFrom < now ? now : current.effectiveTo,
    reason,
    updatedAt: now,
    updatedByUserId: params.session.user.id,
  };

  return getDatabase().transaction(async (tx) => {
    switch (params.subject) {
      case "TAX_PROFILE":
        await tx
          .update(taxProfileVersions)
          .set(update)
          .where(eq(taxProfileVersions.id, params.versionId));
        break;
      case "POLICY":
        await tx
          .update(policyVersions)
          .set(update)
          .where(eq(policyVersions.id, params.versionId));
        break;
      case "PAYMENT_INSTRUCTION":
        await tx
          .update(paymentInstructionVersions)
          .set(update)
          .where(eq(paymentInstructionVersions.id, params.versionId));
        break;
      case "DOCUMENT_PROFILE":
        await tx
          .update(documentProfileVersions)
          .set(update)
          .where(eq(documentProfileVersions.id, params.versionId));
        break;
      case "RATE_PLAN":
        await tx
          .update(ratePlanVersions)
          .set(update)
          .where(eq(ratePlanVersions.id, params.versionId));
        break;
    }
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: `commercial.${params.subject.toLowerCase()}.retire`,
        targetType: params.subject.toLowerCase(),
        targetId: params.versionId,
        before: { lifecycleStatus: current.lifecycleStatus },
        after: {
          lifecycleStatus: "RETIRED",
          effectiveTo: update.effectiveTo?.toISOString() ?? null,
        },
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
