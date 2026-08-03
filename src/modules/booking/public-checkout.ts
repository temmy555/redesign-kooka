import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  paymentInstructionVersions,
  policySets,
  policyVersions,
  ratePlans,
  ratePlanVersions,
} from "../../db/schema";
import { AppError } from "../../platform/errors";

function isEffective(
  row: { effectiveFrom: Date; effectiveTo: Date | null },
  at: Date,
) {
  return row.effectiveFrom <= at && (!row.effectiveTo || row.effectiveTo > at);
}

export async function getPublicCheckoutPolicies(
  propertyId: string,
  ratePlanCode: string,
) {
  const db = getDatabase();
  const now = new Date();
  const plans = await db
    .select({
      cancellationPolicySetId: ratePlanVersions.cancellationPolicySetId,
      paymentInstructionSetId: ratePlanVersions.paymentInstructionSetId,
      lifecycleStatus: ratePlanVersions.lifecycleStatus,
      sourceEligibility: ratePlanVersions.sourceEligibility,
      effectiveFrom: ratePlanVersions.effectiveFrom,
      effectiveTo: ratePlanVersions.effectiveTo,
    })
    .from(ratePlans)
    .innerJoin(ratePlanVersions, eq(ratePlanVersions.ratePlanId, ratePlans.id))
    .where(
      and(
        eq(ratePlans.propertyId, propertyId),
        eq(ratePlans.code, ratePlanCode.trim().toUpperCase()),
        eq(ratePlans.status, "ACTIVE"),
        inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
      ),
    )
    .orderBy(desc(ratePlanVersions.effectiveFrom));
  const plan = plans.find(
    (row) =>
      isEffective(row, now) &&
      ["ALL", "ONLINE"].includes(row.sourceEligibility),
  );
  if (!plan) throw new AppError("NOT_FOUND", "No eligible rate plan");
  if (!plan.paymentInstructionSetId) {
    throw new AppError("CONFLICT", "Payment instruction is not configured");
  }
  const paymentInstructions = await db
    .select({
      effectiveFrom: paymentInstructionVersions.effectiveFrom,
      effectiveTo: paymentInstructionVersions.effectiveTo,
    })
    .from(paymentInstructionVersions)
    .where(
      and(
        eq(
          paymentInstructionVersions.instructionSetId,
          plan.paymentInstructionSetId,
        ),
        inArray(paymentInstructionVersions.lifecycleStatus, [
          "ACTIVE",
          "SCHEDULED",
        ]),
      ),
    )
    .orderBy(desc(paymentInstructionVersions.effectiveFrom));
  if (!paymentInstructions.some((row) => isEffective(row, now))) {
    throw new AppError("CONFLICT", "Payment instruction is not configured");
  }

  const rows = await db
    .select({
      id: policyVersions.id,
      policySetId: policyVersions.policySetId,
      policyType: policySets.policyType,
      lifecycleStatus: policyVersions.lifecycleStatus,
      titleId: policyVersions.titleId,
      titleEn: policyVersions.titleEn,
      summaryId: policyVersions.summaryId,
      summaryEn: policyVersions.summaryEn,
      contentId: policyVersions.contentId,
      contentEn: policyVersions.contentEn,
      effectiveFrom: policyVersions.effectiveFrom,
      effectiveTo: policyVersions.effectiveTo,
    })
    .from(policySets)
    .innerJoin(policyVersions, eq(policyVersions.policySetId, policySets.id))
    .where(
      and(
        eq(policySets.propertyId, propertyId),
        inArray(policyVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
      ),
    )
    .orderBy(desc(policyVersions.effectiveFrom));

  const requiredSets = new Set(
    [
      plan.cancellationPolicySetId,
      rows.find((row) => row.policyType === "HOUSE_RULES")?.policySetId,
    ].filter((id): id is string => Boolean(id)),
  );
  const currentBySet = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (
      requiredSets.has(row.policySetId) &&
      !currentBySet.has(row.policySetId) &&
      isEffective(row, now)
    ) {
      currentBySet.set(row.policySetId, row);
    }
  }
  return [...currentBySet.values()].map((row) => ({
    id: row.id,
    type: row.policyType,
    titleId: row.titleId,
    titleEn: row.titleEn,
    summaryId: row.summaryId,
    summaryEn: row.summaryEn,
    contentId: row.contentId,
    contentEn: row.contentEn,
  }));
}
