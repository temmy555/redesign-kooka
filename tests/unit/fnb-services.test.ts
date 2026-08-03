import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  withIdempotency: vi.fn(),
  tx: undefined as unknown,
}));

vi.mock("../../src/db", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("../../src/platform/authorization", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/platform/authorization")>();
  return { ...original, requirePermission: mocks.requirePermission };
});
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import {
  assertFoodOrderTransition,
  calculateFoodLineAmounts,
  cancelFoodOrder,
  createPaperFoodOrder,
  formatDailyFoodOrderReference,
  getFoodOrderQueue,
  getPublicMenu,
  getStandaloneFoodInvoice,
  recordStandaloneFoodPayment,
  setRoomChargePrivilege,
  transitionFoodOrder,
} from "../../src/modules/commerce/fnb-service";
import {
  activateMenuItemVersion,
  createMenuCategory,
  createMenuItemVersion,
  getMenuAdminOverview,
  setMenuItemAvailability,
} from "../../src/modules/commerce/menu-admin-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const U5 = "55555555-5555-4555-a555-555555555555";
const session = { user: { id: U1 } };
const orderSequence = [{ issuedValue: 1 }];
const orderNow = new Date("2026-08-03T05:00:00.000Z");

function selectChain(rows: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.limit = vi.fn(() => chain);
  chain.for = vi.fn().mockResolvedValue(rows);
  chain.then = vi.fn((resolve: (value: unknown[]) => void) => resolve(rows));
  return chain;
}

function queuedDatabase(
  options: {
    selects?: unknown[][];
    returns?: unknown[][];
    executes?: unknown[][];
  } = {},
) {
  const selections = [...(options.selects ?? [])];
  const returns = [...(options.returns ?? [])];
  const executes = [...(options.executes ?? [])];
  const db: Record<string, ReturnType<typeof vi.fn>> = {};
  db.select = vi.fn(() => selectChain(selections.shift() ?? []));
  db.execute = vi.fn(async () => ({ rows: executes.shift() ?? [] }));
  db.insert = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.values = vi.fn(() => mutation);
    mutation.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    mutation.returning = vi.fn(async () => returns.shift() ?? []);
    mutation.then = vi.fn((resolve: (value: undefined) => void) =>
      resolve(undefined),
    );
    return mutation;
  });
  db.update = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.set = vi.fn(() => mutation);
    mutation.where = vi.fn().mockResolvedValue(undefined);
    return mutation;
  });
  return db;
}

const menuRow = {
  categoryId: U2,
  categoryCode: "MAIN",
  categoryNameId: "Menu Utama",
  categoryNameEn: "Main Menu",
  categorySortOrder: 1,
  itemId: U3,
  itemCode: "TEA",
  available: true,
  versionId: U4,
  versionNumber: 2,
  nameId: "Teh",
  nameEn: "Tea",
  descriptionId: "Teh hangat",
  descriptionEn: "Hot tea",
  priceIdr: "20000",
  taxProfileVersionId: null,
  taxRate: null,
  serviceChargeRate: null,
  taxInclusive: null,
  serviceChargeInclusive: null,
  noTax: null,
  effectiveFrom: new Date("2026-08-01T00:00:00Z"),
};
const secondMenuRow = {
  ...menuRow,
  itemId: U5,
  itemCode: "COFFEE",
  versionId: U5,
  nameId: "Kopi",
  nameEn: "Coffee",
  priceIdr: "30000",
};

