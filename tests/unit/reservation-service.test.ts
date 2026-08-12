import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
    set: () => link,
    values: () => link,
    returning: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  decryptSensitiveValue: vi.fn(),
  enqueueOutboxEvent: vi.fn(),
  withIdempotency: vi.fn(),
  ensureInventoryDays: vi.fn(),
  readInventoryAvailability: vi.fn(),
  assertInventoryAvailable: vi.fn(),
}));

vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/encryption", () => ({
  decryptSensitiveValue: mocks.decryptSensitiveValue,
}));
vi.mock("../../src/platform/outbox", () => ({
  enqueueOutboxEvent: mocks.enqueueOutboxEvent,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));
vi.mock("../../src/modules/booking/availability", () => ({
  ensureInventoryDays: mocks.ensureInventoryDays,
  readInventoryAvailability: mocks.readInventoryAvailability,
  assertInventoryAvailable: mocks.assertInventoryAvailable,
}));

import {
  cancelReservation,
  createReservation,
} from "../../src/modules/booking/reservation-service";
import { folios, folioStatusEvents } from "../../src/db/schema";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const session = { user: { id: U1 } };

const onlineInput = {
  quoteId: U2,
  source: "ONLINE" as const,
  booker: {
    name: "Budi Santoso",
    email: "Budi@example.com",
    phone: "+62 812",
  },
  paymentMode: "FULL" as const,
  acknowledgedPolicyVersionIds: [],
};

describe("reservation conversion and cancellation", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.decryptSensitiveValue.mockReturnValue("123456789012");
    mocks.enqueueOutboxEvent.mockResolvedValue(undefined);
    mocks.ensureInventoryDays.mockResolvedValue(undefined);
    mocks.readInventoryAvailability.mockResolvedValue([
      {
        inventoryDayId: U4,
        roomTypeId: U4,
        stayDate: "2099-08-03",
        physicalCapacity: 2,
        claimed: 0,
        available: 2,
        salesClosed: false,
      },
    ]);
    mocks.assertInventoryAvailable.mockReturnValue(undefined);
    mocks.insert.mockReturnValue(chain());
    mocks.update.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.withIdempotency.mockImplementation(
      async (_options: unknown, run: (tx: unknown) => Promise<unknown>) => {
        const result = (await run({
          select: mocks.select,
          insert: mocks.insert,
          update: mocks.update,
          execute: mocks.execute,
        })) as { response: unknown };
        return result.response;
      },
    );
  });

  it("converts an online quote into an on-hold reservation without extra customer emails", async () => {
    const quoteRoom = {
      id: U3,
      quoteId: U2,
      roomTypeId: U4,
      ratePlanVersionId: U1,
      checkInDate: "2099-08-03",
      checkoutDate: "2099-08-04",
      adults: 2,
      children: 0,
      infants: 0,
      extraBedQuantity: 0,
    };
    const quoteNight = {
      id: U4,
      quoteRoomId: U3,
      stayDate: "2099-08-03",
      roomRateIdr: "500000",
      discountIdr: "0",
      taxIdr: "50000",
      serviceChargeIdr: "0",
      totalIdr: "550000",
      taxSnapshot: { versionId: U1 },
      priceSnapshot: { rateRuleId: U2 },
    };
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            propertyId: U1,
            status: "ACTIVE",
            expiresAt: new Date("2099-08-03T00:00:00.000Z"),
            totalIdr: "550000",
            language: "id",
            displayCurrency: "IDR",
            exchangeRateSnapshotId: null,
          },
        ]),
      )
      .mockReturnValueOnce(chain([quoteRoom]))
      .mockReturnValueOnce(chain([quoteNight]))
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            paymentInstructionSetId: U2,
            cancellationPolicySetId: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            instructionSetId: U2,
            setCode: "BANK-BCA",
            id: U2,
            versionNumber: 1,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
            effectiveTo: null,
            bankName: "BCA",
            accountHolder: "KOOKA Residence",
            accountNumberCiphertext: "ciphertext",
            accountNumberLast4: "9012",
            instructionId: "Transfer dan kirim bukti.",
            instructionEn: "Transfer and send proof.",
          },
        ]),
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(
        chain([
          {
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
            effectiveTo: null,
            values: {
              onlineDeadlineMinutes: 90,
              sameDayDeadlineMinutes: 45,
            },
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));

    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]));

    const startedAt = Date.now();
    const result = await createReservation({
      propertyId: U1,
      input: onlineInput,
      idempotencyKey: "reservation-online-1",
    });
    const finishedAt = Date.now();

    expect(result).toMatchObject({
      reservationId: U1,
      status: "ON_HOLD",
      totalIdr: 550000,
      requiredPaymentIdr: 550000,
      paymentInstruction: {
        bankName: "BCA",
        accountNumber: "123456789012",
      },
    });
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledOnce();
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "booking.reservation-expire",
        availableAt: new Date(result.paymentDeadlineAt!),
      }),
      expect.anything(),
    );
    expect(
      new Date(result.paymentDeadlineAt!).getTime(),
    ).toBeGreaterThanOrEqual(startedAt + 90 * 60_000);
    expect(new Date(result.paymentDeadlineAt!).getTime()).toBeLessThanOrEqual(
      finishedAt + 90 * 60_000,
    );
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("validates online payment and booker constraints before conversion", async () => {
    await expect(
      createReservation({
        propertyId: U1,
        input: {
          ...onlineInput,
          paymentMode: "PERCENTAGE_DEPOSIT",
          depositValue: 50,
        },
        idempotencyKey: "online-deposit",
      }),
    ).rejects.toThrow("requires full payment");
    await expect(
      createReservation({
        propertyId: U1,
        input: { ...onlineInput, booker: { name: "X", email: "invalid" } },
        idempotencyKey: "invalid-booker",
      }),
    ).rejects.toThrow("Invalid booker details");
  });

  it("creates a manual deposit booking with acknowledged policies and extra bed", async () => {
    const extraBed = {
      resourcePoolId: U4,
      quantity: 1,
      unitPriceIdr: 100000,
      netAmountIdr: 90000,
      serviceChargeIdr: 0,
      taxIdr: 10000,
      totalIdr: 100000,
      settingVersionId: U3,
      taxConfiguration: { taxRate: 0.1 },
    };
    const quoteRoom = {
      id: U3,
      roomTypeId: U4,
      ratePlanVersionId: U1,
      checkInDate: "2099-08-03",
      checkoutDate: "2099-08-04",
      adults: 3,
      children: 0,
      infants: 0,
      extraBedQuantity: 1,
    };
    const quoteNight = {
      id: U4,
      quoteRoomId: U3,
      stayDate: "2099-08-03",
      roomRateIdr: "500000",
      discountIdr: "0",
      taxIdr: "60000",
      serviceChargeIdr: "0",
      totalIdr: "660000",
      taxSnapshot: { versionId: U1 },
      priceSnapshot: { extraBed },
    };
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            status: "ACTIVE",
            expiresAt: new Date("2099-08-03T00:00:00.000Z"),
            totalIdr: "660000",
            language: "en",
            displayCurrency: "AUD",
            exchangeRateSnapshotId: U4,
          },
        ]),
      )
      .mockReturnValueOnce(chain([quoteRoom]))
      .mockReturnValueOnce(chain([quoteNight]))
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            resourcePoolId: U4,
            stayDate: "2099-08-03",
            physicalCapacity: 5,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            paymentInstructionSetId: null,
            cancellationPolicySetId: U2,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U4,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain());

    const result = await createReservation({
      propertyId: U1,
      session,
      input: {
        quoteId: U2,
        source: "ADMIN_MANUAL",
        booker: { name: "Sari Dewi", email: "sari@example.com" },
        paymentMode: "FIXED_DEPOSIT",
        depositValue: 200000,
        internalNotes: "Group lead will arrive first",
        acknowledgedPolicyVersionIds: [U3, U4],
      },
      idempotencyKey: "reservation-manual-extra-bed",
    });
    expect(result).toMatchObject({
      status: "CONFIRMED",
      requiredPaymentIdr: 200000,
      paymentDeadlineAt: null,
      paymentInstruction: null,
    });
  });

  it("rejects expired quotes, empty quotes, and incomplete checkout holds", async () => {
    mocks.select.mockReturnValueOnce(chain([]));
    await expect(
      createReservation({
        propertyId: U1,
        input: onlineInput,
        idempotencyKey: "missing-quote",
      }),
    ).rejects.toThrow("Quote has expired");

    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            status: "ACTIVE",
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    await expect(
      createReservation({
        propertyId: U1,
        input: onlineInput,
        idempotencyKey: "quote-no-rooms",
      }),
    ).rejects.toThrow("Quote has no rooms");
  });

  it("requires an authenticated authorized staff member for manual booking", async () => {
    await expect(
      createReservation({
        propertyId: U1,
        input: { ...onlineInput, source: "ADMIN_MANUAL" },
        idempotencyKey: "manual-no-session",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("cancels an eligible reservation and releases room/resource claims", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U2,
          propertyId: U1,
          status: "CONFIRMED",
          language: "en",
          bookingCode: "KR-260802-ABCDEFGH",
          bookerEmailNormalized: "guest@example.com",
        },
      ]),
    );
    mocks.update
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain());
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U4 }]));

    const result = await cancelReservation({
      propertyId: U1,
      reservationId: U2,
      reason: "Guest requested cancellation",
      session,
      idempotencyKey: "cancel-1",
    });
    expect(result).toEqual({ reservationId: U2, status: "CANCELLED" });
    expect(mocks.execute).toHaveBeenCalledTimes(3);
    expect(mocks.update).toHaveBeenCalledWith(folios);
    expect(mocks.insert).toHaveBeenCalledWith(folioStatusEvents);
  });

  it("rejects cancellation after a guest has checked in", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U2,
          propertyId: U1,
          status: "CONFIRMED",
          language: "id",
          bookingCode: "KR-260802-ABCDEFGH",
          bookerEmailNormalized: "guest@example.com",
        },
      ]),
    );
    mocks.execute.mockResolvedValueOnce({ rows: [{ id: U3 }] });

    await expect(
      cancelReservation({
        propertyId: U1,
        reservationId: U2,
        reason: "Wrong cancellation attempt",
        session,
        idempotencyKey: "cancel-in-house",
      }),
    ).rejects.toThrow("use checkout");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires a cancellation reason", async () => {
    await expect(
      cancelReservation({
        propertyId: U1,
        reservationId: U2,
        reason: "x",
        session,
        idempotencyKey: "cancel-short",
      }),
    ).rejects.toThrow("cancellation reason");
  });
});
