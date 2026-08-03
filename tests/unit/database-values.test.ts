import { describe, expect, it } from "vitest";

import {
  databaseDate,
  databaseTimestampIso,
} from "../../src/platform/database-values";

describe("raw database value normalization", () => {
  it("normalizes Date and PostgreSQL timestamp strings", () => {
    const instant = "2026-08-03T08:15:00.000Z";

    expect(databaseDate(new Date(instant))?.toISOString()).toBe(instant);
    expect(databaseDate(instant)?.toISOString()).toBe(instant);
    expect(databaseTimestampIso(instant)).toBe(instant);
  });

  it("returns null for absent and invalid timestamps", () => {
    expect(databaseDate(null)).toBeNull();
    expect(databaseDate("not-a-timestamp")).toBeNull();
    expect(databaseTimestampIso(undefined)).toBeNull();
  });
});
