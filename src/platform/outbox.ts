import "server-only";

import { and, asc, eq, lte, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDatabase } from "../db";
import { jobExecutions, outboxEvents } from "../db/schema";
import type * as schema from "../db/schema";
import { getLogger } from "./logger";

/**
 * Transactional outbox (Roadmap Langkah 8). Per
 * docs/TECHNICAL-ARCHITECTURE.md §4: "Pola transactional outbox digunakan
 * untuk pekerjaan yang harus mengikuti commit database, misalnya email, PDF
 * render, expiry hold, reminder, dan scheduled rollover." The outbox row
 * itself is the durable, authoritative record of "this side effect still
 * needs to happen" -- Redis/BullMQ (src/platform/queue.ts) only trigger a
 * worker to look at it sooner, they never hold work that isn't also
 * durable here.
 */

type DrizzleDb = NodePgDatabase<typeof schema>;

export interface EnqueueOutboxEventInput {
  topic: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  /** Delay processing until this instant. Defaults to "now". */
  availableAt?: Date;
}

/**
 * Insert an outbox row. Pass the `tx` handle from
 * `getDatabase().transaction(async (tx) => ...)` so the enqueue commits
 * atomically with the domain write it belongs to -- that atomicity is the
 * entire point of the outbox pattern. Defaults to a bare (non-transactional)
 * insert only for callers without a surrounding transaction, e.g. scripts.
 */
export async function enqueueOutboxEvent(
  input: EnqueueOutboxEventInput,
  db: DrizzleDb = getDatabase(),
): Promise<void> {
  await db.insert(outboxEvents).values({
    topic: input.topic,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    availableAt: input.availableAt ?? new Date(),
  });
}

export type ClaimedOutboxEvent = typeof outboxEvents.$inferSelect;

/**
 * A crashed worker must not leave an event locked forever. A PROCESSING
 * event whose lease is older than this can be reclaimed. Handlers are
 * expected to finish well inside this window; long-running handlers should
 * split their work into smaller durable events.
 */
export const OUTBOX_LEASE_MS = 30 * 60 * 1000;

/**
 * Claims a single due, unlocked outbox row using `SELECT ... FOR UPDATE
 * SKIP LOCKED`, so multiple worker processes/loop iterations can poll
 * concurrently without blocking on or double-processing each other's rows.
 * Returns `null` when there is nothing to do.
 */
export async function claimNextOutboxEvent(
  workerId: string,
): Promise<ClaimedOutboxEvent | null> {
  return getDatabase().transaction(async (tx) => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - OUTBOX_LEASE_MS);
    const [row] = await tx
      .select()
      .from(outboxEvents)
      .where(
        or(
          and(
            eq(outboxEvents.status, "PENDING"),
            lte(outboxEvents.availableAt, now),
          ),
          and(
            eq(outboxEvents.status, "PROCESSING"),
            lte(outboxEvents.lockedAt, staleBefore),
          ),
        ),
      )
      .orderBy(asc(outboxEvents.availableAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!row) return null;

    const [claimed] = await tx
      .update(outboxEvents)
      .set({ status: "PROCESSING", lockedAt: now, lockedBy: workerId })
      .where(eq(outboxEvents.id, row.id))
      .returning();

    return claimed ?? null;
  });
}

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

function backoffMs(attempts: number): number {
  const capped = Math.min(attempts, 10);
  return Math.min(BASE_BACKOFF_MS * 2 ** capped, MAX_BACKOFF_MS);
}

/**
 * Job-name used for the `job_executions` audit row this module writes for
 * every terminal (completed or dead-lettered) outbox event.
 */
function jobExecutionName(topic: string): string {
  return `outbox:${topic}`;
}

function leaseOwner(event: ClaimedOutboxEvent): string {
  if (!event.lockedBy) {
    throw new Error(`Claimed outbox event ${event.id} has no lease owner`);
  }
  return event.lockedBy;
}

/**
 * Whether the given outbox event was already fully executed. Job handler
 * functions (the callback passed to `processOutboxEvent`) should treat this
 * as the "have I already done the actual side effect" check *before*
 * performing something non-idempotent like sending an email -- BullMQ/the
 * outbox worker only guarantee at-least-once delivery, so exactly-once for
 * the side effect itself is the handler's responsibility, backed by the
 * unique (job_name, idempotency_key) constraint on `job_executions`. This is
 * what keeps a retried outbox event from producing a duplicate record.
 */
export async function wasOutboxEventAlreadyCompleted(
  event: Pick<ClaimedOutboxEvent, "id" | "topic">,
): Promise<boolean> {
  const [row] = await getDatabase()
    .select({ status: jobExecutions.status })
    .from(jobExecutions)
    .where(
      and(
        eq(jobExecutions.jobName, jobExecutionName(event.topic)),
        eq(jobExecutions.idempotencyKey, event.id),
      ),
    )
    .limit(1);
  return row?.status === "COMPLETED";
}

