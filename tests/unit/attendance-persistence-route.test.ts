import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getSelfAttendance: vi.fn(),
  getAttendanceReport: vi.fn(),
  recordAttendance: vi.fn(),
  saveStoredFile: vi.fn(),
  runMalwareScan: vi.fn(),
  purgeStoredFile: vi.fn(),
  noopMalwareScanner: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/modules/attendance/attendance-service", () => ({
  getSelfAttendance: mocks.getSelfAttendance,
  getAttendanceReport: mocks.getAttendanceReport,
  recordAttendance: mocks.recordAttendance,
}));
vi.mock("../../src/platform/file-storage", () => ({
  saveStoredFile: mocks.saveStoredFile,
  runMalwareScan: mocks.runMalwareScan,
  purgeStoredFile: mocks.purgeStoredFile,
  noopMalwareScanner: mocks.noopMalwareScanner,
}));

import { GET, POST } from "../../app/api/staff/attendance/route";

const USER_ID = "11111111-1111-4111-a111-111111111111";
const PROPERTY_ID = "22222222-2222-4222-a222-222222222222";
const FILE_ID = "33333333-3333-4333-a333-333333333333";

function clockRequest(idempotencyKey = "attendance-key") {
  const form = new FormData();
  form.set("action", "CHECK_IN");
  form.set("latitude", "-7.285");
  form.set("longitude", "112.68");
  form.set("accuracyMeters", "12");
  form.set("deviceTime", "2026-08-03T09:00:00.000Z");
  form.set(
    "selfie",
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "selfie.jpg", {
      type: "image/jpeg",
    }),
  );
  return new Request("http://localhost/api/staff/attendance", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: form,
  });
}

describe("attendance persistence route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getActivePropertyId.mockResolvedValue(PROPERTY_ID);
    mocks.getSelfAttendance.mockResolvedValue({ today: null, history: [] });
    mocks.getAttendanceReport.mockResolvedValue({ rows: [] });
    mocks.saveStoredFile.mockResolvedValue({ id: FILE_ID });
    mocks.runMalwareScan.mockResolvedValue("CLEAN");
    mocks.purgeStoredFile.mockResolvedValue(undefined);
    mocks.recordAttendance.mockResolvedValue({
      eventId: "44444444-4444-4444-a444-444444444444",
      action: "CHECK_IN",
      selfieFileId: FILE_ID,
    });
  });

  it("loads self attendance and an authorized report", async () => {
    expect(
      (await GET(new Request("http://localhost/api/staff/attendance"))).status,
    ).toBe(200);
    expect(
      (
        await GET(
          new Request(
            "http://localhost/api/staff/attendance?view=report&startDate=2026-07-28&endDate=2026-08-03",
          ),
        )
      ).status,
    ).toBe(200);
    expect(mocks.getSelfAttendance).toHaveBeenCalledWith({
      session: { user: { id: USER_ID } },
      propertyId: PROPERTY_ID,
    });
    expect(mocks.getAttendanceReport).toHaveBeenCalledWith({
      session: { user: { id: USER_ID } },
      propertyId: PROPERTY_ID,
      startDate: "2026-07-28",
      endDate: "2026-08-03",
      page: 1,
      pageSize: 25,
      search: "",
      exportAll: false,
    });
  });

  it("requires both report range dates when one is supplied", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/staff/attendance?view=report&startDate=2026-08-03",
      ),
    );
    expect(response.status).toBe(400);
    expect(mocks.getAttendanceReport).not.toHaveBeenCalled();
  });

  it("stores and scans the selfie before recording the event", async () => {
    const response = await POST(clockRequest());
    expect(response.status).toBe(201);
    expect(mocks.saveStoredFile).toHaveBeenCalledOnce();
    expect(mocks.runMalwareScan).toHaveBeenCalledWith(
      FILE_ID,
      mocks.noopMalwareScanner,
    );
    expect(mocks.recordAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: PROPERTY_ID,
        input: expect.objectContaining({
          action: "CHECK_IN",
          selfieFileId: FILE_ID,
          idempotencyKey: "attendance-key",
        }),
      }),
    );
    expect(mocks.purgeStoredFile).not.toHaveBeenCalled();
  });

  it("purges the uploaded selfie when the attendance mutation fails", async () => {
    mocks.recordAttendance.mockRejectedValue(new Error("database unavailable"));
    const response = await POST(clockRequest());
    expect(response.status).toBe(500);
    expect(mocks.purgeStoredFile).toHaveBeenCalledWith(FILE_ID, USER_ID);
  });

  it("requires an idempotency key before storing a selfie", async () => {
    const response = await POST(clockRequest(""));
    expect(response.status).toBe(400);
    expect(mocks.saveStoredFile).not.toHaveBeenCalled();
  });
});
