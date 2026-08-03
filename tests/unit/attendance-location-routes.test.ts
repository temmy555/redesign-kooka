import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getAttendanceLocationOverview: vi.fn(),
  createAttendanceLocation: vi.fn(),
  updateAttendanceLocation: vi.fn(),
  setAttendanceLocationStatus: vi.fn(),
  getEligibleAttendanceLocations: vi.fn(),
  checkAttendanceLocation: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/modules/attendance/location-service", () => ({
  getAttendanceLocationOverview: mocks.getAttendanceLocationOverview,
  createAttendanceLocation: mocks.createAttendanceLocation,
  updateAttendanceLocation: mocks.updateAttendanceLocation,
  setAttendanceLocationStatus: mocks.setAttendanceLocationStatus,
  getEligibleAttendanceLocations: mocks.getEligibleAttendanceLocations,
  checkAttendanceLocation: mocks.checkAttendanceLocation,
}));

import {
  GET as adminGet,
  POST as adminPost,
} from "../../app/api/staff/admin/attendance-locations/route";
import {
  GET as employeeGet,
  POST as employeePost,
} from "../../app/api/staff/attendance/locations/route";

const USER_ID = "11111111-1111-4111-a111-111111111111";
const PROPERTY_ID = "22222222-2222-4222-a222-222222222222";
const LOCATION_ID = "33333333-3333-4333-a333-333333333333";

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const locationInput = {
  code: "KOOKA-MAIN",
  name: "KOOKA Residence Surabaya",
  latitude: -7.285,
  longitude: 112.68,
  radiusMeters: 50,
  maximumAccuracyMeters: 60,
  effectiveFrom: "2026-08-03T00:00:00+07:00",
  effectiveTo: null,
  reason: "Titik absensi utama",
};

describe("attendance location routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks))
      mock.mockReset().mockResolvedValue({ ok: true });
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getActivePropertyId.mockResolvedValue(PROPERTY_ID);
  });

  it("returns admin and employee location views", async () => {
    expect((await adminGet()).status).toBe(200);
    expect((await employeeGet()).status).toBe(200);
    expect(mocks.getAttendanceLocationOverview).toHaveBeenCalledWith({
      session: { user: { id: USER_ID } },
      propertyId: PROPERTY_ID,
    });
    expect(mocks.getEligibleAttendanceLocations).toHaveBeenCalledWith({
      session: { user: { id: USER_ID } },
      propertyId: PROPERTY_ID,
    });
  });

  it.each([
    [
      { action: "CREATE_LOCATION", input: locationInput },
      "createAttendanceLocation",
      201,
    ],
    [
      {
        action: "UPDATE_LOCATION",
        locationId: LOCATION_ID,
        input: locationInput,
      },
      "updateAttendanceLocation",
      200,
    ],
    [
      {
        action: "SET_LOCATION_STATUS",
        locationId: LOCATION_ID,
        status: "INACTIVE",
        reason: "Lokasi sementara ditutup",
      },
      "setAttendanceLocationStatus",
      200,
    ],
  ])("handles %s", async (body, mockName, status) => {
    const response = await adminPost(
      request("/api/staff/admin/attendance-locations", body),
    );
    expect(response.status).toBe(status);
    expect(mocks[mockName as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("rejects invalid coordinates before calling the service", async () => {
    const response = await adminPost(
      request("/api/staff/admin/attendance-locations", {
        action: "CREATE_LOCATION",
        input: { ...locationInput, latitude: 180 },
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.createAttendanceLocation).not.toHaveBeenCalled();
  });

  it("passes precise device coordinates to the server-side check", async () => {
    const position = {
      latitude: -7.285123,
      longitude: 112.681234,
      accuracyMeters: 18.5,
    };
    const response = await employeePost(
      request("/api/staff/attendance/locations", position),
    );
    expect(response.status).toBe(200);
    expect(mocks.checkAttendanceLocation).toHaveBeenCalledWith({
      session: { user: { id: USER_ID } },
      propertyId: PROPERTY_ID,
      position,
    });
  });

  it("returns 401 when no staff session exists", async () => {
    mocks.requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );
    expect((await adminGet()).status).toBe(401);
    expect((await employeeGet()).status).toBe(401);
  });
});
