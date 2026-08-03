import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(resolveValue: unknown) {
  const link: Record<string, unknown> = {
    from: () => link,
    where: () => link,
    then: (resolve: (value: unknown) => void) => resolve(resolveValue),
  };
  return link;
}

const { select } = vi.hoisted(() => ({ select: vi.fn() }));
const { ping, disconnect } = vi.hoisted(() => ({
  ping: vi.fn(),
  disconnect: vi.fn(),
}));
const { createRedisConnection } = vi.hoisted(() => ({
  createRedisConnection: vi.fn(() => ({ ping, disconnect })),
}));

vi.mock("../../src/db", () => ({ getDatabase: () => ({ select }) }));
vi.mock("../../src/platform/redis", () => ({ createRedisConnection }));

import { checkOutboxHealth, checkRedisHealth } from "../../src/platform/health";

describe("checkRedisHealth", () => {
  beforeEach(() => {
    ping.mockReset();
    disconnect.mockReset();
    createRedisConnection.mockClear();
  });

  it("reports ok with a latency when Redis responds to PING", async () => {
    ping.mockResolvedValue("PONG");
    const result = await checkRedisHealth();
    expect(result.status).toBe("ok");
    expect(typeof result.latencyMs).toBe("number");
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable, without throwing, when Redis is unreachable", async () => {
    ping.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await checkRedisHealth();
    expect(result).toEqual({ status: "unavailable" });
  });
});

describe("checkOutboxHealth", () => {
  beforeEach(() => {
    select.mockReset();
  });

  it("reports ok when there is no old backlog", async () => {
    select
      .mockReturnValueOnce(chain([{ count: 2, oldest: new Date() }]))
      .mockReturnValueOnce(chain([{ count: 0 }]));

    const result = await checkOutboxHealth();

    expect(result.status).toBe("ok");
    expect(result.pendingCount).toBe(2);
    expect(result.deadLetterCount).toBe(0);
  });

  it("reports backlogged when the oldest pending row is older than the threshold", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    select
      .mockReturnValueOnce(chain([{ count: 40, oldest: tenMinutesAgo }]))
      .mockReturnValueOnce(chain([{ count: 3 }]));

    const result = await checkOutboxHealth();

    expect(result.status).toBe("backlogged");
    expect(result.deadLetterCount).toBe(3);
  });

  it("reports ok with a null age when the outbox is empty", async () => {
    select
      .mockReturnValueOnce(chain([{ count: 0, oldest: null }]))
      .mockReturnValueOnce(chain([{ count: 0 }]));

    const result = await checkOutboxHealth();

    expect(result.status).toBe("ok");
    expect(result.oldestPendingAgeMs).toBeNull();
  });
});
