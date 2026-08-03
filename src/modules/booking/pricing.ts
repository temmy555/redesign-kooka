import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  exchangeRateSnapshots,
  ratePlans,
  ratePlanVersions,
  rateRuleDates,
  rateRules,
  taxProfiles,
  taxProfileVersions,
} from "../../db/schema";
import type * as schema from "../../db/schema";
import { AppError } from "../../platform/errors";
import { calculateNightAmounts } from "./domain";
import type { DisplayCurrency } from "./contracts";

type PricingDb = Pick<NodePgDatabase<typeof schema>, "select">;

const RULE_RANK: Record<string, number> = {
  BASE: 1,
  WEEK_PATTERN: 2,
  SEASONAL: 3,
  SPECIAL_DATE: 4,
};

function effectiveAt(
  row: {
    effectiveFrom: Date;
    effectiveTo: Date | null;
    lifecycleStatus: string;
  },
  at: Date,
): boolean {
  return (
    ["ACTIVE", "SCHEDULED"].includes(row.lifecycleStatus) &&
    row.effectiveFrom <= at &&
    (!row.effectiveTo || row.effectiveTo > at)
  );
}

export async function resolveNightPrice(
  db: PricingDb,
  params: {
    propertyId: string;
    ratePlanCode: string;
    roomTypeId: string;
    stayDate: string;
    checkInDate: string;
    checkoutDate: string;
    at: Date;
    source: "ONLINE" | "ADMIN_MANUAL";
  },
) {
  const versions = await db
    .select({
      ratePlanId: ratePlans.id,
      ratePlanVersionId: ratePlanVersions.id,
      ratePlanVersionNumber: ratePlanVersions.versionNumber,
      lifecycleStatus: ratePlanVersions.lifecycleStatus,
      approvalStatus: ratePlanVersions.approvalStatus,
      sourceEligibility: ratePlanVersions.sourceEligibility,
      taxProfileId: ratePlanVersions.taxProfileId,
      paymentInstructionSetId: ratePlanVersions.paymentInstructionSetId,
      cancellationPolicySetId: ratePlanVersions.cancellationPolicySetId,
      effectiveFrom: ratePlanVersions.effectiveFrom,
      effectiveTo: ratePlanVersions.effectiveTo,
    })
    .from(ratePlans)
    .innerJoin(ratePlanVersions, eq(ratePlanVersions.ratePlanId, ratePlans.id))
    .where(
      and(
        eq(ratePlans.propertyId, params.propertyId),
        eq(ratePlans.code, params.ratePlanCode.trim().toUpperCase()),
        eq(ratePlans.status, "ACTIVE"),
        inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
      ),
    )
    .orderBy(desc(ratePlanVersions.effectiveFrom));
  const version = versions.find(
    (candidate) =>
      effectiveAt(candidate, params.at) &&
      ["ALL", params.source].includes(candidate.sourceEligibility),
  );
  if (!version) throw new AppError("NOT_FOUND", "No eligible rate plan");

  const rules = await db
    .select()
    .from(rateRules)
    .where(
      and(
        eq(rateRules.ratePlanVersionId, version.ratePlanVersionId),
        eq(rateRules.roomTypeId, params.roomTypeId),
        lte(rateRules.startsOn, params.stayDate),
        gte(rateRules.endsOn, params.stayDate),
      ),
    )
    .orderBy(desc(rateRules.priority), asc(rateRules.id));
  const weekday = new Date(`${params.stayDate}T00:00:00.000Z`).getUTCDay();
  const applicable = rules.filter(
    (rule) => (rule.weekdaysMask & (1 << weekday)) !== 0,
  );
  if (applicable.length === 0) {
    throw new AppError("NOT_FOUND", "No rate is configured for this date");
  }
  const overrides = await db
    .select()
    .from(rateRuleDates)
    .where(
      and(
        inArray(
          rateRuleDates.rateRuleId,
          applicable.map((rule) => rule.id),
        ),
        eq(rateRuleDates.stayDate, params.stayDate),
      ),
    );
  const overrideByRule = new Map(overrides.map((row) => [row.rateRuleId, row]));
  applicable.sort((left, right) => {
    const overrideDelta =
      Number(overrideByRule.has(right.id)) -
      Number(overrideByRule.has(left.id));
    return (
      overrideDelta ||
      (RULE_RANK[right.ruleType] ?? 0) - (RULE_RANK[left.ruleType] ?? 0) ||
      right.priority - left.priority ||
      left.id.localeCompare(right.id)
    );
  });
  const winner = applicable[0]!;
  const override = overrideByRule.get(winner.id);
  if (override?.salesClosed) {
    throw new AppError("CONFLICT", "Sales are closed for this date");
  }
  const nights = Math.round(
    (new Date(`${params.checkoutDate}T00:00:00.000Z`).getTime() -
      new Date(`${params.checkInDate}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );
  if (
    params.stayDate === params.checkInDate &&
    (winner.closedToArrival || nights < winner.minimumStay)
  ) {
    throw new AppError("CONFLICT", "Arrival or minimum-stay rule is not met");
  }
  if (
    params.stayDate ===
      new Date(
        new Date(`${params.checkoutDate}T00:00:00.000Z`).getTime() - 86_400_000,
      )
        .toISOString()
        .slice(0, 10) &&
    winner.closedToDeparture
  ) {
    throw new AppError("CONFLICT", "Departure is closed for this rate");
  }
  if (winner.maximumStay && nights > winner.maximumStay) {
    throw new AppError("CONFLICT", "Maximum-stay rule is exceeded");
  }

  let tax:
    | {
        id: string;
        versionNumber: number;
        taxRate: string;
        serviceChargeRate: string;
        taxInclusive: boolean;
        serviceChargeInclusive: boolean;
        noTax: boolean;
      }
    | undefined;
  if (version.taxProfileId) {
    const taxRows = await db
      .select({
        id: taxProfileVersions.id,
        versionNumber: taxProfileVersions.versionNumber,
        lifecycleStatus: taxProfileVersions.lifecycleStatus,
        approvalStatus: taxProfileVersions.approvalStatus,
        taxRate: taxProfileVersions.taxRate,
        serviceChargeRate: taxProfileVersions.serviceChargeRate,
        taxInclusive: taxProfileVersions.taxInclusive,
        serviceChargeInclusive: taxProfileVersions.serviceChargeInclusive,
        noTax: taxProfileVersions.noTax,
        effectiveFrom: taxProfileVersions.effectiveFrom,
        effectiveTo: taxProfileVersions.effectiveTo,
      })
      .from(taxProfiles)
      .innerJoin(
        taxProfileVersions,
        eq(taxProfileVersions.taxProfileId, taxProfiles.id),
      )
      .where(eq(taxProfiles.id, version.taxProfileId))
      .orderBy(desc(taxProfileVersions.effectiveFrom));
    tax = taxRows.find((candidate) => effectiveAt(candidate, params.at));
    if (!tax) throw new AppError("NOT_FOUND", "No active tax profile version");
  }
  const roomRateIdr = Number(override?.nightlyRateIdr ?? winner.nightlyRateIdr);
  const amounts = calculateNightAmounts({
    roomRateIdr,
    taxRate: Number(tax?.taxRate ?? 0),
    serviceChargeRate: Number(tax?.serviceChargeRate ?? 0),
    taxInclusive: tax?.taxInclusive ?? false,
    serviceChargeInclusive: tax?.serviceChargeInclusive ?? false,
    noTax: tax?.noTax ?? true,
  });
  return {
    ...amounts,
    ratePlanId: version.ratePlanId,
    ratePlanVersionId: version.ratePlanVersionId,
    ratePlanVersionNumber: version.ratePlanVersionNumber,
    paymentInstructionSetId: version.paymentInstructionSetId,
    cancellationPolicySetId: version.cancellationPolicySetId,
    rateRuleId: winner.id,
    rateRuleType: override ? "SPECIAL_DATE" : winner.ruleType,
    taxProfileVersionId: tax?.id ?? null,
    taxSnapshot: {
      versionId: tax?.id ?? null,
      versionNumber: tax?.versionNumber ?? null,
      taxRate: tax?.taxRate ?? "0",
      serviceChargeRate: tax?.serviceChargeRate ?? "0",
      taxInclusive: tax?.taxInclusive ?? false,
      serviceChargeInclusive: tax?.serviceChargeInclusive ?? false,
      noTax: tax?.noTax ?? true,
    },
  };
}

export async function resolveDisplayEstimate(
  db: PricingDb,
  propertyId: string,
  displayCurrency: DisplayCurrency,
  totalIdr: number,
  at: Date,
) {
  if (displayCurrency === "IDR") {
    return {
      exchangeRateSnapshotId: null,
      exchangeRate: null,
      displayTotal: totalIdr,
    };
  }
  const [snapshot] = await db
    .select()
    .from(exchangeRateSnapshots)
    .where(
      and(
        eq(exchangeRateSnapshots.propertyId, propertyId),
        eq(exchangeRateSnapshots.quoteCurrency, displayCurrency),
        lte(exchangeRateSnapshots.asOfAt, at),
        gte(exchangeRateSnapshots.expiresAt, at),
      ),
    )
    .orderBy(desc(exchangeRateSnapshots.asOfAt))
    .limit(1);
  if (!snapshot) {
    throw new AppError(
      "CONFLICT",
      "Display exchange rate is unavailable or stale",
    );
  }
  return {
    exchangeRateSnapshotId: snapshot.id,
    exchangeRate: snapshot.rate,
    displayTotal: Number((totalIdr * Number(snapshot.rate)).toFixed(2)),
  };
}
