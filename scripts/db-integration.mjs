import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createDatabasePool,
  migrate,
  migrationStatus,
  resetTestDatabase,
} from "./lib/database-migrations.mjs";
import { claimNextOutboxEvent } from "./lib/outbox-worker.mjs";
import { runAutomaticDailyOperations } from "./lib/daily-operations.mjs";
import {
  loadLocalApplicationEnvironment,
  projectRoot,
} from "./lib/local-environment.mjs";

const disposableDatabaseName = "kooka_step5_test";

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function verifyOutboxConcurrency(pool) {
  const inserted = await pool.query(`
    INSERT INTO outbox_events (topic, aggregate_type, aggregate_id, payload)
    VALUES ('test.concurrent', 'test', uuidv7(), '{}'::jsonb)
    RETURNING id
  `);
  const eventId = inserted.rows[0].id;

  const claims = await Promise.all([
    claimNextOutboxEvent(pool, "integration-worker-a"),
    claimNextOutboxEvent(pool, "integration-worker-b"),
  ]);
  const successfulClaims = claims.filter(Boolean);
  if (successfulClaims.length !== 1 || successfulClaims[0].id !== eventId) {
    throw new Error(
      "Concurrent workers did not claim exactly one outbox event",
    );
  }

  const state = await pool.query(
    "SELECT status, locked_by FROM outbox_events WHERE id = $1",
    [eventId],
  );
  if (
    state.rows[0]?.status !== "PROCESSING" ||
    !state.rows[0]?.locked_by?.startsWith("integration-worker-")
  ) {
    throw new Error("Outbox claim did not persist its PROCESSING lease");
  }

  await pool.query(
    "UPDATE outbox_events SET locked_at = now() - interval '31 minutes' WHERE id = $1",
    [eventId],
  );
  const reclaimed = await claimNextOutboxEvent(
    pool,
    "integration-worker-recovery",
  );
  if (reclaimed?.id !== eventId) {
    throw new Error("A stale PROCESSING outbox lease was not recoverable");
  }
}

async function verifyTransactionConcurrency(pool) {
  const scope = `integration:${Date.now()}`;
  const key = "same-request";
  const inserts = await Promise.all([
    pool.query(
      `insert into idempotency_keys
         (scope, key, request_hash, status, expires_at)
       values ($1, $2, repeat('a', 64), 'PROCESSING', now() + interval '1 hour')
       on conflict (scope, key) do nothing returning id`,
      [scope, key],
    ),
    pool.query(
      `insert into idempotency_keys
         (scope, key, request_hash, status, expires_at)
       values ($1, $2, repeat('a', 64), 'PROCESSING', now() + interval '1 hour')
       on conflict (scope, key) do nothing returning id`,
      [scope, key],
    ),
  ]);
  if (inserts.filter((result) => result.rowCount === 1).length !== 1) {
    throw new Error("Concurrent idempotency claims did not produce one owner");
  }

  const room = await pool.query(
    "select id from room_units order by created_at limit 1",
  );
  if (!room.rows[0]) throw new Error("Schema smoke data did not create a room");
  const collision = await Promise.allSettled([
    pool.query(
      `insert into room_unit_night_claims
         (room_unit_id, stay_date, claim_type, source_id)
       values ($1, '2026-08-11', 'ASSIGNMENT', uuidv7())`,
      [room.rows[0].id],
    ),
    pool.query(
      `insert into room_unit_night_claims
         (room_unit_id, stay_date, claim_type, source_id)
       values ($1, '2026-08-11', 'BLOCK', uuidv7())`,
      [room.rows[0].id],
    ),
  ]);
  if (
    collision.filter((result) => result.status === "fulfilled").length !== 1
  ) {
    throw new Error(
      "Concurrent physical room-night claims did not collide safely",
    );
  }
}

async function verifyReportingDailyOperations(pool) {
  const results = await runAutomaticDailyOperations(
    pool,
    new Date("2026-08-02T00:00:00Z"),
    4,
  );
  if (results.length !== 1 || results[0].status !== "COMPLETED") {
    throw new Error("Synthetic daily rollover did not complete cleanly");
  }
  const verification = await pool.query(`
    SELECT
      (SELECT count(*)::integer FROM business_day_runs
       WHERE run_type='ROLLOVER' AND status='COMPLETED') completed_runs,
      (SELECT count(*)::integer FROM reconciliation_exceptions
       WHERE severity='CRITICAL' AND status IN ('OPEN','ACKNOWLEDGED','INVESTIGATING')) critical_open,
      (SELECT count(*)::integer FROM audit_events
       WHERE action='BUSINESS_DAY_ROLLOVER_COMPLETED') rollover_audits
  `);
  const row = verification.rows[0];
  if (
    row?.completed_runs !== 1 ||
    row?.critical_open !== 0 ||
    row?.rollover_audits !== 1
  ) {
    throw new Error(
      "Synthetic reporting reconciliation exit gate did not remain clean and audited",
    );
  }
  const replay = await runAutomaticDailyOperations(
    pool,
    new Date("2026-08-02T00:01:00Z"),
    4,
  );
  if (replay.length !== 1 || replay[0].replayed !== true) {
    throw new Error("Automatic daily rollover replay was not idempotent");
  }
}

async function main() {
  loadLocalApplicationEnvironment();
  const baseUrl = new URL(process.env.DATABASE_URL);

  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(baseUrl.hostname)) {
    throw new Error(
      "Disposable database verification is restricted to localhost",
    );
  }

  const adminPool = createDatabasePool(baseUrl.toString(), 1);
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${disposableDatabaseName}`;
  let testPool;

  try {
    await adminPool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [disposableDatabaseName],
    );
    await adminPool.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(disposableDatabaseName)}`,
    );
    await adminPool.query(
      `CREATE DATABASE ${quoteIdentifier(disposableDatabaseName)}`,
    );

    testPool = createDatabasePool(testUrl.toString(), 2);
    const firstRun = await migrate(testPool);
    const secondRun = await migrate(testPool);

    if (firstRun.some((item) => item.state !== "applied")) {
      throw new Error("Empty database did not apply every migration");
    }
    if (secondRun.some((item) => item.state !== "skipped")) {
      throw new Error("Second migration run was not idempotent");
    }

    const smokeSql = (
      await readFile(join(projectRoot, "work", "schema-smoke-test.sql"), "utf8")
    ).replace(/^\\set ON_ERROR_STOP on\s*/u, "");
    await testPool.query(smokeSql);
    await verifyOutboxConcurrency(testPool);
    await verifyTransactionConcurrency(testPool);
    await verifyReportingDailyOperations(testPool);

    await resetTestDatabase(testPool);
    await migrate(testPool);
    const status = await migrationStatus(testPool);
    if (status.some((item) => item.state !== "applied")) {
      throw new Error("Reset/recreate did not restore all migrations");
    }

    console.log(
      "Disposable PostgreSQL verification passed: empty migrate, migration idempotency, hard constraints, concurrent idempotency ownership, physical room-night collision, outbox lease/recovery, clean/idempotent daily rollover reconciliation, and reset/recreate.",
    );
  } finally {
    if (testPool) await testPool.end();
    await adminPool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [disposableDatabaseName],
    );
    await adminPool.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(disposableDatabaseName)}`,
    );
    await adminPool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
