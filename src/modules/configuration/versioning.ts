export const VERSION_LIFECYCLES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "RETIRED",
] as const;

export const APPROVAL_STATUSES = [
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type VersionLifecycle = (typeof VERSION_LIFECYCLES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface EffectiveVersion {
  lifecycleStatus: string;
  approvalStatus?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export function assertEffectivePeriod(
  effectiveFrom: Date,
  effectiveTo?: Date | null,
): void {
  if (
    Number.isNaN(effectiveFrom.getTime()) ||
    (effectiveTo && Number.isNaN(effectiveTo.getTime()))
  ) {
    throw new Error("Effective dates must be valid timestamps");
  }
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new Error("effectiveTo must be later than effectiveFrom");
  }
}

export function lifecycleForPublish(
  effectiveFrom: Date,
  now: Date = new Date(),
): "SCHEDULED" | "ACTIVE" {
  return effectiveFrom > now ? "SCHEDULED" : "ACTIVE";
}

export function isApprovedForPublish(status?: string | null): boolean {
  return status === "NOT_REQUIRED" || status === "APPROVED";
}

/**
 * Resolved-value reads intentionally treat an elapsed SCHEDULED version as
 * effective. This makes scheduled configuration correct even if the worker
 * that normalizes its display lifecycle to ACTIVE is temporarily delayed.
 */
export function isEffectiveAt(
  version: EffectiveVersion,
  at: Date = new Date(),
): boolean {
  return (
    (version.lifecycleStatus === "ACTIVE" ||
      version.lifecycleStatus === "SCHEDULED") &&
    isApprovedForPublish(version.approvalStatus ?? "NOT_REQUIRED") &&
    version.effectiveFrom <= at &&
    (!version.effectiveTo || version.effectiveTo > at)
  );
}

export function normalizeMasterCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/gu, "_");
  if (!normalized || normalized.length > 80) {
    throw new Error("Master code must contain 1-80 letters, numbers, _ or -");
  }
  return normalized;
}

export function nextVersionNumber(rows: { versionNumber: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.versionNumber), 0) + 1;
}

export function requirePublishable(input: {
  lifecycleStatus: string;
  approvalStatus?: string | null;
}): void {
  if (input.lifecycleStatus !== "DRAFT") {
    throw new Error("Only a DRAFT version can be published");
  }
  if (!isApprovedForPublish(input.approvalStatus ?? "NOT_REQUIRED")) {
    throw new Error("Version requires approval before it can be published");
  }
}
