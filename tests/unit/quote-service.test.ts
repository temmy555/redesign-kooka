import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
    values: () => link,
    returning: () => link,
    onConflictDoUpdate: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  requirePermission: vi.fn(),
  withIdempotency: vi.fn(),
  enqueueOutboxEvent: vi.fn(),
  ensureInventoryDays: vi.fn(),
  readInventoryAvailability: vi.fn(),
  assertInventoryAvailable: vi.fn(),
  resolveNightPrice: vi.fn(),
  resolveDisplayEstimate: vi.fn(),
}));

vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));
vi.mock("../../src/platform/outbox", () => ({
  enqueueOutboxEvent: mocks.enqueueOutboxEvent,
}));
vi.mock("../../src/modules/booking/availability", () => ({
  ensureInventoryDays: mocks.ensureInventoryDays,
  readInventoryAvailability: mocks.readInventoryAvailability,
  assertInventoryAvailable: mocks.assertInventoryAvailable,
}));
vi.mock("../../src/modules/booking/pricing", () => ({
  resolveNightPrice: mocks.resolveNightPrice,
  resolveDisplayEstimate: mocks.resolveDisplayEstimate,
}));

import { createBookingQuote } from "../../src/modules/booking/quote-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const session = { user: { id: U1 } };

const room = {
  roomTypeId: U2,
  adults: 2,
  children: 0,
  infants: 0,
  extraBedQuantity: 0,
};

const input = {
  checkInDate: "2026-08-03",
  checkoutDate: "2026-08-04",
  ratePlanCode: "BAR",
  language: "id" as const,
  displayCurrency: "USD" as const,
  rooms: [room],
};

describe("booking quote service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.enqueueOutboxEvent.mockResolvedValue(undefined);
    mocks.ensureInventoryDays.mockResolvedValue(undefined);
    mocks.assertInventoryAvailable.mockReturnValue(undefined);
    mocks.readInventoryAvailability.mockResolvedValue([
      {
        inventoryDayId: U3,
        roomTypeId: U2,
        stayDate: "2026-08-03",
        physicalCapacity: 2,
        claimed: 0,
        available: 2,
        salesClosed: false,
      },
    ]);
    mocks.resolveNightPrice.mockResolvedValue({
      ratePlanVersionId: U4,
      ratePlanVersionNumber: 1,
      rateRuleId: U3,
      rateRuleType: "BASE",
      roomRateIdr: 500000,
      taxIdr: 50000,
      serviceChargeIdr: 0,
      totalIdr: 550000,
      taxSnapshot: { taxRate: 0.1 },
    });
    mocks.resolveDisplayEstimate.mockResolvedValue({
      exchangeRateSnapshotId: U4,
      displayTotal: 34.38,
    });
    mocks.insert.mockReturnValue(chain());
    mocks.withIdempotency.mockImplementation(
      async (_options: unknown, run: (tx: unknown) => Promise<unknown>) => {
        const result = (await run({
          select: mocks.select,
          insert: mocks.insert,
        })) as { response: unknown };
        return result.response;
      },
    );
  });

  it("creates a priced quote and physical room hold", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          roomTypeId: U2,
          lifecycleStatus: "ACTIVE",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveTo: null,
          maximumAdults: 2,
          maximumChildren: 1,
          maximumTotalGuests: 3,
          extraBedAllowed: true,
          maximumExtraBeds: 1,
          extraBedCapacityIncrement: 1,
        },
      ]),
    );
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());

    const result = await createBookingQuote({
      propertyId: U1,
      input,
      idempotencyKey: "quote-1",
    });

    expect(result).toMatchObject({
      quoteId: U1,
      totalIdr: 550000,
      displayCurrency: "USD",
      displayTotal: 34.38,
      displayEstimated: true,
    });
    expect(mocks.assertInventoryAvailable).toHaveBeenCalledOnce();
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledOnce();
  });

  it("requires a staff session for a manual quote", async () => {
    await expect(
      createBookingQuote({
        propertyId: U1,
        input,
        source: "ADMIN_MANUAL",
        idempotencyKey: "manual-without-session",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("authorizes a valid manual quote before transaction processing", async () => {
    mocks.select.mockReturnValueOnce(chain([]));
    await expect(
      createBookingQuote({
        propertyId: U1,
        input,
        source: "ADMIN_MANUAL",
        session,
        idempotencyKey: "manual-quote",
      }),
    ).rejects.toThrow("Room type is unavailable");
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      session,
      U1,
      "booking.manage",
    );
  });

  it("rejects invalid room and guest counts before writing", async () => {
    await expect(
      createBookingQuote({
        propertyId: U1,
        input: { ...input, rooms: [] },
        idempotencyKey: "no-rooms",
      }),
    ).rejects.toThrow("Invalid room count");
    await expect(
      createBookingQuote({
        propertyId: U1,
        input: { ...input, rooms: [{ ...room, adults: 0 }] },
        idempotencyKey: "no-adult",
      }),
    ).rejects.toThrow("Invalid guest or extra-bed count");
  });

  it("enforces the active room-type capacity snapshot", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          roomTypeId: U2,
          lifecycleStatus: "ACTIVE",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveTo: null,
          maximumAdults: 1,
          maximumChildren: 0,
          maximumTotalGuests: 1,
          extraBedAllowed: false,
          maximumExtraBeds: 0,
          extraBedCapacityIncrement: 0,
        },
      ]),
    );
    await expect(
      createBookingQuote({
        propertyId: U1,
        input,
        idempotencyKey: "over-capacity",
      }),
    ).rejects.toThrow("exceeds room capacity");
  });

  it("prices and holds an inventory-tracked extra bed", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            roomTypeId: U2,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
            maximumAdults: 2,
            maximumChildren: 1,
            maximumTotalGuests: 3,
            extraBedAllowed: true,
            maximumExtraBeds: 1,
            extraBedCapacityIncrement: 1,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U4,
            inventoryTracked: true,
            physicalCapacity: 5,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
            values: {
              nightlyRateIdr: 100000,
              taxRate: 0.1,
              serviceChargeRate: 0,
              taxInclusive: false,
              serviceChargeInclusive: false,
              noTax: false,
            },
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U4,
            resourcePoolId: U4,
            stayDate: "2026-08-03",
            physicalCapacity: 5,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());

    const result = await createBookingQuote({
      propertyId: U1,
      input: {
        ...input,
        displayCurrency: "IDR",
        rooms: [{ ...room, adults: 3, extraBedQuantity: 1 }],
      },
      idempotencyKey: "quote-extra-bed",
    });
    expect(result.totalIdr).toBe(660000);
    expect(mocks.insert).toHaveBeenCalledTimes(7);
  });
});
