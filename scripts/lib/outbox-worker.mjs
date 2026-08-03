/**
 * Standalone outbox worker queries (Roadmap Langkah 8). This mirrors the
 * claim/complete/fail semantics of src/platform/outbox.ts, but talks to
 * PostgreSQL with raw `pg` SQL instead of Drizzle -- the same split already
 * used by scripts/lib/database-migrations.mjs, because this project's
 * operational scripts run as plain Node `.mjs` (no TypeScript loader),
 * separate from the Next.js app's TypeScript build. The two implementations
 * are intentionally kept in lock-step by hand; see
 * docs/CONVERSATION-TRANSCRIPT.md's Langkah 8 entry for that trade-off.
 */

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const OUTBOX_LEASE_MINUTES = 30;

function backoffMs(attempts) {
  const capped = Math.min(attempts, 10);
  return Math.min(BASE_BACKOFF_MS * 2 ** capped, MAX_BACKOFF_MS);
}

function jobExecutionName(topic) {
  return `outbox:${topic}`;
}

export async function claimNextOutboxEvent(pool, workerId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      SELECT id, topic, aggregate_type AS "aggregateType",
             aggregate_id AS "aggregateId", payload, attempts,
             locked_at AS "lockedAt", locked_by AS "lockedBy"
      FROM outbox_events
      WHERE (status = 'PENDING' AND available_at <= now())
         OR (status = 'PROCESSING'
             AND locked_at <= now() - make_interval(mins => ${OUTBOX_LEASE_MINUTES}))
      ORDER BY available_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);
    let event = rows[0] ?? null;
    if (event) {
      const claimed = await client.query(
        `UPDATE outbox_events
         SET status = 'PROCESSING', locked_at = now(), locked_by = $1
         WHERE id = $2
         RETURNING id, topic, aggregate_type AS "aggregateType",
                   aggregate_id AS "aggregateId", payload, attempts,
                   locked_at AS "lockedAt", locked_by AS "lockedBy"`,
        [workerId, event.id],
      );
      event = claimed.rows[0] ?? null;
    }
    await client.query("COMMIT");
    return event;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function wasOutboxEventAlreadyCompleted(pool, event) {
  const { rows } = await pool.query(
    `SELECT status FROM job_executions WHERE job_name = $1 AND idempotency_key = $2 LIMIT 1`,
    [jobExecutionName(event.topic), event.id],
  );
  return rows[0]?.status === "COMPLETED";
}

async function completeOutboxEvent(pool, event, result) {
  const client = await pool.connect();
  const now = new Date();
  try {
    await client.query("BEGIN");
    const completed = await client.query(
      `UPDATE outbox_events
       SET status = 'COMPLETED', processed_at = now(), locked_at = NULL, locked_by = NULL
       WHERE id = $1 AND status = 'PROCESSING' AND locked_by = $2
       RETURNING id`,
      [event.id, event.lockedBy],
    );
    if (completed.rowCount !== 1) {
      throw new Error(`Outbox lease lost before completing event ${event.id}`);
    }
    await client.query(
      `INSERT INTO job_executions
         (job_name, idempotency_key, status, started_at, finished_at, result)
       VALUES ($1, $2, 'COMPLETED', $3, now(), $4)
       ON CONFLICT (job_name, idempotency_key) DO NOTHING`,
      [
        jobExecutionName(event.topic),
        event.id,
        event.lockedAt ?? now,
        result ? JSON.stringify(result) : null,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function failOutboxEvent(pool, event, error, logger) {
  const attempts = event.attempts + 1;
  const message = error instanceof Error ? error.message : String(error);

  if (attempts >= MAX_ATTEMPTS) {
    const client = await pool.connect();
    const now = new Date();
    try {
      await client.query("BEGIN");
      const deadLettered = await client.query(
        `UPDATE outbox_events
         SET status = 'DEAD_LETTER', attempts = $2, last_error = $3,
             locked_at = NULL, locked_by = NULL
         WHERE id = $1 AND status = 'PROCESSING' AND locked_by = $4
         RETURNING id`,
        [event.id, attempts, message, event.lockedBy],
      );
      if (deadLettered.rowCount !== 1) {
        throw new Error(
          `Outbox lease lost before dead-lettering event ${event.id}`,
        );
      }
      await client.query(
        `INSERT INTO job_executions
           (job_name, idempotency_key, status, started_at, finished_at, error)
         VALUES ($1, $2, 'DEAD_LETTER', $3, now(), $4)
         ON CONFLICT (job_name, idempotency_key) DO NOTHING`,
        [
          jobExecutionName(event.topic),
          event.id,
          event.lockedAt ?? now,
          message,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    logger.error(
      `[outbox] ${event.topic} (${event.id}) moved to dead-letter after ${attempts} attempts: ${message}`,
    );
    return;
  }

  const availableAt = new Date(Date.now() + backoffMs(attempts));
  await pool.query(
    `UPDATE outbox_events
     SET status = 'PENDING', attempts = $2, last_error = $3, available_at = $4,
         locked_at = NULL, locked_by = NULL
     WHERE id = $1 AND status = 'PROCESSING' AND locked_by = $5`,
    [event.id, attempts, message, availableAt, event.lockedBy],
  );
  logger.warn(
    `[outbox] ${event.topic} (${event.id}) failed (attempt ${attempts}), retrying at ${availableAt.toISOString()}: ${message}`,
  );
}

/**
 * Claims and processes at most one due outbox event using the handler
 * registered for its topic. Returns `false` when nothing was due.
 */
export async function processNextOutboxEvent(
  pool,
  workerId,
  handlers,
  logger = console,
) {
  const event = await claimNextOutboxEvent(pool, workerId);
  if (!event) return false;

  const handler = handlers[event.topic];
  if (!handler) {
    await failOutboxEvent(
      pool,
      event,
      new Error(`No outbox handler registered for topic "${event.topic}"`),
      logger,
    );
    return true;
  }

  try {
    if (await wasOutboxEventAlreadyCompleted(pool, event)) {
      await completeOutboxEvent(pool, event, { skipped: "already-completed" });
      return true;
    }
    const result = (await handler(event)) ?? null;
    await completeOutboxEvent(pool, event, result);
  } catch (error) {
    await failOutboxEvent(pool, event, error, logger);
  }
  return true;
}
