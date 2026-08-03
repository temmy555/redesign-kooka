import { NextResponse } from "next/server";

import { checkDatabaseHealth } from "../../../src/db/health";
import {
  checkOutboxHealth,
  checkRedisHealth,
} from "../../../src/platform/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health/readiness endpoint (Roadmap Langkah 8), per
 * docs/TECHNICAL-ARCHITECTURE.md §7. The database is treated as critical:
 * if it's unreachable the whole response is 503 "unhealthy", since nothing
 * in this application can function without it. Redis/the outbox are
 * non-authoritative (§4) -- if either is unwell the process is still up and
 * able to serve booking-critical work, so the response stays 200 with an
 * overall "degraded" status rather than failing readiness entirely.
 */
export async function GET() {
  let database;
  try {
    database = await checkDatabaseHealth();
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: { status: "unavailable" },
      },
      { status: 503 },
    );
  }

  const [redis, outbox] = await Promise.all([
    checkRedisHealth(),
    checkOutboxHealth().catch(() => ({
      status: "backlogged" as const,
      pendingCount: -1,
      oldestPendingAgeMs: null,
      deadLetterCount: -1,
    })),
  ]);

  const degraded = redis.status !== "ok" || outbox.status !== "ok";

  return NextResponse.json({
    status: degraded ? "degraded" : "ok",
    database: {
      status: database.status,
      schemaReady: database.schemaReady,
      latencyMs: database.latencyMs,
    },
    redis,
    outbox,
  });
}
