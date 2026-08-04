import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getActivePermissionCodes: vi.fn(),
  getOperationalDashboard: vi.fn(),
  getRoomBoard: vi.fn(),
  getOperationsQueues: vi.fn(),
  getFoodOrderQueue: vi.fn(),
  getFoodOrderPage: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/staff",
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  redirect: mocks.redirect,
}));
vi.mock("../../src/platform/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/platform/authorization", () => ({
  getActivePermissionCodes: mocks.getActivePermissionCodes,
}));
vi.mock("../../src/modules/reporting/reporting-service", () => ({
  getOperationalDashboard: mocks.getOperationalDashboard,
}));
vi.mock("../../src/modules/operations/room-service", () => ({
  getRoomBoard: mocks.getRoomBoard,
}));
vi.mock("../../src/modules/operations/property-service", () => ({
  getOperationsQueues: mocks.getOperationsQueues,
}));
vi.mock("../../src/modules/commerce/fnb-service", () => ({
  getFoodOrderQueue: mocks.getFoodOrderQueue,
  getFoodOrderPage: mocks.getFoodOrderPage,
}));

import SecureStaffLayout from "../../app/staff/(secure)/layout";
import AdminPage from "../../app/staff/(secure)/admin/page";
import FnbPage from "../../app/staff/(secure)/fnb/page";
import FrontOfficePage from "../../app/staff/(secure)/front-office/page";
import HousekeepingPage from "../../app/staff/(secure)/housekeeping/page";
import StaffHomePage from "../../app/staff/(secure)/page";
import StaffRoomsPage from "../../app/staff/(secure)/rooms/page";
import StaffLoginPage from "../../app/staff/login/page";

const U1 = "11111111-1111-4111-a111-111111111111";
const session = {
  user: { id: U1, name: "Front Office", email: "fo@kooka.test" },
};

const dashboard = {
  metadata: {
    timezone: "Asia/Jakarta",
    businessDate: "2026-08-02",
    rangeStart: "2026-08-02",
    rangeEnd: "2026-08-02",
    dataAsOf: "2026-08-02T01:00:00Z",
    metricVersion: "v1",
    currency: "IDR",
  },
  summary: {
    physical_rooms: 15,
    occupied_rooms: 1,
    occupancyPercent: 6.67,
    outstanding_idr: 0,
  },
  queues: {},
  reconciliation: { openCount: 0, criticalCount: 0, exceptions: [] },
};

