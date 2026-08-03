import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import { getDatabasePool } from "./pool";

let database: NodePgDatabase<typeof schema> | undefined;

export function getDatabase(): NodePgDatabase<typeof schema> {
  database ??= drizzle(getDatabasePool(), { schema });
  return database;
}
