import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentSession,
  getActivePropertyId,
  requirePermission,
  getStaffProvisioningAuth,
  recordAuditEvent,
} = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  requirePermission: vi.fn(),
  getStaffProvisioningAuth: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

const { select, insert, transaction, signUpEmail } = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
  signUpEmail: vi.fn(),
}));

function chain(rows: unknown[]) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    where: () => link,
    limit: () => link,
    values: () => link,
    returning: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

vi.mock("../../src/platform/session", () => ({ requireCurrentSession }));
vi.mock("../../src/platform/property", () => ({ getActivePropertyId }));
vi.mock("../../src/platform/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requirePermission,
}));
vi.mock("../../src/platform/auth", () => ({
  getStaffProvisioningAuth: () => ({ api: { signUpEmail } }),
}));
vi.mock("../../src/db", () => ({
  getDatabase: () => ({
    select,
    insert,
    transaction,
  }),
}));
vi.mock("../../src/platform/audit", () => ({ recordAuditEvent }));

import { AuthorizationError } from "../../src/platform/authorization";
import { POST } from "../../app/api/staff/admin/users/route";

const validBody = {
  action: "CREATE_STAFF" as const,
  name: "Nina Staff",
  email: "nina@kooka.test",
  password: "very-secure-password",
  employeeCode: "FO-001",
  reason: "Add front office",
};

function request(body: Record<string, unknown> = validBody) {
  return new Request("http://localhost/api/staff/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/staff/admin/users", () => {
  beforeEach(() => {
    for (const mock of [
      requireCurrentSession,
      getActivePropertyId,
      requirePermission,
      getStaffProvisioningAuth,
      recordAuditEvent,
      signUpEmail,
      select,
      insert,
      transaction,
    ]) {
      mock.mockReset();
    }

    requireCurrentSession.mockResolvedValue({ user: { id: "actor-1" } });
    getActivePropertyId.mockResolvedValue("property-1");
    requirePermission.mockResolvedValue(undefined);
    getStaffProvisioningAuth.mockReturnValue({ api: { signUpEmail } });
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ select, insert }),
    );
    insert.mockReturnValue(chain([]));
    insert.mockName("insert");
    signUpEmail.mockResolvedValue(undefined);
    recordAuditEvent.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no authenticated session", async () => {
    requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("unauthenticated");
  });

  it("returns 403 when the actor lacks identity.employee.manage", async () => {
    requirePermission.mockRejectedValue(
      new AuthorizationError("Missing permission: identity.employee.manage"),
    );

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("rejects malformed payloads", async () => {
    const response = await POST(
      request({
        action: "CREATE_STAFF",
        name: "No",
        email: "bad-email",
        password: "short",
        employeeCode: "",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a new staff account and profile when the email is new", async () => {
    const sessionId = "actor-1";
    requireCurrentSession.mockResolvedValue({ user: { id: sessionId } });
    select
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: "staff-user-id", status: "ACTIVE" }]))
      .mockReturnValueOnce(chain([]));

    const response = await POST(request(validBody));
    const body = (await response.json()) as { status: string; userId: string };

    expect(response.status).toBe(201);
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: validBody.email }),
      }),
    );
    expect(body.status).toBe("created");
    expect(body.userId).toBe("staff-user-id");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "identity.staff.create",
        actorUserId: sessionId,
        targetId: "staff-user-id",
      }),
      expect.anything(),
    );
  });

  it("rejects creating staff when user is already configured as staff", async () => {
    select
      .mockReturnValueOnce(
        chain([{ id: "staff-user-id", status: "ACTIVE" }]),
      )
      .mockReturnValueOnce(
        chain([{ id: "existing-profile-id", propertyId: "property-1" }]),
      );
    const response = await POST(request());
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CONFLICT");
  });
});
