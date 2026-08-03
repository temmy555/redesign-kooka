import { describe, expect, it } from "vitest";

import {
  assertCleaningTransition,
  assertStayTransition,
  calculateLedgerBalance,
  jakartaBusinessTimestamp,
  maskGuestName,
} from "../../src/modules/operations/contracts";

describe("Batch 3 operational contracts", () => {
  it("allows normal stay progression and rejects reopening checkout", () => {
    expect(() => assertStayTransition("DUE_IN", "IN_HOUSE")).not.toThrow();
    expect(() => assertStayTransition("CHECKED_OUT", "IN_HOUSE")).toThrow();
  });

  it("requires cleaning inspection to follow cleaning", () => {
    expect(() =>
      assertCleaningTransition("CLEANED", "INSPECTED"),
    ).not.toThrow();
    expect(() => assertCleaningTransition("REQUESTED", "INSPECTED")).toThrow();
  });

  it("calculates one master folio as debit minus credit", () => {
    expect(
      calculateLedgerBalance([
        { entryType: "DEBIT", totalAmountIdr: "750000" },
        { entryType: "CREDIT", totalAmountIdr: "250000" },
        { entryType: "DEBIT", totalAmountIdr: "50000" },
      ]),
    ).toBe(550000);
  });

  it("uses Jakarta time for default operational timestamps", () => {
    expect(jakartaBusinessTimestamp("2026-08-02", "14:00").toISOString()).toBe(
      "2026-08-02T07:00:00.000Z",
    );
  });

  it("masks every part of a guest name on shared displays", () => {
    expect(maskGuestName("Budi Santoso")).toBe("B*** S***");
    expect(maskGuestName(null)).toBeNull();
  });
});
