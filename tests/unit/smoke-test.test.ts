import { describe, expect, it, vi } from "vitest";

import {
  runSmokeTests,
  smokeConfiguration,
} from "../../scripts/smoke-test.mjs";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successfulFetch() {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(input instanceof URL ? input : String(input));
    if (url.pathname === "/api/health") {
      return json({
        status: "degraded",
        database: { status: "connected", schemaReady: true, latencyMs: 3 },
        redis: { status: "unavailable" },
        outbox: {
          status: "ok",
          pendingCount: 0,
          oldestPendingAgeMs: null,
          deadLetterCount: 0,
        },
      });
    }
    if (url.pathname === "/api/content/landing") {
      return json({
        locale: "en",
        property: { name: "KOOKA Residence" },
        sections: [{ key: "hero" }],
        rooms: [{ id: "room-type" }],
      });
    }
    if (url.pathname === "/api/content/menu") {
      return json({ locale: "en", categories: [{ items: [{ id: "item" }] }] });
    }
    if (url.pathname === "/api/booking/availability")
      return json({ roomTypes: [] });
    if (url.pathname === "/staff/login")
      return new Response("KOOKA staff login");
    if (url.pathname === "/") return new Response("KOOKA Residence landing");
    return new Response("not found", { status: 404 });
  });
}

describe("automated smoke test", () => {
  it("validates the read-only critical path and allows optional Redis", async () => {
    const configuration = smokeConfiguration([], {
      SMOKE_BASE_URL: "http://localhost:3000",
    });
    const report = await runSmokeTests(configuration, successfulFetch());

    expect(report.passed).toBe(true);
    expect(report.results).toHaveLength(6);
    expect(report.warnings).toContain(
      "Redis is unavailable (allowed because Redis is optional)",
    );
  });

  it("fails when the worker outbox has stopped draining", async () => {
    const fetchImpl = successfulFetch();
    fetchImpl.mockImplementationOnce(async () =>
      json({
        status: "degraded",
        database: { status: "connected", schemaReady: true },
        redis: { status: "unavailable" },
        outbox: { status: "backlogged", deadLetterCount: 0 },
      }),
    );
    const report = await runSmokeTests(
      smokeConfiguration([], { SMOKE_BASE_URL: "http://localhost:3000" }),
      fetchImpl,
    );

    expect(report.passed).toBe(false);
    expect(report.results[0]).toMatchObject({
      status: "FAIL",
      detail: "worker/outbox is backlogged",
    });
  });

  it("can explicitly assert that maintenance mode is active", async () => {
    const fetchImpl = successfulFetch();
    fetchImpl.mockImplementation(async (input: URL | RequestInfo) => {
      const url = new URL(input instanceof URL ? input : String(input));
      if (url.pathname === "/api/booking/availability") {
        return json(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "The website is currently under maintenance",
            },
          },
          503,
        );
      }
      if (url.pathname === "/") {
        return new Response("KOOKA Website Under Maintenance", { status: 503 });
      }
      return successfulFetch()(input);
    });
    const report = await runSmokeTests(
      smokeConfiguration([], {
        SMOKE_BASE_URL: "https://kooka.example",
        SMOKE_EXPECT_MAINTENANCE: "on",
      }),
      fetchImpl,
    );

    expect(report.passed).toBe(true);
    expect(
      report.results.find(
        (result) => result.name === "Read-only room availability",
      )?.detail,
    ).toBe("public booking search is blocked as expected during maintenance");
    expect(report.results.at(-1)?.detail).toBe("maintenance page is active");
  });
});
