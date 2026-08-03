import "server-only";

import { Pool } from "pg";

import { parseApplicationEnvironment } from "../platform/environment";

declare global {
  var __kookaDatabasePool: Pool | undefined;
}

export function getDatabasePool(): Pool {
  if (globalThis.__kookaDatabasePool) return globalThis.__kookaDatabasePool;

  const environment = parseApplicationEnvironment(process.env);
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: environment.DB_POOL_MAX,
    connectionTimeoutMillis: environment.DB_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: environment.DB_IDLE_TIMEOUT_MS,
    application_name: "kooka-web",
  });

  if (environment.APP_ENV === "development")
    globalThis.__kookaDatabasePool = pool;
  return pool;
}
