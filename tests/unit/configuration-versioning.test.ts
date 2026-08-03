import { describe, expect, it } from "vitest";

import {
  assertEffectivePeriod,
  isEffectiveAt,
  lifecycleForPublish,
  nextVersionNumber,
  normalizeMasterCode,
  requirePublishable,
} from "../../src/modules/configuration/versioning";

describe("configuration versioning rules", () => {
  const now = new Date("2026-08-02T05:00:00.000Z");

  it("publishes immediate versions as ACTIVE and future versions as SCHEDULED", () => {
    expect(lifecycleForPublish(new Date("2026-08-02T04:00:00Z"), now)).toBe(
      "ACTIVE",
    );
    expect(lifecycleForPublish(new Date("2026-08-03T04:00:00Z"), now)).toBe(
      "SCHEDULED",
    );
  });

  it("resolves an elapsed scheduled version even before lifecycle normalization", () => {
    expect(
      isEffectiveAt(
        {
          lifecycleStatus: "SCHEDULED",
          approvalStatus: "APPROVED",
          effectiveFrom: new Date("2026-08-02T04:00:00Z"),
          effectiveTo: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects publishing a pending or non-draft version", () => {
    expect(() =>
      requirePublishable({
        lifecycleStatus: "DRAFT",
        approvalStatus: "PENDING",
      }),
    ).toThrow(/requires approval/u);
    expect(() =>
      requirePublishable({
        lifecycleStatus: "ACTIVE",
        approvalStatus: "APPROVED",
      }),
    ).toThrow(/Only a DRAFT/u);
  });

  it("guards invalid periods and provides deterministic codes/version numbers", () => {
    expect(() => assertEffectivePeriod(now, now)).toThrow(/later/u);
    expect(normalizeMasterCode("standard room only")).toBe(
      "STANDARD_ROOM_ONLY",
    );
    expect(
      nextVersionNumber([{ versionNumber: 3 }, { versionNumber: 1 }]),
    ).toBe(4);
  });

  it("covers invalid timestamps, inactive versions, and default approval", () => {
    expect(() => assertEffectivePeriod(new Date("invalid"))).toThrow(
      /valid timestamps/u,
    );
    expect(() => assertEffectivePeriod(now, new Date("invalid"))).toThrow(
      /valid timestamps/u,
    );
    expect(
      isEffectiveAt(
        {
          lifecycleStatus: "RETIRED",
          approvalStatus: "APPROVED",
          effectiveFrom: new Date("2026-01-01"),
          effectiveTo: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isEffectiveAt(
        {
          lifecycleStatus: "ACTIVE",
          effectiveFrom: new Date("2026-01-01"),
          effectiveTo: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isEffectiveAt(
        {
          lifecycleStatus: "ACTIVE",
          approvalStatus: "REJECTED",
          effectiveFrom: new Date("2026-01-01"),
          effectiveTo: null,
        },
        now,
      ),
    ).toBe(false);
    expect(() => normalizeMasterCode("   ")).toThrow(/Master code/u);
    expect(() =>
      requirePublishable({ lifecycleStatus: "DRAFT" }),
    ).not.toThrow();
  });
});
