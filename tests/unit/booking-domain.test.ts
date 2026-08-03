import { describe, expect, it } from "vitest";

import {
  calculateNightAmounts,
  calculateRequiredPayment,
  enumerateStayDates,
  normalizeEmail,
  stableRequestHash,
} from "../../src/modules/booking/domain";

describe("booking domain rules", () => {
  it("uses checkout-exclusive stay dates for same-day turnover", () => {
    expect(enumerateStayDates("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
    ]);
  });

  it("requires 100% for online but allows admin deposit configuration", () => {
    expect(
      calculateRequiredPayment("ONLINE", 1_000_000, "FIXED_DEPOSIT", 1),
    ).toBe(1_000_000);
    expect(
      calculateRequiredPayment(
        "ADMIN_MANUAL",
        1_000_000,
        "PERCENTAGE_DEPOSIT",
        30,
      ),
    ).toBe(300_000);
  });

  it("keeps official IDR tax and service components as whole rupiah", () => {
    expect(
      calculateNightAmounts({
        roomRateIdr: 500_000,
        taxRate: 0.11,
        serviceChargeRate: 0.05,
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax: false,
      }),
    ).toEqual({
      roomRateIdr: 500_000,
      netAmountIdr: 500_000,
      serviceChargeIdr: 25_000,
      taxIdr: 57_750,
      totalIdr: 582_750,
    });
  });

  it("normalizes lookup email and hashes equivalent request objects identically", () => {
    expect(normalizeEmail(" Guest@Example.COM ")).toBe("guest@example.com");
    expect(stableRequestHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableRequestHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});
