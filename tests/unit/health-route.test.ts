import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseHealth } = vi.hoisted(() => ({
  checkDatabaseHealth: vi.fn(),
}));
const { checkRedisHealth, checkOutboxHealth } = vi.hoisted(() => ({
  checkRedisHealth: vi.fn(),
  checkOutboxHealth: vi.fn(),
}));

vi.mock("../../src/db/health", () => ({ checkDatabaseHealth }));
vi.mock("../../src/platform/health", () => ({
  checkRedisHealth,
  checkOutboxHealth,
}));

import { GET } from "../../app/api/health/route";

const OK_REDIS = { status: "ok" as const, latencyMs: 1 };
const OK_OUTBOX = {
  status: "ok" as const,
  pendingCount: 0,
  oldestPendingAgeMs: null,
  deadLetterCount: 0,
};

describe("health/readiness route", () => {
  beforeEach(() => {
    checkDatabaseHealth.mockReset();
    checkRedisHealth.mockReset().mockResolvedValue(OK_REDIS);
    checkOutboxHealth.mockReset().mockResolvedValue(OK_OUTBOX);
  });

  it("returns ok when database, redis, and the outbox are all healthy", async () => {
    checkDatabaseHealth.mockResolvedValue({
      status: "connected",
      database: "kooka",
      schemaReady: true,
      latencyMs: 2,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      database: { status: "connected", schemaReady: true, latencyMs: 2 },
      redis: OK_REDIS,
      outbox: OK_OUTBOX,
    });
  });

  it("is 503 unhealthy -- and does not expose connection errors -- when the database is unreachable", async () => {
    checkDatabaseHealth.mockRejectedValue(
      new Error("secret connection detail"),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "unhealthy",
      database: { status: "unavailable" },
    });
    // A database outage should short-circuit before touching Redis/outbox.
    expect(checkRedisHealth).not.toHaveBeenCalled();
  });

  it("stays 200 but reports degraded when Redis is unavailable (Redis is non-authoritative)", async () => {
    checkDatabaseHealth.mockResolvedValue({
      status: "connected",
      database: "kooka",
      schemaReady: true,
      latencyMs: 2,
    });
    checkRedisHealth.mockResolvedValue({ status: "unavailable" });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      redis: { status: "unavailable" },
    });
  });

  it("reports degraded when the outbox is backlogged", async () => {
    checkDatabaseHealth.mockResolvedValue({
      status: "connected",
      database: "kooka",
      schemaReady: true,
      latencyMs: 2,
    });
    checkOutboxHealth.mockResolvedValue({
      status: "backlogged",
      pendingCount: 40,
      oldestPendingAgeMs: 10 * 60 * 1000,
      deadLetterCount: 2,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
    });
  });

  it("still responds 200 degraded (not a thrown error) if checkOutboxHealth itself rejects", async () => {
    checkDatabaseHealth.mockResolvedValue({
      status: "connected",
      database: "kooka",
      schemaReady: true,
      latencyMs: 2,
    });
    checkOutboxHealth.mockRejectedValue(new Error("outbox query failed"));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      outbox: {
        status: "backlogged",
        pendingCount: -1,
        deadLetterCount: -1,
      },
    });
  });
});
