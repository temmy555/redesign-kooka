import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import pg from "pg";

import { migrations } from "../../database/migrations/manifest.mjs";
import { projectRoot } from "./local-environment.mjs";

const { Pool } = pg;
const migrationLockKey = 2026080205;

export function checksum(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export function databaseName(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
}

export function assertMigrationEnvironment(environment) {
  if (!environment.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must use postgresql://");
  }

  if (environment.APP_ENV === "production") {
    if (environment.ALLOW_PRODUCTION_MIGRATION !== "YES") {
      throw new Error(
        "Production migrations require ALLOW_PRODUCTION_MIGRATION=YES",
      );
    }
  }
}

export function assertTestResetEnvironment(environment) {
  assertMigrationEnvironment(environment);
  const name = databaseName(environment.DATABASE_URL);
  const clearlyDisposable = /(^|[-_])test($|[-_])/u.test(name);

  if (
    environment.APP_ENV !== "test" ||
    environment.ALLOW_DATABASE_RESET !== "YES" ||
    !clearlyDisposable
  ) {
    throw new Error(
      "Reset requires APP_ENV=test, ALLOW_DATABASE_RESET=YES, and a database name containing a test segment",
    );
  }
}

export function createDatabasePool(databaseUrl, maximum = 2) {
  return new Pool({
    connectionString: databaseUrl,
    max: maximum,
    application_name: "kooka-database-cli",
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
}

async function migrationFiles() {
  const ids = new Set();
  const loaded = [];

  for (const migration of migrations) {
    if (ids.has(migration.id))
      throw new Error(`Duplicate migration id: ${migration.id}`);
    ids.add(migration.id);
    const sql = await readFile(join(projectRoot, migration.path), "utf8");
    if (!sql.trim()) throw new Error(`Migration is empty: ${migration.path}`);
    loaded.push({ ...migration, sql, checksum: checksum(sql) });
  }

  return loaded;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS kooka_schema_migrations (
      id varchar(160) PRIMARY KEY,
      checksum char(64) NOT NULL,
      description text NOT NULL,
      execution_ms integer NOT NULL CHECK (execution_ms >= 0),
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(client) {
  const exists = await client.query(
    "SELECT to_regclass('public.kooka_schema_migrations') AS relation",
  );
  if (!exists.rows[0]?.relation) return new Map();

  const result = await client.query(
    "SELECT id, checksum, description, execution_ms, applied_at FROM kooka_schema_migrations ORDER BY id",
  );
  return new Map(result.rows.map((row) => [row.id, row]));
}

export async function migrationStatus(pool) {
  const files = await migrationFiles();
  const client = await pool.connect();
  try {
    const applied = await appliedMigrations(client);
    return files.map((migration) => {
      const record = applied.get(migration.id);
      return {
        id: migration.id,
        description: migration.description,
        state: !record
          ? "pending"
          : record.checksum === migration.checksum
            ? "applied"
            : "checksum-mismatch",
        appliedAt: record?.applied_at ?? null,
      };
    });
  } finally {
    client.release();
  }
}

export async function migrate(pool, onProgress = () => undefined) {
  const files = await migrationFiles();
  const client = await pool.connect();
  const outcome = [];

  try {
    await client.query("SELECT pg_advisory_lock($1)", [migrationLockKey]);
    await ensureMigrationTable(client);
    const applied = await appliedMigrations(client);

    for (const migration of files) {
      const record = applied.get(migration.id);
      if (record) {
        if (record.checksum !== migration.checksum) {
          throw new Error(
            `Applied migration checksum changed: ${migration.id}`,
          );
        }
        outcome.push({ id: migration.id, state: "skipped" });
        onProgress(`${migration.id}: already applied`);
        continue;
      }

      const startedAt = performance.now();
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '120s'");
        await client.query(migration.sql);
        const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
        await client.query(
          `INSERT INTO kooka_schema_migrations
             (id, checksum, description, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [migration.id, migration.checksum, migration.description, elapsed],
        );
        await client.query("COMMIT");
        outcome.push({ id: migration.id, state: "applied" });
        onProgress(`${migration.id}: applied in ${elapsed}ms`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return outcome;
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [migrationLockKey])
      .catch(() => undefined);
    client.release();
  }
}

export async function resetTestDatabase(pool) {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

export async function seedDevelopment(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO properties (code, name)
      VALUES ('KOOKA-DEV', 'KOOKA Synthetic Development Property')
      ON CONFLICT (code) DO NOTHING
    `);
    await client.query(`
      INSERT INTO roles (code, name, description, system_role)
      VALUES
        ('OWNER', 'Super Admin / Owner', 'Synthetic development role', true),
        ('FRONT_OFFICE', 'Admin / Front Office', 'Synthetic development role', true),
        ('CLEANING', 'Cleaning', 'Synthetic development role', true),
        ('FNB', 'F&B', 'Synthetic development role', true)
      ON CONFLICT (code) DO NOTHING
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth(pool) {
  const startedAt = performance.now();
  const result = await pool.query(`
    SELECT
      current_database() AS database_name,
      to_regclass('public.properties') IS NOT NULL AS schema_ready,
      to_regclass('public.kooka_schema_migrations') IS NOT NULL AS migration_history_ready
  `);
  return {
    ...result.rows[0],
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
