import { describe, expect, it, vi } from "vitest";

import {
  getJakartaBusinessDate,
  runAutomaticDailyOperations,
} from "../../scripts/lib/daily-operations.mjs";

describe("automatic daily operations worker", () => {
  it("uses Jakarta time and a configurable rollover hour", () => {
    expect(getJakartaBusinessDate(new Date("2026-08-01T18:00:00Z"), 4)).toBe(
      "2026-08-01",
    );
    expect(getJakartaBusinessDate(new Date("2026-08-01T22:00:00Z"), 4)).toBe(
      "2026-08-02",
    );
    expect(() => getJakartaBusinessDate(new Date(), 24)).toThrow("0-23");
  });

  it("treats an existing business-day run as an idempotent replay", async () => {
    const client = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("INSERT INTO business_day_runs"))
          return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "property-1" }] }),
      connect: vi.fn().mockResolvedValue(client),
    };
    await expect(
      runAutomaticDailyOperations(pool, new Date("2026-08-02T00:00:00Z"), 4),
    ).resolves.toEqual([
      { propertyId: "property-1", businessDate: "2026-08-02", replayed: true },
    ]);
    expect(client.release).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });

  it("commits a clean system rollover with mandatory audit", async () => {
    const client = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("INSERT INTO business_day_runs"))
          return { rows: [{ id: "run-1" }], rowCount: 1 };
        if (statement.includes("INSERT INTO cleaning_tasks"))
          return { rows: [{ id: "task-1" }], rowCount: 1 };
        if (statement.includes("SELECT count(*)::integer"))
          return { rows: [{ count: 0 }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "property-1" }] }),
      connect: vi.fn().mockResolvedValue(client),
    };
    const result = await runAutomaticDailyOperations(
      pool,
      new Date("2026-08-02T00:00:00Z"),
      4,
    );
    expect(result[0]).toMatchObject({
      status: "COMPLETED",
      summary: { cleaningTasksCreated: 1, authoritativeDataMutated: false },
    });
    expect(
      client.query.mock.calls.some(([statement]) =>
        String(statement).includes("INSERT INTO audit_events"),
      ),
    ).toBe(true);
  });

  it("rolls back a failed property run and always releases the client", async () => {
    const client = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("pg_advisory_xact_lock"))
          throw new Error("database unavailable");
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "property-1" }] }),
      connect: vi.fn().mockResolvedValue(client),
    };
    await expect(runAutomaticDailyOperations(pool)).rejects.toThrow(
      "database unavailable",
    );
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
