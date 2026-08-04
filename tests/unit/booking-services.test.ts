import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    leftJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
    values: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  recordAuditEvent: vi.fn(),
  decryptSensitiveValue: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({
    select: mocks.select,
    insert: mocks.insert,
    execute: mocks.execute,
    transaction: mocks.transaction,
  }),
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/encryption", () => ({
  decryptSensitiveValue: mocks.decryptSensitiveValue,
}));

import {
  assertInventoryAvailable,
  ensureInventoryDays,
  readInventoryAvailability,
  searchAvailability,
  validateSearchRequest,
} from "../../src/modules/booking/availability";
import {
  createCustomerLookupSession,
  getCustomerBooking,
} from "../../src/modules/booking/customer-lookup";
import {
  resolveDisplayEstimate,
  resolveNightPrice,
} from "../../src/modules/booking/pricing";
import { getPublicCheckoutPolicies } from "../../src/modules/booking/public-checkout";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";

describe("booking availability, pricing, and customer lookup", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.insert.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [{ count: "0" }] });
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.decryptSensitiveValue.mockReturnValue("1234567890");
    mocks.transaction.mockImplementation(
      async (run: (tx: unknown) => unknown) => run({ insert: mocks.insert }),
    );
  });

  it("validates guest counts and enumerates stay dates", () => {
    expect(
      validateSearchRequest({
        checkInDate: "2026-08-03",
        checkoutDate: "2026-08-05",
        rooms: 1,
        adults: 2,
        children: 1,
        infants: 0,
      }),
    ).toEqual(["2026-08-03", "2026-08-04"]);
    expect(() =>
      validateSearchRequest({
        checkInDate: "2026-08-03",
        checkoutDate: "2026-08-05",
        rooms: 0,
        adults: 2,
        children: 0,
        infants: 0,
      }),
    ).toThrow("Invalid room or guest count");
  });

  it("materializes and reads physical inventory with active claim totals", async () => {
    const db = { execute: mocks.execute, select: mocks.select } as never;
    await ensureInventoryDays(db, U1, [U2, U3], ["2026-08-03", "2026-08-04"]);
    expect(mocks.execute).toHaveBeenCalledOnce();
    const inventoryQuery = new PgDialect().sqlToQuery(
      mocks.execute.mock.calls[0]![0],
    );
    expect(inventoryQuery.sql).toContain("unnest(array[$1, $2]::uuid[])");
    expect(inventoryQuery.sql).toContain("unnest(array[$3, $4]::date[])");
    expect(inventoryQuery.sql).not.toContain("::text[]");
    expect(inventoryQuery.params.slice(0, 4)).toEqual([
      U2,
      U3,
      "2026-08-03",
      "2026-08-04",
    ]);

    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            inventoryDayId: U1,
            roomTypeId: U2,
            stayDate: "2026-08-03",
            physicalCapacity: 3,
            salesClosed: false,
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ inventoryDayId: U1, quantity: 2 }]));
    const rows = await readInventoryAvailability(db, U1, [U2], ["2026-08-03"], {
      lock: true,
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(rows[0]).toMatchObject({ claimed: 2, available: 1 });
    expect(() =>
      assertInventoryAvailable(rows, new Map([[U2, 2]]), ["2026-08-03"]),
    ).toThrow("no longer available");
    expect(() =>
      assertInventoryAvailable(rows, new Map([[U2, 1]]), ["2026-08-03"]),
    ).not.toThrow();
  });

  it("searches room types and reports minimum nightly availability", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            code: "DELUXE",
            nameId: "Deluxe",
            nameEn: "Deluxe",
            maximumAdults: 2,
            maximumChildren: 1,
            maximumTotalGuests: 3,
            extraBedAllowed: true,
            maximumExtraBeds: 1,
            extraBedCapacityIncrement: 1,
          },
          // Defensive fixture for malformed overlapping historical versions:
          // the public response must still contain one card per room type.
          {
            id: U2,
            code: "DELUXE",
            nameId: "Deluxe",
            nameEn: "Deluxe",
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
            inventoryDayId: U1,
            roomTypeId: U2,
            stayDate: "2026-08-03",
            physicalCapacity: 2,
            salesClosed: false,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(
        chain([
          {
            roomTypeId: U2,
            ratePlanCode: "BAR",
            ratePlanNameId: "Harga fleksibel",
            ratePlanNameEn: "Flexible rate",
            lifecycleStatus: "ACTIVE",
            approvalStatus: "APPROVED",
            sourceEligibility: "ALL",
            paymentInstructionSetId: U3,
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
            ruleId: U1,
            ruleType: "BASE",
            priority: 1,
            startsOn: "2026-01-01",
            endsOn: "2027-12-31",
            weekdaysMask: 127,
            nightlyRateIdr: "500000",
            minimumStay: 1,
            maximumStay: 30,
            closedToArrival: false,
            closedToDeparture: false,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            instructionSetId: U3,
            setCode: "BANK-BCA",
            id: U3,
            versionNumber: 1,
            bankName: "BCA",
            accountHolder: "KOOKA Residence",
            accountNumberCiphertext: "ciphertext",
            accountNumberLast4: "9012",
            instructionId: "Transfer dan kirim bukti.",
            instructionEn: "Transfer and send proof.",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      );
    const result = await searchAvailability(U1, {
      checkInDate: "2026-08-03",
      checkoutDate: "2026-08-04",
      rooms: 1,
      adults: 2,
      children: 0,
      infants: 0,
    });
    expect(result.roomTypes[0]).toMatchObject({
      availableRooms: 2,
      available: true,
      offer: expect.objectContaining({ ratePlanCode: "BAR" }),
    });
    expect(result.roomTypes).toHaveLength(1);
  });

  it("returns the exact active policies required by public checkout", async () => {
    const now = new Date();
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            cancellationPolicySetId: U2,
            paymentInstructionSetId: U3,
            lifecycleStatus: "ACTIVE",
            sourceEligibility: "ALL",
            effectiveFrom: new Date(now.getTime() - 60_000),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            effectiveFrom: new Date(now.getTime() - 60_000),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            policySetId: U2,
            policyType: "CANCELLATION",
            lifecycleStatus: "ACTIVE",
            titleId: "Kebijakan pembatalan",
            titleEn: "Cancellation policy",
            summaryId: "Ringkasan",
            summaryEn: "Summary",
            contentId: "Isi",
            contentEn: "Content",
            effectiveFrom: new Date(now.getTime() - 60_000),
            effectiveTo: null,
          },
          {
            id: U3,
            policySetId: U1,
            policyType: "HOUSE_RULES",
            lifecycleStatus: "ACTIVE",
            titleId: "Peraturan menginap",
            titleEn: "House rules",
            summaryId: null,
            summaryEn: null,
            contentId: "Isi",
            contentEn: "Content",
            effectiveFrom: new Date(now.getTime() - 60_000),
            effectiveTo: null,
          },
        ]),
      );

    await expect(getPublicCheckoutPolicies(U1, "bar")).resolves.toEqual([
      expect.objectContaining({ id: U1, type: "CANCELLATION" }),
      expect.objectContaining({ id: U3, type: "HOUSE_RULES" }),
    ]);
  });

  it("resolves the winning rate rule, tax snapshot, and special-date override", async () => {
    const at = new Date("2026-08-02T00:00:00.000Z");
    const db = { select: mocks.select } as never;
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            ratePlanId: U1,
            ratePlanVersionId: U2,
            ratePlanVersionNumber: 1,
            lifecycleStatus: "ACTIVE",
            approvalStatus: "APPROVED",
            sourceEligibility: "ALL",
            taxProfileId: U3,
            paymentInstructionSetId: null,
            cancellationPolicySetId: null,
            effectiveFrom: new Date("2026-01-01"),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            ruleType: "BASE",
            priority: 1,
            weekdaysMask: 127,
            nightlyRateIdr: "500000",
            minimumStay: 1,
            maximumStay: 10,
            closedToArrival: false,
            closedToDeparture: false,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            rateRuleId: U1,
            stayDate: "2026-08-03",
            nightlyRateIdr: "600000",
            salesClosed: false,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            versionNumber: 1,
            lifecycleStatus: "ACTIVE",
            approvalStatus: "APPROVED",
            taxRate: "0.10",
            serviceChargeRate: "0",
            taxInclusive: false,
            serviceChargeInclusive: false,
            noTax: false,
            effectiveFrom: new Date("2026-01-01"),
            effectiveTo: null,
          },
        ]),
      );
    const result = await resolveNightPrice(db, {
      propertyId: U1,
      ratePlanCode: "bar",
      roomTypeId: U2,
      stayDate: "2026-08-03",
      checkInDate: "2026-08-03",
      checkoutDate: "2026-08-04",
      at,
      source: "ONLINE",
    });
    expect(result).toMatchObject({
      roomRateIdr: 600000,
      taxIdr: 60000,
      totalIdr: 660000,
      rateRuleType: "SPECIAL_DATE",
      taxProfileVersionId: U3,
    });
  });

  it("resolves IDR directly and foreign display preferences from snapshots", async () => {
    const db = { select: mocks.select } as never;
    const idr = await resolveDisplayEstimate(
      db,
      U1,
      "IDR",
      1600000,
      new Date(),
    );
    expect(idr.displayTotal).toBe(1600000);
    mocks.select.mockReturnValueOnce(chain([{ id: U2, rate: "0.0000625" }]));
    const usd = await resolveDisplayEstimate(
      db,
      U1,
      "USD",
      1600000,
      new Date(),
    );
    expect(usd).toMatchObject({
      exchangeRateSnapshotId: U2,
      displayTotal: 100,
    });
  });

  it("resolves a rate plan that intentionally has no tax profile", async () => {
    const db = { select: mocks.select } as never;
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            ratePlanId: U1,
            ratePlanVersionId: U2,
            ratePlanVersionNumber: 1,
            lifecycleStatus: "ACTIVE",
            approvalStatus: "NOT_REQUIRED",
            sourceEligibility: "ADMIN_MANUAL",
            taxProfileId: null,
            paymentInstructionSetId: null,
            cancellationPolicySetId: null,
            effectiveFrom: new Date("2026-01-01"),
            effectiveTo: new Date("2099-01-01"),
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            ruleType: "WEEK_PATTERN",
            priority: 2,
            weekdaysMask: 127,
            nightlyRateIdr: "450000",
            minimumStay: 1,
            maximumStay: null,
            closedToArrival: false,
            closedToDeparture: false,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    const result = await resolveNightPrice(db, {
      propertyId: U1,
      ratePlanCode: "manual",
      roomTypeId: U2,
      stayDate: "2026-08-03",
      checkInDate: "2026-08-03",
      checkoutDate: "2026-08-04",
      at: new Date("2026-08-02"),
      source: "ADMIN_MANUAL",
    });
    expect(result).toMatchObject({
      totalIdr: 450000,
      taxProfileVersionId: null,
      taxSnapshot: { noTax: true, taxRate: "0" },
    });
  });

  it("enforces rate availability, sales, arrival, departure, and maximum-stay guards", async () => {
    const db = { select: mocks.select } as never;
    const version = {
      ratePlanId: U1,
      ratePlanVersionId: U2,
      ratePlanVersionNumber: 1,
      lifecycleStatus: "ACTIVE",
      approvalStatus: "APPROVED",
      sourceEligibility: "ALL",
      taxProfileId: null,
      paymentInstructionSetId: null,
      cancellationPolicySetId: null,
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
    };
    const rule = {
      id: U3,
      ruleType: "BASE",
      priority: 1,
      weekdaysMask: 127,
      nightlyRateIdr: "500000",
      minimumStay: 1,
      maximumStay: null,
      closedToArrival: false,
      closedToDeparture: false,
    };
    const request = {
      propertyId: U1,
      ratePlanCode: "BAR",
      roomTypeId: U2,
      stayDate: "2026-08-03",
      checkInDate: "2026-08-03",
      checkoutDate: "2026-08-05",
      at: new Date("2026-08-02"),
      source: "ONLINE" as const,
    };

    mocks.select.mockReturnValueOnce(chain([]));
    await expect(resolveNightPrice(db, request)).rejects.toThrow(
      "No eligible rate plan",
    );

    mocks.select
      .mockReturnValueOnce(chain([version]))
      .mockReturnValueOnce(chain([{ ...rule, weekdaysMask: 0 }]));
    await expect(resolveNightPrice(db, request)).rejects.toThrow(
      "No rate is configured",
    );

    mocks.select
      .mockReturnValueOnce(chain([version]))
      .mockReturnValueOnce(chain([rule]))
      .mockReturnValueOnce(
        chain([
          { rateRuleId: U3, nightlyRateIdr: "500000", salesClosed: true },
        ]),
      );
    await expect(resolveNightPrice(db, request)).rejects.toThrow(
      "Sales are closed",
    );

    mocks.select
      .mockReturnValueOnce(chain([version]))
      .mockReturnValueOnce(chain([{ ...rule, closedToArrival: true }]))
      .mockReturnValueOnce(chain([]));
    await expect(resolveNightPrice(db, request)).rejects.toThrow(
      "Arrival or minimum-stay",
    );

    mocks.select
      .mockReturnValueOnce(chain([version]))
      .mockReturnValueOnce(chain([{ ...rule, closedToDeparture: true }]))
      .mockReturnValueOnce(chain([]));
    await expect(
      resolveNightPrice(db, { ...request, stayDate: "2026-08-04" }),
    ).rejects.toThrow("Departure is closed");

    mocks.select
      .mockReturnValueOnce(chain([version]))
      .mockReturnValueOnce(chain([{ ...rule, maximumStay: 1 }]))
      .mockReturnValueOnce(chain([]));
    await expect(resolveNightPrice(db, request)).rejects.toThrow(
      "Maximum-stay",
    );
  });

  it("rejects stale display-currency snapshots", async () => {
    mocks.select.mockReturnValueOnce(chain([]));
    await expect(
      resolveDisplayEstimate(
        { select: mocks.select } as never,
        U1,
        "AUD",
        1000000,
        new Date(),
      ),
    ).rejects.toThrow("unavailable or stale");
  });

  it("creates a rate-limited customer lookup session with audit", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U1,
          bookingCode: "KR-260802-ABC",
          bookerEmailNormalized: "budi@example.com",
        },
      ]),
    );
    const result = await createCustomerLookupSession({
      propertyId: U1,
      bookingCode: "kr-260802-abc",
      email: "BUDI@example.com",
      ipAddress: "203.0.113.5",
    });
    expect(result.token).toBeTruthy();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("creates a customer lookup session from the booking code alone", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U1,
          bookingCode: "KR-260802-ABC",
          bookerEmailNormalized: "budi@example.com",
        },
      ]),
    );
    const result = await createCustomerLookupSession({
      propertyId: U1,
      bookingCode: "kr-260802-abc",
      ipAddress: "203.0.113.5",
    });
    expect(result.token).toBeTruthy();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Booking code matched" }),
      expect.anything(),
    );
  });

  it("rejects customer lookup after too many attempts", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ count: "10" }] });
    await expect(
      createCustomerLookupSession({
        propertyId: U1,
        bookingCode: "KR-260802-ABC",
        email: "budi@example.com",
        ipAddress: "203.0.113.5",
      }),
    ).rejects.toThrow("Too many lookup attempts");
  });

  it("returns a booking summary without granting customer mutation access", async () => {
    process.env.WHATSAPP_CONTACT_NUMBER = "+62 812-0000-0000";
    const reservation = {
      id: U1,
      bookingCode: "KR-260802-ABC",
      bookerName: "Budi Santoso",
      status: "CONFIRMED",
      source: "ONLINE",
      language: "id",
      displayCurrency: "USD",
      paymentMode: "FULL",
      requiredPaymentIdr: "500000",
      paymentDeadlineAt: new Date("2026-08-03T05:00:00.000Z"),
      guaranteed: true,
      paymentInstructionVersionId: U3,
    };
    mocks.select
      .mockReturnValueOnce(chain([{ reservationId: U1 }]))
      .mockReturnValueOnce(chain([reservation]))
      .mockReturnValueOnce(
        chain([
          {
            lineNumber: 1,
            roomTypeId: U2,
            roomTypeCode: "DELUXE",
            roomTypeNameId: "Deluxe",
            roomTypeNameEn: "Deluxe",
            checkInDate: "2026-08-03",
            checkoutDate: "2026-08-04",
            adults: 2,
            children: 0,
            infants: 0,
            extraBedQuantity: 0,
            status: "ACTIVE",
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(
        chain([
          {
            bankName: "BCA",
            accountHolder: "KOOKA",
            accountNumberCiphertext: "cipher",
            accountNumberLast4: "7890",
            instructionId: "Transfer",
            instructionEn: "Transfer",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          { entryType: "DEBIT", totalAmountIdr: "500000" },
          { entryType: "CREDIT", totalAmountIdr: "100000" },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            status: "VERIFIED",
            amountIdr: "100000",
            receivedAt: new Date("2026-08-02T05:00:00.000Z"),
          },
        ]),
      );
    const result = await getCustomerBooking({
      propertyId: U1,
      token: "lookup-token",
    });
    expect(result).toMatchObject({
      bookingCode: "KR-260802-ABC",
      bookerName: "Budi Santoso",
      balanceIdr: 400000,
      rooms: [expect.objectContaining({ roomTypeName: "Deluxe" })],
      selfServiceChangesAllowed: false,
    });
    expect(result.whatsappUrl).toContain("wa.me/6281200000000");
  });
});
