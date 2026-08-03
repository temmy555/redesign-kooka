import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getPublicMenu: vi.fn(),
  getMenuAdminOverview: vi.fn(),
  createMenuCategory: vi.fn(),
  createMenuItemVersion: vi.fn(),
  activateMenuItemVersion: vi.fn(),
  setMenuItemAvailability: vi.fn(),
  getFoodOrderQueue: vi.fn(),
  createPaperFoodOrder: vi.fn(),
  setRoomChargePrivilege: vi.fn(),
  transitionFoodOrder: vi.fn(),
  cancelFoodOrder: vi.fn(),
  recordStandaloneFoodPayment: vi.fn(),
  getStandaloneFoodInvoice: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/modules/commerce/fnb-service", () => ({
  getPublicMenu: mocks.getPublicMenu,
  getFoodOrderQueue: mocks.getFoodOrderQueue,
  createPaperFoodOrder: mocks.createPaperFoodOrder,
  setRoomChargePrivilege: mocks.setRoomChargePrivilege,
  transitionFoodOrder: mocks.transitionFoodOrder,
  cancelFoodOrder: mocks.cancelFoodOrder,
  recordStandaloneFoodPayment: mocks.recordStandaloneFoodPayment,
  getStandaloneFoodInvoice: mocks.getStandaloneFoodInvoice,
}));
vi.mock("../../src/modules/commerce/menu-admin-service", () => ({
  getMenuAdminOverview: mocks.getMenuAdminOverview,
  createMenuCategory: mocks.createMenuCategory,
  createMenuItemVersion: mocks.createMenuItemVersion,
  activateMenuItemVersion: mocks.activateMenuItemVersion,
  setMenuItemAvailability: mocks.setMenuItemAvailability,
}));

import { GET as publicMenuGet } from "../../app/api/content/menu/route";
import {
  GET as adminMenuGet,
  POST as adminMenuPost,
} from "../../app/api/staff/admin/menu/route";
import {
  GET as orderGet,
  POST as orderPost,
} from "../../app/api/staff/fnb/orders/route";
import { GET as invoiceGet } from "../../app/api/staff/fnb/orders/[orderId]/invoice/route";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";

