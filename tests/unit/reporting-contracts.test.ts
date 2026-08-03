import { describe, expect, it } from "vitest";

import {
  maskNameForExport,
  serializeCsv,
  statusForReconciliationAction,
  validateDateRange,
} from "../../src/modules/reporting/contracts";

describe("Batch 6 reporting contracts", () => {
  it("validates inclusive ranges and rejects malformed, reversed, or excessive ranges", () => {
    expect(validateDateRange("2026-08-01", "2026-08-31", 31)).toBe(31);
    expect(() => validateDateRange("01-08-2026", "2026-08-02", 31)).toThrow(
      "YYYY-MM-DD",
    );
    expect(() => validateDateRange("2026-08-02", "2026-08-01", 31)).toThrow(
      "Invalid",
    );
    expect(() => validateDateRange("2026-08-01", "2026-09-01", 31)).toThrow(
      "cannot exceed",
    );
  });

  it("masks guest names without exposing contact or identity data", () => {
    expect(maskNameForExport(" Budi Santoso ")).toBe("B*** S***");
    expect(maskNameForExport(null)).toBe("");
    expect(maskNameForExport("   ")).toBe("");
  });

  it("serializes safe CSV including quote escaping and formula hardening", () => {
    const csv = serializeCsv([
      { name: 'Budi, "Guest"', value: "=1+1", note: "line\nbreak" },
      { name: null, value: -10, note: undefined },
    ]);
    expect(csv.startsWith("\uFEFFname,value,note")).toBe(true);
    expect(csv).toContain('"Budi, ""Guest"""');
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'-10");
    expect(serializeCsv([], ["one", "two"])).toContain("one,two");
  });

  it.each([
    ["ACKNOWLEDGE", "ACKNOWLEDGED"],
    ["INVESTIGATE", "INVESTIGATING"],
    ["RESOLVE", "RESOLVED"],
    ["ACCEPT_WITH_REASON", "ACCEPTED_WITH_REASON"],
  ] as const)("maps %s to %s", (action, expected) => {
    expect(statusForReconciliationAction(action)).toBe(expected);
  });
});
