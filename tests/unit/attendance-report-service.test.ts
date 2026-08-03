import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("../../src/db", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("../../src/platform/authorization", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/platform/authorization")>();
  return { ...original, requirePermission: mocks.requirePermission };
});

import { getAttendanceReport } from "../../src/modules/attendance/attendance-service";

const USER_ID = "11111111-1111-4111-a111-111111111111";
const PROPERTY_ID = "22222222-2222-4222-a222-222222222222";

describe("attendance report pagination", () => {
  beforeEach(() => {
    mocks.getDatabase.mockReset();
    mocks.requirePermission.mockReset().mockResolvedValue(undefined);
  });

  it("normalizes raw PostgreSQL timestamp strings returned by paged SQL", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            activeEmployees: "2",
            present: "1",
            working: "1",
            missingCheckout: "0",
            needsReview: "0",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            employeeId: USER_ID,
            employeeCode: "UAT-OWNER",
            employeeName: "UAT Owner",
            sessionId: "33333333-3333-4333-a333-333333333333",
            businessDate: "2026-08-03",
            status: "OPEN",
            checkedInAt: "2026-08-03T08:15:00.000Z",
            checkedOutAt: null,
            durationMinutes: null,
            locationName: "KOOKA",
            geofenceResult: "INSIDE",
          },
        ],
      });
    mocks.getDatabase.mockReturnValue({ execute });

    const report = await getAttendanceReport({
      session: { user: { id: USER_ID } },
      propertyId: PROPERTY_ID,
      startDate: "2026-08-03",
      endDate: "2026-08-03",
      page: 1,
      pageSize: 25,
      now: new Date("2026-08-03T10:00:00.000Z"),
    });

    expect(report.rows).toEqual([
      expect.objectContaining({
        checkedInAt: "2026-08-03T08:15:00.000Z",
        checkedOutAt: null,
        status: "Sedang bekerja",
      }),
    ]);
    expect(report.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 1,
    });
  });
});
