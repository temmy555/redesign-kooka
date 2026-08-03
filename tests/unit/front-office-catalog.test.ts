import { beforeEach, describe, expect, it, vi } from "vitest";

function selection(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(promise);
  return chain;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ select: mocks.select }),
}));
vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));

import { getFrontOfficeCatalog } from "../../src/modules/operations/front-office-catalog";

const U1 = "11111111-1111-4111-a111-111111111111";

describe("Front Office operational catalogue", () => {
  beforeEach(() => {
    mocks.select.mockReset();
    mocks.requirePermission.mockReset().mockResolvedValue(undefined);
  });

  it("returns active booking products and physical rooms without Admin permission", async () => {
    mocks.select
      .mockImplementationOnce(() =>
        selection([
          {
            masterId: "type-1",
            roomTypeId: "type-1",
            code: "DELUXE",
            nameId: "Deluxe",
            lifecycleStatus: "ACTIVE",
            approvalStatus: "APPROVED",
          },
          {
            masterId: "type-1",
            roomTypeId: "type-1",
            code: "DELUXE",
            nameId: "Versi lama",
            lifecycleStatus: "ACTIVE",
            approvalStatus: "APPROVED",
          },
          {
            masterId: "type-2",
            roomTypeId: "type-2",
            code: "FAMILY",
            nameId: "Keluarga",
            lifecycleStatus: "ACTIVE",
            approvalStatus: "NOT_REQUIRED",
          },
        ]),
      )
      .mockImplementationOnce(() =>
        selection([{ id: "room-1", roomNumber: "1", status: "ACTIVE" }]),
      )
      .mockImplementationOnce(() =>
        selection([
          {
            masterId: "rate-1",
            ratePlanId: "rate-1",
            code: "BAR",
            nameId: "Harga Harian",
            lifecycleStatus: "ACTIVE",
          },
        ]),
      )
      .mockImplementationOnce(() =>
        selection([{ roomUnitId: "room-1", stayDate: "2026-08-03" }]),
      );

    const result = await getFrontOfficeCatalog({
      session: { user: { id: U1 } },
      propertyId: U1,
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      expect.anything(),
      U1,
      "booking.manage",
    );
    expect(result.roomTypes).toHaveLength(2);
    expect(result.roomTypes[0]).not.toHaveProperty("masterId");
    expect(result.roomTypes.map((roomType) => roomType.code)).toEqual([
      "DELUXE",
      "FAMILY",
    ]);
    expect(result.roomUnits).toEqual([
      {
        id: "room-1",
        roomNumber: "1",
        status: "ACTIVE",
        unavailableDates: ["2026-08-03"],
      },
    ]);
    expect(result.ratePlans).toHaveLength(1);
  });
});
