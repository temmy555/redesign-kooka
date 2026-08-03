import "server-only";

import { Queue, Worker, type Job } from "bullmq";

import { createRedisConnection } from "./redis";
import { getLogger } from "./logger";
import { processNextOutboxEvent, type OutboxHandler } from "./outbox";

/**
 * BullMQ wiring (Roadmap Langkah 8). Redis/BullMQ here only ever carries a
 * "something may be due, go look" signal -- a repeatable tick job -- never
 * business payload. The outbox table in PostgreSQL (src/platform/outbox.ts)
 * stays the single durable record of pending work, matching
 * docs/TECHNICAL-ARCHITECTURE.md §4's constraint that Redis must be safe to
 * lose without losing a committed business transaction.
 */

export const OUTBOX_QUEUE_NAME = "outbox-dispatch";
const OUTBOX_TICK_JOB_NAME = "drain";
const DEFAULT_TICK_INTERVAL_MS = 5_000;
/** Upper bound on outbox rows drained per tick, so one tick can't run forever. */
const MAX_DRAINED_PER_TICK = 50;

export function createOutboxQueue(): Queue {
  return new Queue(OUTBOX_QUEUE_NAME, {
    connection: createRedisConnection({ forBullMq: true }),
  });
}

/**
 * Ensures the repeatable "drain the outbox" tick is scheduled. Safe to call
 * on every process start: `upsertJobScheduler` is keyed by
 * `OUTBOX_TICK_JOB_NAME`, so this updates the existing schedule instead of
 * creating a new one each deploy.
 */
export async function scheduleOutboxDrainTick(
  queue: Queue = createOutboxQueue(),
  everyMs: number = DEFAULT_TICK_INTERVAL_MS,
): Promise<void> {
  await queue.upsertJobScheduler(
    OUTBOX_TICK_JOB_NAME,
    { every: everyMs },
    {
      name: OUTBOX_TICK_JOB_NAME,
      opts: { removeOnComplete: true, removeOnFail: true },
    },
  );
}

/**
 * Creates the BullMQ Worker that reacts to drain ticks by repeatedly
 * claiming and processing due outbox events (src/platform/outbox.ts) until
 * the table has nothing left due, or `MAX_DRAINED_PER_TICK` is hit -- the
 * remainder simply waits for the next tick rather than blocking this one.
 * `handlers` maps outbox `topic` to the function that performs the actual
 * side effect (send email, render PDF, expire a hold, etc.); domain modules
 * register their topic handlers here rather than each running their own
 * queue/retry plumbing, which is the whole point of this shared service.
 */
export function createOutboxWorker(
  handlers: Record<string, OutboxHandler>,
): Worker {
  const logger = getLogger();
  const workerId = `outbox-worker-${process.pid}`;

  return new Worker(
    OUTBOX_QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== OUTBOX_TICK_JOB_NAME) return;
      for (let i = 0; i < MAX_DRAINED_PER_TICK; i += 1) {
        const didWork = await processNextOutboxEvent(workerId, handlers);
        if (!didWork) break;
      }
    },
    {
      connection: createRedisConnection({ forBullMq: true }),
      autorun: false,
    },
  ).on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      "Outbox drain tick failed",
    );
  });
}