describe("Batch 5 F&B domain and services", () => {
  beforeEach(() => {
    mocks.getDatabase.mockReset();
    mocks.requirePermission.mockReset().mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockReset().mockResolvedValue(undefined);
    mocks.withIdempotency
      .mockReset()
      .mockImplementation(
        async (
          _options: unknown,
          run: (tx: unknown) => Promise<{ response: unknown }>,
        ) => (await run(mocks.tx)).response,
      );
  });

  it("calculates whole-IDR line totals and validates inputs", () => {
    expect(
      calculateFoodLineAmounts({
        unitPriceIdr: 20_000,
        quantity: 2,
        discountAmountIdr: 5_000,
        taxRate: 0,
        serviceChargeRate: 0,
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax: true,
      }),
    ).toMatchObject({ netAmountIdr: 40_000, totalAmountIdr: 35_000 });
    expect(() =>
      calculateFoodLineAmounts({
        unitPriceIdr: 20_000,
        quantity: 0,
        taxRate: 0,
        serviceChargeRate: 0,
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax: true,
      }),
    ).toThrow("positive whole values");
    expect(() =>
      calculateFoodLineAmounts({
        unitPriceIdr: 20_000,
        quantity: 1,
        discountAmountIdr: 30_000,
        taxRate: 0,
        serviceChargeRate: 0,
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax: true,
      }),
    ).toThrow("Invalid food discount");
  });

  it("enforces the fulfillment transition matrix", () => {
    expect(() =>
      assertFoodOrderTransition("ENTERED", "ACCEPTED"),
    ).not.toThrow();
    expect(() => assertFoodOrderTransition("COMPLETED", "CANCELLED")).toThrow(
      "cannot transition",
    );
  });

  it("formats an atomic daily paper reference using Jakarta date", () => {
    expect(formatDailyFoodOrderReference("2026-08-03", 1)).toBe("26080301");
    expect(formatDailyFoodOrderReference("2026-08-03", 12)).toBe("26080312");
    expect(() => formatDailyFoodOrderReference("bad-date", 1)).toThrow(
      "Invalid food order sequence",
    );
  });

  it("publishes localized menu items with current display-rate snapshots", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase({
        selects: [
          [menuRow, { ...menuRow, versionId: U1, versionNumber: 1 }],
          [
            { currency: "USD", rate: "0.000061", asOfAt: new Date() },
            { currency: "USD", rate: "0.000060", asOfAt: new Date() },
            { currency: "AUD", rate: "0.000092", asOfAt: new Date() },
          ],
        ],
      }),
    );
    const menu = await getPublicMenu({ propertyId: U1, locale: "en" });
    expect(menu.categories[0]?.name).toBe("Main Menu");
    expect(menu.categories[0]?.items[0]).toMatchObject({
      name: "Tea",
      priceIdr: 20_000,
      estimatedTotalIdr: 20_000,
    });
    expect(menu.displayRates).toEqual({ USD: 0.000061, AUD: 0.000092 });
  });

  it("creates a standalone paper order with immutable price snapshots", async () => {
    const tx = queuedDatabase({
      selects: [[], [menuRow, secondMenuRow]],
      executes: [orderSequence],
      returns: [
        [{ id: U2, orderCode: "FNB-26080301" }],
        [{ id: U4 }],
        [{ id: U5 }],
      ],
    });
    mocks.tx = tx;
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "paper-001",
        settlementRoute: "STANDALONE",
        customerName: "Budi",
        items: [
          { menuItemId: U3, quantity: 2 },
          { menuItemId: U5, quantity: 1, notes: "Tanpa gula" },
        ],
        now: orderNow,
      }),
    ).resolves.toMatchObject({
      orderId: U2,
      orderCode: "FNB-26080301",
      paperReference: "26080301",
      settlementRoute: "STANDALONE",
      orderTotalIdr: 70_000,
      items: [{ id: U4 }, { id: U5 }],
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "fnb.paper_order.create" }),
      tx,
    );
  });

  it("honors a confirmed printed-price override", async () => {
    mocks.tx = queuedDatabase({
      selects: [[], [menuRow]],
      executes: [orderSequence],
      returns: [[{ id: U2, orderCode: "FNB-002" }], [{ id: U4 }]],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "paper-002",
        settlementRoute: "STANDALONE",
        items: [
          {
            menuItemId: U3,
            quantity: 1,
            unitPriceOverrideIdr: 18_000,
            overrideReason: "Printed form has prior approved price",
            guestInformed: true,
          },
        ],
        now: orderNow,
      }),
    ).resolves.toMatchObject({ orderTotalIdr: 18_000 });
  });

  it("skips stale duplicate sequences and rejects unavailable or unconfirmed changed-price orders", async () => {
    mocks.tx = queuedDatabase({
      selects: [[{ id: U2 }], [], [menuRow]],
      executes: [orderSequence, [{ issuedValue: 2 }]],
      returns: [[{ id: U2, orderCode: "FNB-26080302" }], [{ id: U4 }]],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "duplicate",
        settlementRoute: "STANDALONE",
        items: [{ menuItemId: U3, quantity: 1 }],
        now: orderNow,
      }),
    ).resolves.toMatchObject({
      orderCode: "FNB-26080302",
      paperReference: "26080302",
    });

    mocks.tx = queuedDatabase({
      selects: [[], []],
      executes: [orderSequence],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "unavailable",
        settlementRoute: "STANDALONE",
        items: [{ menuItemId: U3, quantity: 1 }],
        now: orderNow,
      }),
    ).rejects.toThrow("unavailable");

    mocks.tx = queuedDatabase({
      selects: [[], [menuRow]],
      executes: [orderSequence],
      returns: [[{ id: U2, orderCode: "FNB-OVERRIDE" }]],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "override-invalid",
        settlementRoute: "STANDALONE",
        items: [{ menuItemId: U3, quantity: 1, unitPriceOverrideIdr: 18_000 }],
        now: orderNow,
      }),
    ).rejects.toThrow("guest confirmation");
  });

  it("requires room and lead-guest verification for room charge", async () => {
    mocks.tx = queuedDatabase({
      selects: [[], [menuRow]],
      executes: [orderSequence],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "room-missing",
        settlementRoute: "ROOM_CHARGE",
        items: [{ menuItemId: U3, quantity: 1 }],
        now: orderNow,
      }),
    ).rejects.toThrow("verification are required");
  });

  it("posts a verified room order to exactly one billing bucket", async () => {
    const roomTarget = {
      roomStayId: U4,
      stayStatus: "IN_HOUSE",
      chargePrivilege: "ALLOWED",
      reservationId: U1,
      reservationRoomId: U2,
      folioId: U3,
      folioStatus: "OPEN",
      billingBucketId: U4,
      roomUnitId: U2,
      roomNumber: "2",
      leadGuestId: U1,
      leadGuestName: "Budi Santoso",
    };
    mocks.tx = queuedDatabase({
      selects: [[], [menuRow]],
      executes: [orderSequence, [roomTarget]],
      returns: [
        [{ id: U2, orderCode: "FNB-ROOM" }],
        [{ id: U4 }],
        [{ id: U3 }],
      ],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "room-order",
        settlementRoute: "ROOM_CHARGE",
        roomStayId: U4,
        expectedRoomNumber: "2",
        expectedLeadGuestName: "budi santoso",
        items: [{ menuItemId: U3, quantity: 1 }],
        now: orderNow,
      }),
    ).resolves.toMatchObject({
      settlementRoute: "ROOM_CHARGE",
      items: [{ folioEntryId: U3 }],
    });
  });

  it.each([
    [undefined, "Active room stay not found"],
    [
      {
        stayStatus: "CHECKED_OUT",
        chargePrivilege: "ALLOWED",
        folioStatus: "OPEN",
      },
      "not currently in house",
    ],
    [
      {
        stayStatus: "IN_HOUSE",
        chargePrivilege: "NOT_ALLOWED",
        folioStatus: "OPEN",
      },
      "privilege is not allowed",
    ],
    [
      {
        stayStatus: "IN_HOUSE",
        chargePrivilege: "ALLOWED",
        folioStatus: "CLOSED",
      },
      "Folio is closed",
    ],
  ])("rejects unsafe room-charge targets", async (override, message) => {
    const base = {
      roomStayId: U4,
      stayStatus: "IN_HOUSE",
      chargePrivilege: "ALLOWED",
      reservationId: U1,
      reservationRoomId: U2,
      folioId: U3,
      folioStatus: "OPEN",
      billingBucketId: U4,
      roomUnitId: U2,
      roomNumber: "2",
      leadGuestId: U1,
      leadGuestName: "Budi",
    };
    mocks.tx = queuedDatabase({
      selects: [[], [menuRow]],
      executes: [orderSequence, override ? [{ ...base, ...override }] : []],
    });
    await expect(
      createPaperFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: `guard-${message}`,
        settlementRoute: "ROOM_CHARGE",
        roomStayId: U4,
        expectedRoomNumber: "2",
        expectedLeadGuestName: "Budi",
        items: [{ menuItemId: U3, quantity: 1 }],
        now: orderNow,
      }),
    ).rejects.toThrow(message);
  });

  it("updates charge privilege and order lifecycle with audit history", async () => {
    mocks.tx = queuedDatabase({
      executes: [[{ id: U4, chargePrivilege: "APPROVAL_REQUIRED" }]],
    });
    await expect(
      setRoomChargePrivilege({
        propertyId: U1,
        session,
        idempotencyKey: "privilege",
        roomStayId: U4,
        privilege: "ALLOWED",
        reason: "Guest approved room charges",
      }),
    ).resolves.toMatchObject({ chargePrivilege: "ALLOWED" });

    mocks.tx = queuedDatabase({ selects: [[{ id: U2, status: "ENTERED" }]] });
    await expect(
      transitionFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "accepted",
        foodOrderId: U2,
        toStatus: "ACCEPTED",
      }),
    ).resolves.toMatchObject({ status: "ACCEPTED" });
  });

  it("cancels an order by reversing folio entries and flagging paid refunds", async () => {
    mocks.tx = queuedDatabase({
      selects: [
        [{ id: U2, status: "PREPARING", settlementRoute: "ROOM_CHARGE" }],
        [
          {
            id: U3,
            folioId: U1,
            billingBucketId: U4,
            description: "Tea",
            sourceLineId: U3,
            reservationRoomId: U2,
            roomUnitId: U4,
            guestId: U1,
            quantity: "1",
            unitAmountIdr: "20000",
            netAmountIdr: "20000",
            discountAmountIdr: "0",
            serviceChargeAmountIdr: "0",
            taxAmountIdr: "0",
            totalAmountIdr: "20000",
            taxProfileVersionId: null,
          },
        ],
        [{ status: "PAID" }],
      ],
      returns: [[{ id: U4 }]],
    });
    await expect(
      cancelFoodOrder({
        propertyId: U1,
        session,
        idempotencyKey: "cancel-order",
        foodOrderId: U2,
        reason: "Guest cancelled",
      }),
    ).resolves.toMatchObject({
      status: "CANCELLED",
      reversalIds: [U4],
      paidStandaloneRequiresRefund: true,
    });
  });

  it("records an exact standalone payment and receipt", async () => {
    mocks.tx = queuedDatabase({
      selects: [
        [
          {
            id: U2,
            orderCode: "FNB-001",
            status: "COMPLETED",
            settlementRoute: "STANDALONE",
          },
        ],
        [{ totalIdr: "20000" }, { totalIdr: "10000" }],
        [],
      ],
      returns: [[{ id: U3 }], [{ id: U4 }]],
    });
    await expect(
      recordStandaloneFoodPayment({
        propertyId: U1,
        session,
        idempotencyKey: "pay-food",
        foodOrderId: U2,
        method: "CASH",
        amountIdr: 30_000,
        recipientName: "Budi",
      }),
    ).resolves.toMatchObject({ paymentId: U3, receiptId: U4 });
  });

  it("lists the F&B queue with permission enforcement", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase({
        selects: [
          [
            {
              id: U2,
              orderCode: "FNB-26080301",
              paperReference: "26080301",
              settlementRoute: "STANDALONE",
              status: "ENTERED",
              customerName: "Budi",
              roomStayId: null,
              folioId: null,
              notes: null,
              createdAt: orderNow,
            },
          ],
          [
            {
              id: U3,
              foodOrderId: U2,
              name: "Teh",
              quantity: "2",
              unitPriceIdr: "20000",
              taxAmountIdr: "0",
              serviceChargeAmountIdr: "0",
              discountAmountIdr: "0",
              totalIdr: "40000",
              notes: "Hangat",
            },
          ],
          [{ foodOrderId: U2, amountIdr: "10000" }],
          [
            {
              id: U4,
              foodOrderId: U2,
              receiptCode: "FRC-001",
              recipientName: "Budi",
              status: "ISSUED",
              issuedAt: orderNow,
            },
          ],
        ],
      }),
    );
    await expect(
      getFoodOrderQueue({ propertyId: U1, session }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: U2,
        orderTotalIdr: "40000",
        paidAmountIdr: "10000",
        receiptId: U4,
        receiptCode: "FRC-001",
        items: [
          expect.objectContaining({ id: U3, name: "Teh", totalIdr: "40000" }),
        ],
      }),
    ]);
  });

  it("loads a paid standalone order as a printable F&B invoice", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase({
        selects: [
          [
            {
              foodOrderId: U2,
              orderCode: "FNB-26080301",
              paperReference: "26080301",
              customerName: "Budi",
              orderStatus: "COMPLETED",
              settlementRoute: "STANDALONE",
              orderNotes: null,
              orderedAt: orderNow,
              propertyName: "KOOKA Residence Surabaya",
              propertyAddress: "Surabaya",
              paymentCode: "FPY-001",
              paymentMethod: "CASH",
              paymentReference: null,
              paidAmountIdr: "40000",
              paidAt: orderNow,
              receiptId: U4,
              receiptCode: "FRC-001",
              receiptStatus: "ISSUED",
              recipientName: "Budi",
              issuedAt: orderNow,
            },
          ],
          [
            {
              id: U3,
              name: "Teh",
              quantity: "2",
              unitPriceIdr: "20000",
              taxAmountIdr: "0",
              serviceChargeAmountIdr: "0",
              discountAmountIdr: "0",
              totalIdr: "40000",
              notes: null,
            },
          ],
        ],
      }),
    );
    await expect(
      getStandaloneFoodInvoice({
        propertyId: U1,
        foodOrderId: U2,
        session,
      }),
    ).resolves.toMatchObject({
      receiptCode: "FRC-001",
      subtotalIdr: 40_000,
      totalIdr: 40_000,
      currency: "IDR",
      items: [expect.objectContaining({ name: "Teh" })],
    });
  });
});

