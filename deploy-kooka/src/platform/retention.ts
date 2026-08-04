export interface RetentionFileSnapshot {
  id: string;
  retentionCategory: string;
  createdAt: Date;
  purgedAt?: Date | null;
}

export interface RetentionRuleSnapshot {
  category: string;
  retainForDays: number;
  policyVersionId: string;
}

export interface RetentionDryRunResult {
  fileId: string;
  category: string;
  policyVersionId: string | null;
  decision: "ELIGIBLE" | "KEEP" | "BLOCKED" | "NO_POLICY";
  reason: string;
  eligibleAt: string | null;
}

/**
 * Pure, non-destructive retention planner. It deliberately requires effective
 * policy snapshots and explicit hold/reference IDs from the caller; no default
 * retention period is invented. Deletion remains a separate authorized action.
 */
export function planStoredFileRetentionDryRun(input: {
  files: RetentionFileSnapshot[];
  rules: RetentionRuleSnapshot[];
  protectedFileIds?: Iterable<string>;
  now?: Date;
}): RetentionDryRunResult[] {
  const now = input.now ?? new Date();
  const protectedIds = new Set(input.protectedFileIds ?? []);
  const rules = new Map(input.rules.map((rule) => [rule.category, rule]));

  return input.files.map((file) => {
    if (file.purgedAt) {
      return {
        fileId: file.id,
        category: file.retentionCategory,
        policyVersionId: null,
        decision: "KEEP" as const,
        reason: "Already purged; tombstone metadata is retained",
        eligibleAt: null,
      };
    }
    const rule = rules.get(file.retentionCategory);
    if (!rule) {
      return {
        fileId: file.id,
        category: file.retentionCategory,
        policyVersionId: null,
        decision: "NO_POLICY" as const,
        reason: "No effective retention policy; fail closed",
        eligibleAt: null,
      };
    }
    const eligibleAt = new Date(
      file.createdAt.getTime() + rule.retainForDays * 86_400_000,
    );
    if (protectedIds.has(file.id)) {
      return {
        fileId: file.id,
        category: file.retentionCategory,
        policyVersionId: rule.policyVersionId,
        decision: "BLOCKED" as const,
        reason: "Active hold or required reference blocks purge",
        eligibleAt: eligibleAt.toISOString(),
      };
    }
    const eligible = eligibleAt <= now;
    return {
      fileId: file.id,
      category: file.retentionCategory,
      policyVersionId: rule.policyVersionId,
      decision: eligible ? ("ELIGIBLE" as const) : ("KEEP" as const),
      reason: eligible
        ? "Retention threshold passed; approval and reference recheck still required"
        : "Retention threshold has not passed",
      eligibleAt: eligibleAt.toISOString(),
    };
  });
}
