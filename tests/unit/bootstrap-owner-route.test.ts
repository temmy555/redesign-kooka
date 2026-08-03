import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[]) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    where: () => link,
    limit: () => link,
    values: () => link,
    returning: () => link,
    onConflictDoNothing: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const { select, insert, execute, transaction, signUpEmail, recordAuditEvent } =
  vi.hoisted(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
    signUpEmail: vi.fn(),
    recordAuditEvent: vi.fn(),
  }));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ select, insert, execute, transaction }),
}));
vi.mock("../../src/platform/audit", () => ({ recordAuditEvent }));
vi.mock("../../src/platform/auth", () => ({
  getStaffProvisioningAuth: () => ({ api: { signUpEmail } }),
}));
vi.mock("../../src/platform/environment", () => ({
  parseApplicationEnvironment: () => ({
    OWNER_BOOTSTRAP_TOKEN: "bootstrap-token-at-least-32-characters-long",
  }),
}));

import { POST } from "../../app/api/setup/bootstrap-owner/route";

const validBody = {
  name: "KOOKA Owner",
  email: "Owner@Example.com",
  password: "very-secure-password",
  employeeCode: "OWNER-001",
  propertyCode: "KOOKA-SBY",
  propertyName: "KOOKA Residence Surabaya",
};

function request(token = "bootstrap-token-at-least-32-characters-long") {
  return new Request("http://localhost/api/setup/bootstrap-owner", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(validBody),
  });
}

describe("POST /api/setup/bootstrap-owner", () => {
  beforeEach(() => {
    select.mockReset();
    insert.mockReset();
    execute.mockReset().mockResolvedValue(undefined);
    transaction.mockReset();
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ select, insert, execute }),
    );
    signUpEmail.mockReset().mockResolvedValue(undefined);
    recordAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("hides the bootstrap route when the bearer token is missing or wrong", async () => {
    const response = await POST(request("wrong-token"));

    expect(response.status).toBe(404);
    expect(select).not.toHaveBeenCalled();
  });

  it("refuses to run again after an active Owner exists", async () => {
    select.mockReturnValueOnce(chain([{ userId: "owner-id" }]));

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "bootstrap_already_completed",
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("creates the first staff account, property, employee profile, Owner grant, and audit", async () => {
    select
      .mockReturnValueOnce(chain([])) // no existing Owner
      .mockReturnValueOnce(chain([])) // no existing user
      .mockReturnValueOnce(
        chain([{ id: "11111111-1111-4111-a111-111111111111" }]),
      ) // user created by Better Auth
      .mockReturnValueOnce(chain([])) // re-check Owner under advisory lock
      .mockReturnValueOnce(chain([])) // no active property
      .mockReturnValueOnce(
        chain([{ id: "33333333-3333-4333-a333-333333333333" }]),
      ); // OWNER role

    insert
      .mockReturnValueOnce(
        chain([{ id: "22222222-2222-4222-a222-222222222222" }]),
      ) // property
      .mockReturnValueOnce(chain([])) // employee profile
      .mockReturnValueOnce(chain([])); // role grant

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "Owner@Example.com",
        }),
      }),
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "identity.owner.bootstrap" }),
      expect.anything(),
    );
  });
});
