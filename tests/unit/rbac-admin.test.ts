import { beforeEach, describe, expect, it, vi } from "vitest";

function selectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function insertChain() {
  const chain = {
    values: () => Promise.resolve(undefined),
  };
  return chain;
}

function updateChain(returning: unknown[]) {
  const chain = {
    set: () => chain,
    where: () => chain,
    returning: () => Promise.resolve(returning),
  };
  return chain;
}

const {
  select,
  insert,
  update,
  transaction,
  requirePermission,
  recordSecurityEvent,
  recordAuditEvent,
} = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  recordSecurityEvent: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ select, insert, update, transaction }),
}));
vi.mock("../../src/platform/audit", () => ({ recordAuditEvent }));
vi.mock("../../src/platform/authorization", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/platform/authorization")
  >("../../src/platform/authorization");
  return { ...actual, requirePermission };
});
vi.mock("../../src/platform/security-events", () => ({ recordSecurityEvent }));

import { AuthorizationError } from "../../src/platform/authorization";
import {
  grantUserRole,
  revokeUserRole,
  SelfRoleEditError,
} from "../../src/platform/rbac-admin";

const ACTOR_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "22222222-2222-2222-2222-222222222222";
const PROPERTY_ID = "33333333-3333-3333-3333-333333333333";
const ROLE_ID = "44444444-4444-4444-4444-444444444444";

const session = { user: { id: ACTOR_ID } };

describe("grantUserRole", () => {
  beforeEach(() => {
    select.mockReset();
    insert.mockReset();
    requirePermission.mockReset();
    recordSecurityEvent.mockReset();
    recordAuditEvent.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ select, insert, update }),
    );
  });

  it("rejects granting a role to yourself before even checking permission", async () => {
    await expect(
      grantUserRole({
        session,
        targetUserId: ACTOR_ID,
        roleCode: "OWNER",
        propertyId: PROPERTY_ID,
        reason: "Initial role setup",
      }),
    ).rejects.toBeInstanceOf(SelfRoleEditError);

    expect(requirePermission).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("propagates AuthorizationError from requirePermission without inserting a grant", async () => {
    requirePermission.mockRejectedValue(
      new AuthorizationError("Missing permission: identity.role.manage"),
    );

    await expect(
      grantUserRole({
        session,
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        propertyId: PROPERTY_ID,
        reason: "Front office assignment",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(insert).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("inserts the grant and records a security event when permitted", async () => {
    requirePermission.mockResolvedValue(undefined);
    select.mockImplementationOnce(() => selectChain([{ id: ROLE_ID }]));
    insert.mockImplementation(() => insertChain());

    await grantUserRole({
      session,
      targetUserId: TARGET_ID,
      roleCode: "FRONT_OFFICE",
      propertyId: PROPERTY_ID,
      reason: "Front office assignment",
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        category: "RBAC_ROLE_GRANTED",
        result: "SUCCESS",
        targetId: TARGET_ID,
      }),
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "identity.role.grant" }),
      expect.anything(),
    );
  });

  it("throws on an unknown role code instead of silently no-op-ing", async () => {
    requirePermission.mockResolvedValue(undefined);
    select.mockImplementationOnce(() => selectChain([]));

    await expect(
      grantUserRole({
        session,
        targetUserId: TARGET_ID,
        roleCode: "NOT_A_ROLE",
        propertyId: PROPERTY_ID,
        reason: "Invalid test role",
      }),
    ).rejects.toThrow(/Unknown role code/u);
  });
});

describe("revokeUserRole", () => {
  beforeEach(() => {
    select.mockReset();
    update.mockReset();
    requirePermission.mockReset();
    recordSecurityEvent.mockReset();
    recordAuditEvent.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ select, insert, update }),
    );
  });

  it("rejects revoking your own role before checking permission", async () => {
    await expect(
      revokeUserRole({
        session,
        targetUserId: ACTOR_ID,
        roleCode: "OWNER",
        propertyId: PROPERTY_ID,
        reason: "Self revoke test",
      }),
    ).rejects.toBeInstanceOf(SelfRoleEditError);

    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("closes the open grant and records a security event", async () => {
    requirePermission.mockResolvedValue(undefined);
    select.mockImplementationOnce(() => selectChain([{ id: ROLE_ID }]));
    update.mockImplementation(() => updateChain([{ userId: TARGET_ID }]));

    await revokeUserRole({
      session,
      targetUserId: TARGET_ID,
      roleCode: "FRONT_OFFICE",
      propertyId: PROPERTY_ID,
      reason: "Employment changed",
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "RBAC_ROLE_REVOKED",
        targetId: TARGET_ID,
      }),
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "identity.role.revoke" }),
      expect.anything(),
    );
  });

  it("throws when there is no active grant to revoke", async () => {
    requirePermission.mockResolvedValue(undefined);
    select.mockImplementationOnce(() => selectChain([{ id: ROLE_ID }]));
    update.mockImplementation(() => updateChain([]));

    await expect(
      revokeUserRole({
        session,
        targetUserId: TARGET_ID,
        roleCode: "FRONT_OFFICE",
        propertyId: PROPERTY_ID,
        reason: "No active grant test",
      }),
    ).rejects.toThrow(/No active grant found/u);

    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });
});
