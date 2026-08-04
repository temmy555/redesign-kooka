import {
  assertMigrationEnvironment,
  assertTestResetEnvironment,
  createDatabasePool,
  databaseHealth,
  migrate,
  migrationStatus,
  resetTestDatabase,
  seedDevelopment,
} from "./lib/database-migrations.mjs";
import { loadLocalApplicationEnvironment } from "./lib/local-environment.mjs";

async function main() {
  if (!process.env.DATABASE_URL) {
    loadLocalApplicationEnvironment();
  }
  const environment = process.env;
  const command = process.argv[2] ?? "status";
  assertMigrationEnvironment(environment);
  const pool = createDatabasePool(environment.DATABASE_URL);

  try {
    if (command === "migrate") {
      await migrate(pool, console.log);
      return;
    }

    if (command === "status") {
      const rows = await migrationStatus(pool);
      console.table(rows);
      if (rows.some((row) => row.state === "checksum-mismatch"))
        process.exitCode = 1;
      return;
    }

    if (command === "health") {
      console.table([await databaseHealth(pool)]);
      return;
    }

    if (command === "seed:dev") {
      if (
        environment.APP_ENV !== "development" &&
        environment.APP_ENV !== "test"
      ) {
        throw new Error(
          "Synthetic seed is allowed only in development or test",
        );
      }
      await seedDevelopment(pool);
      console.log(
        "Synthetic property and baseline roles are ready; no rooms or rates were seeded.",
      );
      return;
    }

    if (command === "reset:test") {
      assertTestResetEnvironment(environment);
      await resetTestDatabase(pool);
      await migrate(pool, console.log);
      console.log("Disposable test schema was reset and migrated.");
      return;
    }

    throw new Error(`Unknown database command: ${command}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