describe("Batch 5 menu administration services", () => {
  beforeEach(() => {
    mocks.getDatabase.mockReset();
    mocks.requirePermission.mockReset().mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockReset().mockResolvedValue(undefined);
    mocks.withIdempotency
      .mockReset()
      .mockImplementation(
        async (
          _options: unknown,
          run: (tx: unknown) => Promise<{ response: unknown }>,
        ) => (await run(mocks.tx)).response,
      );
  });

  it("lists menu master data and creates a category", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase({ selects: [[{ categoryId: U2 }]] }),
    );
    await expect(
      getMenuAdminOverview({ propertyId: U1, session }),
    ).resolves.toEqual([{ categoryId: U2 }]);

    mocks.tx = queuedDatabase({ returns: [[{ id: U2 }]] });
    await expect(
      createMenuCategory({
        propertyId: U1,
        session,
        idempotencyKey: "category",
        categoryCode: " main food ",
        nameId: "Makanan",
        nameEn: "Food",
        sortOrder: 1,
      }),
    ).resolves.toMatchObject({ categoryId: U2, code: "MAIN_FOOD" });
  });

  it("creates a versioned item with a property-owned tax profile", async () => {
    mocks.tx = queuedDatabase({
      selects: [[{ id: U2 }], [{ id: U4 }], [{ id: U3 }]],
      executes: [[{ nextVersion: 3 }]],
      returns: [[{ id: U4 }]],
    });
    await expect(
      createMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "item-version",
        categoryId: U2,
        itemCode: "tea",
        nameId: "Teh",
        nameEn: "Tea",
        priceIdr: 20_000,
        taxProfileVersionId: U4,
        effectiveFrom: new Date("2026-08-02T00:00:00Z"),
        reason: "Menu baru",
      }),
    ).resolves.toMatchObject({ menuItemId: U3, versionNumber: 3 });
  });

  it("rejects invalid item prices, periods, categories, and tax profiles", async () => {
    await expect(
      createMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "bad-price",
        categoryId: U2,
        itemCode: "tea",
        nameId: "Teh",
        nameEn: "Tea",
        priceIdr: 20.5,
        effectiveFrom: new Date(),
        reason: "Invalid price",
      }),
    ).rejects.toThrow("whole IDR");

    await expect(
      createMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "bad-period",
        categoryId: U2,
        itemCode: "tea",
        nameId: "Teh",
        nameEn: "Tea",
        priceIdr: 20_000,
        effectiveFrom: new Date("2026-08-03T00:00:00Z"),
        effectiveTo: new Date("2026-08-02T00:00:00Z"),
        reason: "Invalid period",
      }),
    ).rejects.toThrow("after its start");

    mocks.tx = queuedDatabase({ selects: [[]] });
    await expect(
      createMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "missing-category",
        categoryId: U2,
        itemCode: "tea",
        nameId: "Teh",
        nameEn: "Tea",
        priceIdr: 20_000,
        effectiveFrom: new Date(),
        reason: "Missing category",
      }),
    ).rejects.toThrow("category not found");
  });

  it("activates item versions and changes current availability", async () => {
    mocks.tx = queuedDatabase({
      selects: [[{ id: U4, itemId: U3, status: "DRAFT" }]],
    });
    await expect(
      activateMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "activate",
        versionId: U4,
        reason: "Publish menu",
      }),
    ).resolves.toMatchObject({ lifecycleStatus: "ACTIVE" });

    mocks.tx = queuedDatabase({ selects: [[{ id: U3, available: true }]] });
    await expect(
      setMenuItemAvailability({
        propertyId: U1,
        session,
        idempotencyKey: "sold-out",
        menuItemId: U3,
        available: false,
        reason: "Ingredient unavailable",
      }),
    ).resolves.toMatchObject({ available: false });
  });

  it("rejects missing or already-active versions and missing items", async () => {
    mocks.tx = queuedDatabase({ selects: [[]] });
    await expect(
      activateMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "missing-version",
        versionId: U4,
        reason: "Missing version",
      }),
    ).rejects.toThrow("version not found");

    mocks.tx = queuedDatabase({
      selects: [[{ id: U4, itemId: U3, status: "ACTIVE" }]],
    });
    await expect(
      activateMenuItemVersion({
        propertyId: U1,
        session,
        idempotencyKey: "active-version",
        versionId: U4,
        reason: "Already active",
      }),
    ).rejects.toThrow("Only draft");

    mocks.tx = queuedDatabase({ selects: [[]] });
    await expect(
      setMenuItemAvailability({
        propertyId: U1,
        session,
        idempotencyKey: "missing-item",
        menuItemId: U3,
        available: false,
        reason: "Missing item",
      }),
    ).rejects.toThrow("Menu item not found");
  });
});