describe("Step 22A staff server pages", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.requireCurrentSession.mockResolvedValue(session);
    mocks.getActivePropertyId.mockResolvedValue(U1);
    mocks.getActivePermissionCodes.mockResolvedValue(new Set<string>());
    mocks.getOperationalDashboard.mockResolvedValue(dashboard);
    mocks.getRoomBoard.mockResolvedValue({
      generatedAt: "2026-08-02T01:00:00Z",
      staleAfterSeconds: 60,
      sharedDisplay: true,
      rooms: [],
    });
    mocks.getOperationsQueues.mockResolvedValue({
      generatedAt: "2026-08-02T01:00:00Z",
      cleaning: [],
      maintenance: [],
      lostFound: [],
    });
    mocks.getFoodOrderQueue.mockResolvedValue([]);
    mocks.getFoodOrderPage.mockResolvedValue({
      orders: [],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1,
        from: 0,
        to: 0,
      },
    });
  });

  it("renders the ordinary credential login state", async () => {
    const credentials = renderToStaticMarkup(
      await StaffLoginPage({
        searchParams: Promise.resolve({ next: "/staff/rooms" }),
      }),
    );
    expect(credentials).toContain("Email staf");
    expect(credentials).toContain("Kata sandi");
    expect(credentials).toContain("Masuk ke operasional");
    expect(credentials).not.toContain("Kode authenticator");
  });

  it("redirects an authenticated staff member away from the login page", async () => {
    mocks.getCurrentSession.mockResolvedValue(session);

    await StaffLoginPage({
      searchParams: Promise.resolve({ next: "/staff/rooms" }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith("/staff/rooms");
  });

  it("renders the authenticated shell and role-aware navigation", async () => {
    mocks.getCurrentSession.mockResolvedValue(session);
    mocks.getActivePermissionCodes.mockResolvedValue(
      new Set(["report.view", "stay.manage", "housekeeping.task.manage"]),
    );
    const html = renderToStaticMarkup(
      await SecureStaffLayout({ children: <div>Secure content</div> }),
    );
    expect(html).toContain("Front Office");
    expect(html).toContain("Pantauan kamar");
    expect(html).toContain("Housekeeping");
    expect(html).toContain("Secure content");
  });

  it("renders the direct-source dashboard for reporting roles", async () => {
    mocks.getActivePermissionCodes.mockResolvedValue(new Set(["report.view"]));
    const html = renderToStaticMarkup(await StaffHomePage());
    expect(html).toContain("Hari ini");
    expect(html).toContain("15");
    expect(mocks.getOperationalDashboard).toHaveBeenCalledOnce();
  });

  it("guards and renders the Batch 7 Front Office and Owner workspaces", async () => {
    mocks.getActivePermissionCodes.mockResolvedValue(
      new Set(["booking.manage", "payment.manage", "stay.manage"]),
    );
    expect(
      renderToStaticMarkup(
        await FrontOfficePage({ searchParams: Promise.resolve({}) }),
      ),
    ).toContain("Booking manual / multi-room");

    mocks.getActivePermissionCodes.mockResolvedValue(
      new Set(["configuration.view", "room_master.view"]),
    );
    expect(renderToStaticMarkup(await AdminPage())).toContain("Pengaturan");

    mocks.getActivePermissionCodes.mockResolvedValue(new Set());
    expect(
      renderToStaticMarkup(
        await FrontOfficePage({ searchParams: Promise.resolve({}) }),
      ),
    ).toContain("Akses dibatasi");
    expect(renderToStaticMarkup(await AdminPage())).toContain("Akses dibatasi");
  });

  it.each([
    ["housekeeping.task.manage", "Housekeeping"],
    ["fnb.order.manage", "F&amp;B"],
    ["room.board.view", "Pantauan kamar"],
    ["none", "Akses belum diberikan"],
  ])("routes a restricted role home for %s", async (permission, text) => {
    mocks.getActivePermissionCodes.mockResolvedValue(
      permission === "none" ? new Set() : new Set([permission]),
    );
    const html = renderToStaticMarkup(await StaffHomePage());
    expect(html).toContain(text);
  });

  it("renders room monitor for full and shared viewers, and denies others", async () => {
    mocks.getActivePermissionCodes.mockResolvedValue(new Set(["stay.manage"]));
    expect(renderToStaticMarkup(await StaffRoomsPage())).toContain(
      "Pantauan kamar",
    );
    expect(mocks.getRoomBoard).toHaveBeenLastCalledWith(
      expect.objectContaining({ sharedDisplay: false }),
    );

    mocks.getActivePermissionCodes.mockResolvedValue(
      new Set(["room.board.view"]),
    );
    expect(renderToStaticMarkup(await StaffRoomsPage())).toContain(
      "Nama tamu dimasking",
    );
    expect(mocks.getRoomBoard).toHaveBeenLastCalledWith(
      expect.objectContaining({ sharedDisplay: true }),
    );

    mocks.getActivePermissionCodes.mockResolvedValue(new Set());
    expect(renderToStaticMarkup(await StaffRoomsPage())).toContain(
      "Akses dibatasi",
    );
  });

  it("renders housekeeping queues and their empty-state guards", async () => {
    mocks.getActivePermissionCodes.mockResolvedValue(
      new Set(["housekeeping.task.manage"]),
    );
    mocks.getOperationsQueues.mockResolvedValue({
      generatedAt: "2026-08-02T01:00:00Z",
      cleaning: [
        {
          id: U1,
          taskType: "GUEST_REQUEST",
          targetAt: new Date("2026-08-02T02:00:00Z"),
          priority: "URGENT",
          status: "REQUESTED",
          notes: "Tamu sedang pergi",
        },
        {
          id: "22222222-2222-4222-a222-222222222222",
          taskType: "CHECKOUT",
          targetAt: null,
          priority: "NORMAL",
          status: "INSPECTED",
          notes: null,
        },
      ],
      maintenance: [
        {
          id: U1,
          title: "AC tidak dingin",
          category: "AIR_CONDITIONER",
          severity: "HIGH",
          status: "REPORTED",
          serviceabilityImpact: "BLOCKED",
        },
        {
          id: "33333333-3333-4333-a333-333333333333",
          title: "Done",
          category: "OTHER",
          severity: "LOW",
          status: "VERIFIED",
          serviceabilityImpact: "NONE",
        },
      ],
      lostFound: [{ id: U1 }],
    });
    const html = renderToStaticMarkup(await HousekeepingPage());
    expect(html).toContain("Tamu sedang pergi");
    expect(html).toContain("AC tidak dingin");
    expect(html).toContain("urgent");

    mocks.getActivePermissionCodes.mockResolvedValue(new Set());
    expect(renderToStaticMarkup(await HousekeepingPage())).toContain(
      "Akses dibatasi",
    );
  });

  it("renders legacy F&B states with simple operational labels and denies unrelated roles", async () => {
    mocks.getActivePermissionCodes.mockResolvedValue(
      new Set(["fnb.order.manage"]),
    );
    const statuses = [
      "ENTERED",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "SERVED",
      "COMPLETED",
      "CANCELLED",
    ];
    const orders = statuses.map((status, index) => ({
      id: `${index + 1}1111111-1111-4111-a111-111111111111`,
      orderCode: `FNB-${index}`,
      paperReference: `P-${index}`,
      settlementRoute: index % 2 ? "ROOM_CHARGE" : "STANDALONE",
      status,
      customerName: index === 0 ? "Budi" : null,
      roomStayId: index === 1 ? U1 : null,
      folioId: null,
      orderTotalIdr: "55000",
      paidAmountIdr: index === 0 ? "55000" : "0",
      receiptId: index === 0 ? U1 : null,
      receiptCode: index === 0 ? "FRC-001" : null,
      receiptStatus: index === 0 ? "ISSUED" : null,
      receiptRecipientName: index === 0 ? "Budi" : null,
      receiptIssuedAt: index === 0 ? new Date("2026-08-02T01:05:00Z") : null,
      notes: null,
      items: [
        {
          id: U1,
          name: "Nasi Goreng KOOKA",
          quantity: "2",
          unitPriceIdr: "25000",
          taxAmountIdr: "5000",
          serviceChargeAmountIdr: "0",
          discountAmountIdr: "0",
          totalIdr: "55000",
          notes: "Tidak pedas",
        },
      ],
      // Raw paginated SQL returns PostgreSQL timestamps as strings.
      createdAt: "2026-08-02T01:00:00.000Z",
    }));
    mocks.getFoodOrderQueue.mockResolvedValue(orders);
    mocks.getFoodOrderPage.mockResolvedValue({
      orders,
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: orders.length,
        totalPages: 1,
        from: 1,
        to: orders.length,
      },
    });
    const html = renderToStaticMarkup(await FnbPage());
    expect(html).toContain("FNB-0");
    expect(html).toContain("Tamu kamar");
    expect(html).toContain("standalone");
    expect(html).toContain("Nasi Goreng KOOKA");
    expect(html).toContain("Rp55.000");
    expect(html).toContain("Total tagihan");
    expect(html).toContain("Print invoice F&amp;B");
    expect(html).toContain("FRC-001");
    expect(html).toContain("Sedang diproses");
    expect(html).toContain("Selesai / disajikan");
    expect(html).toContain("Dibatalkan");

    mocks.getActivePermissionCodes.mockResolvedValue(new Set());
    expect(renderToStaticMarkup(await FnbPage())).toContain("Akses dibatasi");
  });
});