async function completeOutboxEvent(
  event: ClaimedOutboxEvent,
  result: Record<string, unknown> | null,
): Promise<void> {
  const workerId = leaseOwner(event);
  await getDatabase().transaction(async (tx) => {
    const now = new Date();
    const completed = await tx
      .update(outboxEvents)
      .set({
        status: "COMPLETED",
        processedAt: now,
        lockedAt: null,
        lockedBy: null,
      })
      .where(
        and(
          eq(outboxEvents.id, event.id),
          eq(outboxEvents.status, "PROCESSING"),
          eq(outboxEvents.lockedBy, workerId),
        ),
      )
      .returning({ id: outboxEvents.id });

    if (completed.length === 0) {
      throw new Error(`Outbox lease lost before completing event ${event.id}`);
    }

    await tx
      .insert(jobExecutions)
      .values({
        jobName: jobExecutionName(event.topic),
        idempotencyKey: event.id,
        status: "COMPLETED",
        startedAt: event.lockedAt ?? now,
        finishedAt: now,
        result,
      })
      .onConflictDoNothing({
        target: [jobExecutions.jobName, jobExecutions.idempotencyKey],
      });
  });
}

async function failOutboxEvent(
  event: ClaimedOutboxEvent,
  error: unknown,
): Promise<void> {
  const db = getDatabase();
  const workerId = leaseOwner(event);
  const attempts = event.attempts + 1;
  const message = error instanceof Error ? error.message : String(error);
  const logger = getLogger();

  if (attempts >= MAX_ATTEMPTS) {
    const now = new Date();
    await db.transaction(async (tx) => {
      const deadLettered = await tx
        .update(outboxEvents)
        .set({
          status: "DEAD_LETTER",
          attempts,
          lastError: message,
          lockedAt: null,
          lockedBy: null,
        })
        .where(
          and(
            eq(outboxEvents.id, event.id),
            eq(outboxEvents.status, "PROCESSING"),
            eq(outboxEvents.lockedBy, workerId),
          ),
        )
        .returning({ id: outboxEvents.id });

      if (deadLettered.length === 0) {
        throw new Error(
          `Outbox lease lost before dead-lettering event ${event.id}`,
        );
      }

      await tx
        .insert(jobExecutions)
        .values({
          jobName: jobExecutionName(event.topic),
          idempotencyKey: event.id,
          status: "DEAD_LETTER",
          startedAt: event.lockedAt ?? now,
          finishedAt: now,
          error: message,
        })
        .onConflictDoNothing({
          target: [jobExecutions.jobName, jobExecutions.idempotencyKey],
        });
    });

    logger.error(
      { outboxEventId: event.id, topic: event.topic, attempts },
      "Outbox event moved to dead-letter after exhausting retries; needs manual review",
    );
    return;
  }

  await db
    .update(outboxEvents)
    .set({
      status: "PENDING",
      attempts,
      lastError: message,
      availableAt: new Date(Date.now() + backoffMs(attempts)),
      lockedAt: null,
      lockedBy: null,
    })
    .where(
      and(
        eq(outboxEvents.id, event.id),
        eq(outboxEvents.status, "PROCESSING"),
        eq(outboxEvents.lockedBy, workerId),
      ),
    );

  logger.warn(
    { outboxEventId: event.id, topic: event.topic, attempts, error: message },
    "Outbox event failed; scheduled for retry",
  );
}

export type OutboxHandler = (
  event: ClaimedOutboxEvent,
) => Promise<Record<string, unknown> | null | void>;

/**
 * Claims and processes at most one outbox event with the handler registered
 * for its topic. Returns `false` when there was nothing due to process.
 * Handlers with no registered topic are treated as a permanent (non-retry)
 * failure, since retrying can never fix a missing handler.
 */
export async function processNextOutboxEvent(
  workerId: string,
  handlers: Record<string, OutboxHandler>,
): Promise<boolean> {
  const event = await claimNextOutboxEvent(workerId);
  if (!event) return false;

  const handler = handlers[event.topic];
  if (!handler) {
    await failOutboxEvent(
      event,
      new Error(`No outbox handler registered for topic "${event.topic}"`),
    );
    return true;
  }

  try {
    if (await wasOutboxEventAlreadyCompleted(event)) {
      await completeOutboxEvent(event, { skipped: "already-completed" });
      return true;
    }
    const result = (await handler(event)) ?? null;
    await completeOutboxEvent(event, result);
  } catch (error) {
    await failOutboxEvent(event, error);
  }
  return true;
}
