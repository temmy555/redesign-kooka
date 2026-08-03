import { describe, expect, it } from "vitest";

import { planStoredFileRetentionDryRun } from "../../src/platform/retention";

describe("stored-file retention dry run", () => {
  it("fails closed without policy and blocks active holds", () => {
    const result = planStoredFileRetentionDryRun({
      now: new Date("2026-08-02T00:00:00Z"),
      files: [
        {
          id: "no-policy",
          retentionCategory: "UNKNOWN",
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
        {
          id: "held",
          retentionCategory: "IDENTITY",
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ],
      rules: [
        { category: "IDENTITY", retainForDays: 30, policyVersionId: "p-1" },
      ],
      protectedFileIds: ["held"],
    });
    expect(result.map((item) => item.decision)).toEqual([
      "NO_POLICY",
      "BLOCKED",
    ]);
  });

  it("distinguishes eligible, not-yet-due, and purged tombstones", () => {
    const result = planStoredFileRetentionDryRun({
      now: new Date("2026-08-02T00:00:00Z"),
      files: [
        {
          id: "eligible",
          retentionCategory: "PAYMENT",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: "future",
          retentionCategory: "PAYMENT",
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
        {
          id: "purged",
          retentionCategory: "PAYMENT",
          createdAt: new Date("2025-01-01T00:00:00Z"),
          purgedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      rules: [
        { category: "PAYMENT", retainForDays: 30, policyVersionId: "p-2" },
      ],
    });
    expect(result.map((item) => item.decision)).toEqual([
      "ELIGIBLE",
      "KEEP",
      "KEEP",
    ]);
  });
});
