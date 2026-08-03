import { beforeEach, describe, expect, it, vi } from "vitest";

function selectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("../../src/db", () => ({ getDatabase: () => ({ select }) }));

import { getActivePropertyId } from "../../src/platform/property";

describe("getActivePropertyId", () => {
  beforeEach(() => {
    select.mockReset();
  });

  it("returns the single active property id", async () => {
    select.mockImplementationOnce(() => selectChain([{ id: "property-1" }]));

    await expect(getActivePropertyId()).resolves.toBe("property-1");
  });

  it("throws when no property is active", async () => {
    select.mockImplementationOnce(() => selectChain([]));

    await expect(getActivePropertyId()).rejects.toThrow(/No active property/u);
  });

  it("throws rather than guessing when more than one property is active", async () => {
    select.mockImplementationOnce(() =>
      selectChain([{ id: "property-1" }, { id: "property-2" }]),
    );

    await expect(getActivePropertyId()).rejects.toThrow(
      /Multiple active properties/u,
    );
  });
});
