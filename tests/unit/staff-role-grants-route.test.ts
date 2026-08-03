import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentSession,
  getActivePropertyId,
  grantUserRole,
  revokeUserRole,
} = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  grantUserRole: vi.fn(),
  revokeUserRole: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({ requireCurrentSession }));
vi.mock("../../src/platform/property", () => ({ getActivePropertyId }));
vi.mock("../../src/platform/rbac-admin", () => ({
  grantUserRole,
  revokeUserRole,
}));

import { AuthorizationError } from "../../src/platform/authorization";
import { DELETE, POST } from "../../app/api/staff/role-grants/route";

// Must be a real RFC 9562/4122 UUID (version nibble 1-8, variant nibble
// 8/9/a/b) -- the route's Zod schema validates `targetUserId` for real, so
// an all-`2`s placeholder like the ones other mocked-only test files use
// fails validation and masks every case below it with a spurious 400.
const TARGET_ID = "22222222-2222-4222-a222-222222222222";

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/staff/role-grants", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/staff/role-grants", () => {
  beforeEach(() => {
    requireCurrentSession.mockReset();
    getActivePropertyId.mockReset();
    grantUserRole.mockReset();
    revokeUserRole.mockReset();
  });

  it("default-denies with 401 when there is no session", async () => {
    requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );

    const response = await POST(
      jsonRequest("POST", {
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        reason: "Front office assignment",
      }),
    );

    expect(response.status).toBe(401);
    expect(grantUserRole).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with 400 before touching authorization", async () => {
    requireCurrentSession.mockResolvedValue({ user: { id: "actor-1" } });

    const response = await POST(
      jsonRequest("POST", { targetUserId: "not-a-uuid" }),
    );

    expect(response.status).toBe(400);
    expect(grantUserRole).not.toHaveBeenCalled();
  });

  it("returns 403 when the actor lacks identity.role.manage (including self-role-edit)", async () => {
    requireCurrentSession.mockResolvedValue({ user: { id: "actor-1" } });
    getActivePropertyId.mockResolvedValue("property-1");
    grantUserRole.mockRejectedValue(
      new AuthorizationError("Cannot modify your own role assignment"),
    );

    const response = await POST(
      jsonRequest("POST", {
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        reason: "Permission denial test",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("grants successfully for a permitted actor and never lets the client choose the property", async () => {
    requireCurrentSession.mockResolvedValue({ user: { id: "actor-1" } });
    getActivePropertyId.mockResolvedValue("property-1");
    grantUserRole.mockResolvedValue(undefined);

    const response = await POST(
      jsonRequest("POST", {
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        reason: "Front office assignment",
        propertyId: "client-supplied-property-should-be-ignored",
      }),
    );

    expect(response.status).toBe(200);
    expect(grantUserRole).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: "property-1" }),
    );
  });
});

describe("DELETE /api/staff/role-grants", () => {
  beforeEach(() => {
    requireCurrentSession.mockReset();
    getActivePropertyId.mockReset();
    revokeUserRole.mockReset();
  });

  it("default-denies with 401 when there is no session", async () => {
    requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );

    const response = await DELETE(
      jsonRequest("DELETE", {
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        reason: "Employment changed",
      }),
    );

    expect(response.status).toBe(401);
    expect(revokeUserRole).not.toHaveBeenCalled();
  });

  it("returns 403 on AuthorizationError", async () => {
    requireCurrentSession.mockResolvedValue({ user: { id: "actor-1" } });
    getActivePropertyId.mockResolvedValue("property-1");
    revokeUserRole.mockRejectedValue(
      new AuthorizationError("Missing permission: identity.role.manage"),
    );

    const response = await DELETE(
      jsonRequest("DELETE", {
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        reason: "Employment changed",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("revokes successfully for a permitted actor", async () => {
    requireCurrentSession.mockResolvedValue({ user: { id: "actor-1" } });
    getActivePropertyId.mockResolvedValue("property-1");
    revokeUserRole.mockResolvedValue(undefined);

    const response = await DELETE(
      jsonRequest("DELETE", {
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        reason: "Revoke role assignment",
      }),
    );

    expect(response.status).toBe(200);
  });
});
