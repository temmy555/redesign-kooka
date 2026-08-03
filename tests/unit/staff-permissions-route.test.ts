import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCurrentSession, getActivePermissionCodes, getActivePropertyId } =
  vi.hoisted(() => ({
    requireCurrentSession: vi.fn(),
    getActivePermissionCodes: vi.fn(),
    getActivePropertyId: vi.fn(),
  }));

vi.mock("../../src/platform/session", () => ({ requireCurrentSession }));
vi.mock("../../src/platform/authorization", () => ({
  getActivePermissionCodes,
}));
vi.mock("../../src/platform/property", () => ({ getActivePropertyId }));

import { GET } from "../../app/api/staff/me/permissions/route";

describe("GET /api/staff/me/permissions", () => {
  beforeEach(() => {
    requireCurrentSession.mockReset();
    getActivePermissionCodes.mockReset();
    getActivePropertyId.mockReset();
  });

  it("default-denies with 401 when there is no session, without ever resolving permissions", async () => {
    requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getActivePermissionCodes).not.toHaveBeenCalled();
  });

  it("returns only the caller's own resolved permissions when authenticated", async () => {
    requireCurrentSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "session-1" },
    });
    getActivePropertyId.mockResolvedValue("property-1");
    getActivePermissionCodes.mockResolvedValue(
      new Set(["fnb.order.manage", "attendance.self.view"]),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getActivePermissionCodes).toHaveBeenCalledWith(
      "user-1",
      "property-1",
    );
    expect(body).toEqual({
      userId: "user-1",
      propertyId: "property-1",
      permissions: ["attendance.self.view", "fnb.order.manage"],
    });
  });
});
