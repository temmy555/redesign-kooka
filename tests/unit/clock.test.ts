import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUSINESS_DATE_ROLLOVER_HOUR,
  PROPERTY_TIMEZONE,
  getBusinessDate,
  nowUtc,
  toJakartaDateString,
  toJakartaTimeString,
} from "../../src/platform/clock";

describe("clock / business-date service", () => {
  it("uses Asia/Jakarta as the property timezone with a 04:00 default rollover", () => {
    expect(PROPERTY_TIMEZONE).toBe("Asia/Jakarta");
    expect(DEFAULT_BUSINESS_DATE_ROLLOVER_HOUR).toBe(4);
  });

  it("keeps the calendar date once Jakarta local time is past the rollover hour", () => {
    // 2026-08-02T00:30:00Z = 2026-08-02 07:30 in Asia/Jakarta (UTC+7).
    const instant = new Date("2026-08-02T00:30:00.000Z");
    expect(getBusinessDate(instant)).toBe("2026-08-02");
  });

  it("rolls the business date back a day before the rollover hour", () => {
    // 2026-08-01T20:30:00Z = 2026-08-02 03:30 in Asia/Jakarta -- before 04:00.
    const instant = new Date("2026-08-01T20:30:00.000Z");
    expect(getBusinessDate(instant)).toBe("2026-08-01");
  });

  it("respects a configured, non-default rollover hour", () => {
    // 2026-08-02 03:30 Jakarta local: before a 04:00 rollover but after a
    // 02:00 rollover.
    const instant = new Date("2026-08-01T20:30:00.000Z");
    expect(getBusinessDate(instant, 2)).toBe("2026-08-02");
  });

  it("rejects an out-of-range rollover hour", () => {
    expect(() => getBusinessDate(new Date(), 24)).toThrow(/rolloverHour/u);
    expect(() => getBusinessDate(new Date(), -1)).toThrow(/rolloverHour/u);
    expect(() => getBusinessDate(new Date(), 1.5)).toThrow(/rolloverHour/u);
  });

  it("formats the Jakarta calendar date as YYYY-MM-DD", () => {
    expect(toJakartaDateString(new Date("2026-08-02T00:30:00.000Z"))).toBe(
      "2026-08-02",
    );
    expect(toJakartaDateString(new Date("2026-08-03T19:30:00.000Z"))).toBe(
      "2026-08-04",
    );
  });

  it("formats the Jakarta time as HH:MM:SS", () => {
    expect(toJakartaTimeString(new Date("2026-08-02T00:30:00.000Z"))).toBe(
      "07:30:00",
    );
  });

  it("nowUtc returns the current instant as a real Date", () => {
    const before = Date.now();
    const result = nowUtc();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
  });
});
