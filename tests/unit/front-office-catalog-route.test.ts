import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFrontOfficeCatalog: vi.fn(),
  getActivePropertyId: vi.fn(),
  requireCurrentSession: vi.fn(),
  AuthorizationError: class extends Error {},
}));

vi.mock("../../src/modules/operations/front-office-catalog", () => ({
  getFrontOfficeCatalog: mocks.getFrontOfficeCatalog,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
}));

import { GET } from "../../app/api/staff/front-office/catalog/route";

const U1 = "11111111-1111-4111-a111-111111111111";

describe("Front Office catalogue route", () => {
  beforeEach(() => {
    mocks.getFrontOfficeCatalog.mockReset();
    mocks.getActivePropertyId.mockReset().mockResolvedValue(U1);
    mocks.requireCurrentSession
      .mockReset()
      .mockResolvedValue({ user: { id: U1 } });
  });

  it("returns the property-scoped catalogue", async () => {
    mocks.getFrontOfficeCatalog.mockResolvedValue({
      roomTypes: [{ roomTypeId: U1, nameId: "Deluxe" }],
      roomUnits: [{ id: U1, roomNumber: "1" }],
      ratePlans: [{ ratePlanId: U1, code: "BAR" }],
    });
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      roomTypes: [{ nameId: "Deluxe" }],
      roomUnits: [{ roomNumber: "1" }],
      ratePlans: [{ code: "BAR" }],
    });
    expect(mocks.getFrontOfficeCatalog).toHaveBeenCalledWith({
      session: { user: { id: U1 } },
      propertyId: U1,
    });
  });

  it("keeps unauthenticated and forbidden responses generic", async () => {
    mocks.requireCurrentSession.mockRejectedValueOnce(
      new Error("No authenticated staff session"),
    );
    expect((await GET()).status).toBe(401);

    mocks.getFrontOfficeCatalog.mockRejectedValueOnce(
      new mocks.AuthorizationError("denied"),
    );
    expect((await GET()).status).toBe(403);
  });
});
