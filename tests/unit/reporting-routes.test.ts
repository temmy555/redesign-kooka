import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getOperationalDashboard: vi.fn(),
  runDailyRollover: vi.fn(),
  runReconciliation: vi.fn(),
  updateReconciliationException: vi.fn(),
  createExcelReportExport: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/modules/reporting/reporting-service", () => ({
  getOperationalDashboard: mocks.getOperationalDashboard,
  runDailyRollover: mocks.runDailyRollover,
  runReconciliation: mocks.runReconciliation,
  updateReconciliationException: mocks.updateReconciliationException,
  createExcelReportExport: mocks.createExcelReportExport,
}));

import { GET, POST } from "../../app/api/staff/reports/route";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";

function request(body: unknown, key = "reporting-test-key") {
  return new Request("http://localhost/api/staff/reports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Batch 6 reporting route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.getActivePropertyId.mockResolvedValue(U2);
    mocks.getOperationalDashboard.mockResolvedValue({ summary: {} });
    mocks.runDailyRollover.mockResolvedValue({ status: "COMPLETED" });
    mocks.runReconciliation.mockResolvedValue({ detected: 0 });
    mocks.updateReconciliationException.mockResolvedValue({
      status: "RESOLVED",
    });
    mocks.createExcelReportExport.mockResolvedValue({
      reportExportId: U1,
      filename: "report.xlsx",
      sheetName: "Booking",
      title: "Laporan Booking",
      subtitle: "Periode UAT",
      headers: ["Kode booking", "Status"],
      columnWidths: [24, 18],
      rows: [["KR-001", "CONFIRMED"]],
      rowCount: 1,
    });
  });

  it("returns the dashboard with optional business and reporting dates", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/staff/reports?businessDate=2026-08-01&rangeStart=2026-08-01&rangeEnd=2026-08-02",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.getOperationalDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: U2,
        businessDate: "2026-08-01",
        rangeEnd: "2026-08-02",
      }),
    );
  });

  it.each([
    [
      { action: "RUN_DAILY_ROLLOVER", businessDate: "2026-08-01" },
      "runDailyRollover",
    ],
    [
      { action: "RUN_RECONCILIATION", businessDate: "2026-08-01" },
      "runReconciliation",
    ],
    [
      {
        action: "UPDATE_EXCEPTION",
        exceptionId: U1,
        transition: "RESOLVE",
        reason: "Source data corrected",
      },
      "updateReconciliationException",
    ],
  ])("dispatches reporting mutation", async (body, service) => {
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("downloads a real Excel workbook privately with export metadata", async () => {
    const response = await POST(
      request({
        action: "EXPORT_EXCEL",
        reportCode: "BOOKINGS",
        rangeStart: "2026-08-01",
        rangeEnd: "2026-08-02",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-report-export-id")).toBe(U1);
    expect(
      Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 4)),
    ).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("rejects missing idempotency, bad payload, and unauthenticated access", async () => {
    expect(
      (await POST(request({ action: "RUN_RECONCILIATION" }, ""))).status,
    ).toBe(400);
    expect((await POST(request({ action: "UNKNOWN" }))).status).toBe(400);
    mocks.requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );
    expect(
      (await GET(new Request("http://localhost/api/staff/reports"))).status,
    ).toBe(401);
  });

  it("normalizes unexpected failures", async () => {
    mocks.getOperationalDashboard.mockRejectedValue(
      new Error("private detail"),
    );
    const response = await GET(
      new Request("http://localhost/api/staff/reports"),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
    );
  });
});
