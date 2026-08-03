import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(resolveValue: unknown) {
  const link: Record<string, unknown> = {
    values: (v: unknown) => {
      link.lastValues = v;
      return link;
    },
    lastValues: undefined as unknown,
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
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }),
}));

import {
  recordAuditEvent,
  recordBestEffortAuditEvent,
} from "../../src/platform/audit";

describe("recordAuditEvent", () => {
  beforeEach(() => {
    insert.mockReset();
    loggerError.mockReset();
  });

  it("redacts sensitive fields in before/after/deviceMetadata before writing", async () => {
    const link = chain(undefined);
    insert.mockReturnValueOnce(link);

    await recordAuditEvent({
      actorUserId: "user-1",
      actorType: "user",
      action: "guest.profile.update",
      targetType: "guest",
      targetId: "guest-1",
      before: { password: "old-secret", name: "Budi" },
      after: { password: "new-secret", name: "Budi" },
      deviceMetadata: { apiKey: "abc", userAgent: "curl" },
      result: "SUCCESS",
    });

    const values = link.lastValues as Record<string, unknown>;
    expect(values.beforeJson).toEqual({ password: "[redacted]", name: "Budi" });
    expect(values.afterJson).toEqual({ password: "[redacted]", name: "Budi" });
    expect(values.deviceMetadata).toEqual({
      apiKey: "[redacted]",
      userAgent: "curl",
    });
  });

  it("fails closed when a mandatory audit write fails", async () => {
    insert.mockImplementationOnce(() => {
      throw new Error("db unavailable");
    });

    await expect(
      recordAuditEvent({
        actorType: "system",
        action: "outbox.dead-letter",
        targetType: "outbox_event",
        result: "FAILURE",
      }),
    ).rejects.toThrow("db unavailable");

    expect(loggerError).not.toHaveBeenCalled();
  });

  it("keeps best-effort behavior explicit for non-authoritative diagnostics", async () => {
    insert.mockImplementationOnce(() => {
      throw new Error("db unavailable");
    });

    await expect(
      recordBestEffortAuditEvent({
        actorType: "system",
        action: "diagnostic.sample",
        targetType: "system",
        result: "FAILURE",
      }),
    ).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("passes null through for omitted optional fields rather than undefined", async () => {
    const link = chain(undefined);
    insert.mockReturnValueOnce(link);

    await recordAuditEvent({
      actorType: "system",
      action: "system.startup",
      targetType: "system",
      result: "SUCCESS",
    });

    const values = link.lastValues as Record<string, unknown>;
    expect(values.actorUserId).toBeNull();
    expect(values.beforeJson).toBeNull();
    expect(values.afterJson).toBeNull();
  });
});
