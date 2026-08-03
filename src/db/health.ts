import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "./client";

export interface DatabaseHealth {
  status: "connected";
  database: string;
  schemaReady: boolean;
  latencyMs: number;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startedAt = performance.now();
  const result = await getDatabase().execute<{
    database: string;
    schema_ready: boolean;
  }>(sql`
    SELECT
      current_database() AS database,
      to_regclass('public.properties') IS NOT NULL AS schema_ready
  `);

  const row = result.rows[0];
  if (!row) throw new Error("Database health query returned no result");

  return {
    status: "connected",
    database: row.database,
    schemaReady: row.schema_ready,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
