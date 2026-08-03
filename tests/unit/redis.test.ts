import { beforeEach, describe, expect, it, vi } from "vitest";

const { IORedisMock, ctorCalls } = vi.hoisted(() => {
  const ctorCalls: unknown[][] = [];
  class IORedisMock {
    constructor(...args: unknown[]) {
      ctorCalls.push(args);
    }
  }
  return { IORedisMock, ctorCalls };
});

vi.mock("ioredis", () => ({ default: IORedisMock }));
vi.mock("../../src/platform/environment", () => ({
  parseApplicationEnvironment: () => ({ REDIS_URL: "redis://127.0.0.1:6379" }),
}));

import { createRedisConnection } from "../../src/platform/redis";

describe("createRedisConnection", () => {
  beforeEach(() => {
    ctorCalls.length = 0;
  });

  it("sets maxRetriesPerRequest: null for BullMQ connections, per BullMQ's own requirement", () => {
    createRedisConnection({ forBullMq: true });

    const [, options] = ctorCalls.at(0) as [string, Record<string, unknown>];
    expect(options.maxRetriesPerRequest).toBeNull();
  });

  it("uses a finite retry budget for non-BullMQ connections", () => {
    createRedisConnection();

    const [, options] = ctorCalls.at(0) as [string, Record<string, unknown>];
    expect(options.maxRetriesPerRequest).toBe(20);
  });

  it("is a factory: each call returns a distinct connection instance", () => {
    const a = createRedisConnection();
    const b = createRedisConnection();
    expect(a).not.toBe(b);
    expect(ctorCalls).toHaveLength(2);
  });
});
