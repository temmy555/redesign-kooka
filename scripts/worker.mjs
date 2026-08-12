/**
 * Outbox worker process entrypoint (Roadmap Langkah 8). Runs the same
 * application image as the web process, just a different start command --
 * matching docs/TECHNICAL-ARCHITECTURE.md §6 ("Worker process dari image
 * aplikasi yang sama dengan command berbeda"). It schedules a repeatable
 * BullMQ "drain" tick and, on each tick, claims and processes due
 * `outbox_events` rows (scripts/lib/outbox-worker.mjs) via
 * `SELECT ... FOR UPDATE SKIP LOCKED`, so multiple worker instances can run
 * concurrently without double-processing a row.
 *
 * Domain topic handlers (send email, render PDF, expire a hold, etc.) are
 * registered in the `handlers` map below. Roadmap Langkah 8 itself only
 * builds the shared queue/retry/outbox plumbing -- no domain topics exist
 * yet, so this starts with an empty map; later steps add their handler and
 * import it here.
 */
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { createDatabasePool } from "./lib/database-migrations.mjs";
import { runAutomaticDailyOperations } from "./lib/daily-operations.mjs";
import { loadLocalApplicationEnvironment } from "./lib/local-environment.mjs";
import { createOutboxHandlers } from "./lib/outbox-handlers.mjs";
import { processNextOutboxEvent } from "./lib/outbox-worker.mjs";
import { reconcileExpiredReservationHolds } from "./lib/reservation-expiry.mjs";

const OUTBOX_QUEUE_NAME = "outbox-dispatch";
const OUTBOX_TICK_JOB_NAME = "drain";
const DAILY_OPERATIONS_JOB_NAME = "daily-operations";
const MAX_DRAINED_PER_TICK = 50;

async function main() {
  // UAT/production inject environment variables through systemd, Docker,
  // or the hosting control plane. Local files are a development fallback.
  if (!process.env.DATABASE_URL) {
    loadLocalApplicationEnvironment();
  }
  const environment = process.env;
  const tickIntervalMs = Number(environment.OUTBOX_TICK_INTERVAL_MS ?? 5_000);
  const rolloverHour = Number(environment.BUSINESS_DATE_ROLLOVER_HOUR ?? 4);

  if (!environment.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run the worker");
  }

  const pool = createDatabasePool(environment.DATABASE_URL, 4);
  const workerId = `outbox-worker-${process.pid}`;
  const handlers = createOutboxHandlers(environment, pool);

  async function drainOutbox() {
    for (let i = 0; i < MAX_DRAINED_PER_TICK; i += 1) {
      const didWork = await processNextOutboxEvent(
        pool,
        workerId,
        handlers,
        console,
      );
      if (!didWork) break;
    }
  }

  async function runPeriodicOperations() {
    const expiry = await reconcileExpiredReservationHolds(pool);
    if (expiry.expiredReservations > 0) {
      console.info(
        `[worker] reconciled ${expiry.expiredReservations} overdue reservation(s); released ${expiry.releasedClaims} inventory claim(s)`,
      );
    }
    await runAutomaticDailyOperations(pool, new Date(), rolloverHour);
  }

  if (!environment.REDIS_URL) {
    let isDraining = false;
    let isRunningDailyOperations = false;
    const outboxTimer = setInterval(() => {
      if (isDraining) return;
      isDraining = true;
      void drainOutbox()
        .catch((error) => {
          console.error(
            `[worker] outbox polling failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
        .finally(() => {
          isDraining = false;
        });
    }, tickIntervalMs);

    const dailyOperationsTimer = setInterval(() => {
      if (isRunningDailyOperations) return;
      isRunningDailyOperations = true;
      void runPeriodicOperations()
        .catch((error) => {
          console.error(
            `[worker] daily operations failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
        .finally(() => {
          isRunningDailyOperations = false;
        });
    }, 60_000);

    await drainOutbox();
    await runPeriodicOperations();

    console.log(
      `[worker] ${workerId} started without Redis; polling outbox every ${tickIntervalMs}ms`,
    );

    const shutdown = async (signal) => {
      console.log(`[worker] received ${signal}, shutting down`);
      clearInterval(outboxTimer);
      clearInterval(dailyOperationsTimer);
      await pool.end();
      process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    return;
  }

  const queueConnection = new IORedis(environment.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const workerConnection = new IORedis(environment.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(OUTBOX_QUEUE_NAME, { connection: queueConnection });
  await queue.upsertJobScheduler(
    OUTBOX_TICK_JOB_NAME,
    { every: tickIntervalMs },
    {
      name: OUTBOX_TICK_JOB_NAME,
      opts: { removeOnComplete: true, removeOnFail: true },
    },
  );
  await queue.upsertJobScheduler(
    DAILY_OPERATIONS_JOB_NAME,
    { every: 60_000 },
    {
      name: DAILY_OPERATIONS_JOB_NAME,
      opts: { removeOnComplete: true, removeOnFail: true },
    },
  );

  const worker = new Worker(
    OUTBOX_QUEUE_NAME,
    async (job) => {
      if (job.name === DAILY_OPERATIONS_JOB_NAME) {
        await runPeriodicOperations();
        return;
      }
      if (job.name !== OUTBOX_TICK_JOB_NAME) return;
      await drainOutbox();
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, error) => {
    console.error(`[worker] tick ${job?.id ?? "?"} failed: ${error.message}`);
  });

  console.log(
    `[worker] ${workerId} started; draining outbox every ${tickIntervalMs}ms`,
  );

  const shutdown = async (signal) => {
    console.log(`[worker] received ${signal}, shutting down`);
    await worker.close();
    await queue.close();
    await queueConnection.quit().catch(() => undefined);
    await workerConnection.quit().catch(() => undefined);
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
