import { describe, expect, it } from "vitest";

import { calculateDistanceMeters } from "../../src/modules/attendance/location-service";

describe("attendance location distance", () => {
  it("returns zero for the same coordinate", () => {
    expect(calculateDistanceMeters(-7.285, 112.68, -7.285, 112.68)).toBe(0);
  });

  it("calculates a predictable nearby distance in meters", () => {
    const distance = calculateDistanceMeters(-7.285, 112.68, -7.28455, 112.68);
    expect(distance).toBeGreaterThan(49);
    expect(distance).toBeLessThan(51);
  });
});
