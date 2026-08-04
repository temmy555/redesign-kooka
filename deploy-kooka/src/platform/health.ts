import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDatabase } from "../db";
import { outboxEvents } from "../db/schema";
import { createRedisConnection } from "./redis";

/**
 * Redis and outbox/queue-age health checks (Roadmap Langkah 8), extending
 * the existing database health check (src/db/health.ts) toward
 * docs/TECHNICAL-ARCHITECTURE.md §7's "health checks untuk web, db, redis,
 * worker, queue age, disk, dan backup". Disk and backup checks are
 * deployment/ops concerns outside this application's process and are left
 * for the deployment step; this module covers what the running app process
 * can meaningfully self-report.
 */

export interface RedisHealth {
  status: "ok" | "unavailable";
  latencyMs?: number;
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  let connection: ReturnType<typeof createRedisConnection>;
  try {
    connection = createRedisConnection();
  } catch {
    return { status: "unavailable" };
  }

  try {
    const startedAt = performance.now();
    await connection.ping();
    return {
      status: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return { status: "unavailable" };
  } finally {
    connection.disconnect();
  }
}

export interface OutboxHealth {
  status: "ok" | "backlogged";
  pendingCount: number;
  oldestPendingAgeMs: number | null;
  deadLetterCount: number;
}

/** A pending row older than this is treated as a worker/queue problem, not
 * normal processing latency (the default drain tick runs every 5s). */
const BACKLOG_AGE_THRESHOLD_MS = 5 * 60 * 1000;

export async function checkOutboxHealth(): Promise<OutboxHealth> {
  const db = getDatabase();
  const [pending] = await db
    .select({
      count: sql<number>`count(*)::int`,
      oldest: sql<Date | null>`min(${outboxEvents.availableAt})`,
    })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "PENDING"));

  const [deadLetter] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "DEAD_LETTER"));

  const pendingCount = pending?.count ?? 0;
  const oldestPendingAgeMs = pending?.oldest
    ? Date.now() - new Date(pending.oldest).getTime()
    : null;
  const deadLetterCount = deadLetter?.count ?? 0;

  const status: OutboxHealth["status"] =
    oldestPendingAgeMs !== null && oldestPendingAgeMs > BACKLOG_AGE_THRESHOLD_MS
      ? "backlogged"
      : "ok";

  return { status, pendingCount, oldestPendingAgeMs, deadLetterCount };
}
