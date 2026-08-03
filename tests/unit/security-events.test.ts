import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(resolveValue: unknown, recorder: Record<string, unknown> = {}) {
  const link: Record<string, unknown> = {
    values: (values: unknown) => {
      recorder.values = values;
      return link;
    },
    then: (resolve: (value: unknown) => void) => resolve(resolveValue),
  };
  return link;
}

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }));
vi.mock("../../src/db", () => ({ getDatabase: () => ({ insert }) }));
vi.mock("../../src/platform/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerError,
    child: vi.fn(),
  }),
}));

import { recordSecurityEvent } from "../../src/platform/security-events";

describe("recordSecurityEvent", () => {
  beforeEach(() => {
    insert.mockReset();
    loggerError.mockReset();
  });

  it("inserts a security event, defaulting severity to INFO", async () => {
    insert.mockReturnValueOnce(chain(undefined));

    await recordSecurityEvent({
      actorUserId: "user-1",
      category: "AUTH_SESSION_CREATED",
      result: "SUCCESS",
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("is best-effort: a write failure is swallowed, never thrown", async () => {
    insert.mockImplementationOnce(() => {
      throw new Error("db unavailable");
    });

    await expect(
      recordSecurityEvent({
        actorUserId: null,
        category: "AUTH_SESSION_REVOKED",
        result: "FAILURE",
      }),
    ).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalled();
  });

  it("redacts sensitive detail fields before persistence", async () => {
    const recorder: Record<string, unknown> = {};
    insert.mockReturnValueOnce(chain(undefined, recorder));

    await recordSecurityEvent({
      actorUserId: "user-1",
      category: "AUTH_TEST",
      result: "FAILURE",
      details: { password: "secret", reason: "invalid credential" },
    });

    expect(recorder.values).toMatchObject({
      details: { password: "[redacted]", reason: "invalid credential" },
    });
  });
});