function request(path: string, body: unknown, key = "batch5-test-key") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Batch 5 menu and F&B routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset().mockResolvedValue({ ok: true });
    }
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.getActivePropertyId.mockResolvedValue(U2);
    mocks.getPublicMenu.mockResolvedValue({ categories: [] });
    mocks.getStandaloneFoodInvoice.mockResolvedValue({
      foodOrderId: U1,
      orderCode: "FNB-26080301",
      paperReference: "26080301",
      customerName: "Budi",
      orderStatus: "COMPLETED",
      settlementRoute: "STANDALONE",
      orderNotes: null,
      orderedAt: new Date("2026-08-03T05:00:00Z"),
      propertyName: "KOOKA Residence Surabaya",
      propertyAddress: "Surabaya",
      paymentCode: "FPY-001",
      paymentMethod: "CASH",
      paymentReference: null,
      paidAmountIdr: "40000",
      paidAt: new Date("2026-08-03T05:00:00Z"),
      receiptId: U2,
      receiptCode: "FRC-001",
      receiptStatus: "ISSUED",
      recipientName: "Budi",
      issuedAt: new Date("2026-08-03T05:00:00Z"),
      items: [
        {
          id: U2,
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
      subtotalIdr: 40000,
      taxIdr: 0,
      serviceChargeIdr: 0,
      discountIdr: 0,
      totalIdr: 40000,
      currency: "IDR",
    });
  });

  it("serves a cacheable bilingual public menu and rejects bad locale", async () => {
    const response = await publicMenuGet(
      new Request("http://localhost/api/content/menu?locale=en"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain(
      "stale-while-revalidate",
    );
    expect(mocks.getPublicMenu).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: U2, locale: "en" }),
    );
    expect(
      (
        await publicMenuGet(
          new Request("http://localhost/api/content/menu?locale=fr"),
        )
      ).status,
    ).toBe(400);
  });

  it("normalizes unexpected public menu failures", async () => {
    mocks.getPublicMenu.mockRejectedValue(new Error("database detail"));
    const response = await publicMenuGet(
      new Request("http://localhost/api/content/menu?locale=id"),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
    );
  });

  it("returns the admin menu and F&B queues", async () => {
    expect((await adminMenuGet()).status).toBe(200);
    expect((await orderGet()).status).toBe(200);
    expect(mocks.getMenuAdminOverview).toHaveBeenCalledOnce();
    expect(mocks.getFoodOrderQueue).toHaveBeenCalledOnce();
  });

  it("renders a paid standalone F&B invoice as an inline PDF", async () => {
    const response = await invoiceGet(
      new Request(`http://localhost/api/staff/fnb/orders/${U1}/invoice`),
      { params: Promise.resolve({ orderId: U1 }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "Invoice-FNB-FRC-001.pdf",
    );
    const bytes = await response.arrayBuffer();
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);
    expect(page.getWidth()).toBeCloseTo(419.53, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
    expect(mocks.getStandaloneFoodInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: U2, foodOrderId: U1 }),
    );
  });

  it.each([
    [
      {
        action: "CREATE_CATEGORY",
        categoryCode: "main",
        nameId: "Utama",
        nameEn: "Main",
        sortOrder: 1,
      },
      "createMenuCategory",
      201,
    ],
    [
      {
        action: "CREATE_ITEM_VERSION",
        categoryId: U1,
        itemCode: "tea",
        nameId: "Teh",
        nameEn: "Tea",
        priceIdr: 20_000,
        effectiveFrom: "2026-08-02T00:00:00Z",
        reason: "Menu resmi baru",
      },
      "createMenuItemVersion",
      201,
    ],
    [
      {
        action: "ACTIVATE_ITEM_VERSION",
        versionId: U1,
        reason: "Siap ditampilkan",
      },
      "activateMenuItemVersion",
      200,
    ],
    [
      {
        action: "SET_AVAILABILITY",
        menuItemId: U1,
        available: false,
        reason: "Bahan sedang habis",
      },
      "setMenuItemAvailability",
      200,
    ],
  ])("dispatches menu administration action", async (body, service, status) => {
    const response = await adminMenuPost(
      request("/api/staff/admin/menu", body),
    );
    expect(response.status).toBe(status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it.each([
    [
      {
        action: "CREATE_PAPER_ORDER",
        settlementRoute: "STANDALONE",
        customerName: "Budi",
        items: [
          { menuItemId: U1, quantity: 2 },
          { menuItemId: U2, quantity: 1, notes: "Tanpa gula" },
        ],
      },
      "createPaperFoodOrder",
      201,
    ],
    [
      {
        action: "SET_ROOM_CHARGE_PRIVILEGE",
        roomStayId: U1,
        privilege: "ALLOWED",
        reason: "Dikonfirmasi saat check-in",
      },
      "setRoomChargePrivilege",
      200,
    ],
    [
      {
        action: "TRANSITION_ORDER",
        foodOrderId: U1,
        toStatus: "PREPARING",
      },
      "transitionFoodOrder",
      200,
    ],
    [
      {
        action: "CANCEL_ORDER",
        foodOrderId: U1,
        reason: "Tamu membatalkan pesanan",
      },
      "cancelFoodOrder",
      200,
    ],
    [
      {
        action: "RECORD_STANDALONE_PAYMENT",
        foodOrderId: U1,
        method: "CASH",
        amountIdr: 40_000,
        recipientName: "Budi",
      },
      "recordStandaloneFoodPayment",
      201,
    ],
  ])("dispatches F&B order action", async (body, service, status) => {
    const response = await orderPost(request("/api/staff/fnb/orders", body));
    expect(response.status).toBe(status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
    if (service === "createPaperFoodOrder") {
      expect(mocks.createPaperFoodOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ menuItemId: U1, quantity: 2 }),
            expect.objectContaining({ menuItemId: U2, quantity: 1 }),
          ]),
        }),
      );
      expect(mocks.createPaperFoodOrder.mock.calls[0]?.[0]).not.toHaveProperty(
        "paperReference",
      );
    }
  });

  it("requires authentication, valid idempotency, and valid payloads", async () => {
    expect(
      (
        await orderPost(
          request(
            "/api/staff/fnb/orders",
            { action: "CANCEL_ORDER", foodOrderId: U1, reason: "Valid reason" },
            "",
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await adminMenuPost(
          request("/api/staff/admin/menu", { action: "CREATE_CATEGORY" }),
        )
      ).status,
    ).toBe(400);
    mocks.requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );
    expect((await orderGet()).status).toBe(401);
    expect((await adminMenuGet()).status).toBe(401);
  });
});
