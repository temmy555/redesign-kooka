import "server-only";

import IORedis from "ioredis";

import { parseApplicationEnvironment } from "./environment";

/**
 * Redis connection factory (Roadmap Langkah 8). Per
 * docs/TECHNICAL-ARCHITECTURE.md §4, Redis here is only ever used for data
 * that can be rebuilt -- BullMQ queue/retry/schedule state, rate limiting,
 * and short non-authoritative coordination. It is never the source of
 * truth for booking, payment, inventory, folio, attendance, or permission
 * data; losing Redis must not lose a business transaction that already
 * committed to PostgreSQL.
 *
 * This is a factory, not a shared singleton: BullMQ recommends each
 * Queue/Worker/QueueEvents own its own connection rather than multiplex a
 * single client, and `maxRetriesPerRequest: null` (required for BullMQ's
 * blocking commands) is not something a connection used for other
 * purposes -- e.g. a future Redis-backed rate limiter -- should
 * necessarily also have.
 */
export function createRedisConnection(
  options: { forBullMq?: boolean } = {},
): IORedis {
  const environment = parseApplicationEnvironment(process.env);
  if (!environment.REDIS_URL) {
    throw new Error("REDIS_URL is not configured");
  }
  return new IORedis(environment.REDIS_URL, {
    maxRetriesPerRequest: options.forBullMq ? null : 20,
    enableReadyCheck: true,
  });
}
