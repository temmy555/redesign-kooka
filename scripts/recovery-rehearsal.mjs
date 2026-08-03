import { spawn } from "node:child_process";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import pg from "pg";

import { loadLocalApplicationEnvironment } from "./lib/local-environment.mjs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with status ${code}`)),
    );
  });
}

async function countFiles(root) {
  let count = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(join(root, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function main() {
  if (!process.env.DATABASE_URL) loadLocalApplicationEnvironment();
  const sourceUrl = new URL(
    process.env.RECOVERY_REHEARSAL_DATABASE_URL ?? process.env.DATABASE_URL,
  );
  if (!LOCAL_HOSTS.has(sourceUrl.hostname)) {
    throw new Error("Recovery rehearsal is restricted to localhost databases");
  }
  const sourceName = sourceUrl.pathname.slice(1);
  if (!sourceName) throw new Error("Source database name is required");
  const rehearsalName = `kooka_recovery_rehearsal_${process.pid}`;
  const rehearsalUrl = new URL(sourceUrl);
  rehearsalUrl.pathname = `/${rehearsalName}`;
  const workspace = await mkdtemp(join(tmpdir(), "kooka-recovery-"));
  const dumpPath = join(workspace, "database.dump");
  const admin = new pg.Pool({ connectionString: sourceUrl.toString(), max: 1 });

  try {
    await run("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      `--file=${dumpPath}`,
      sourceUrl.toString(),
    ]);
    await admin.query(`create database "${rehearsalName}"`);
    await run("pg_restore", [
      "--exit-on-error",
      "--no-owner",
      "--no-acl",
      `--dbname=${rehearsalUrl.toString()}`,
      dumpPath,
    ]);
    const restored = new pg.Pool({
      connectionString: rehearsalUrl.toString(),
      max: 1,
    });
    try {
      const check = await restored.query(`
        select
          to_regclass('public.kooka_schema_migrations') is not null as migrations,
          to_regclass('public.users') is not null as users,
          to_regclass('public.reservations') is not null as reservations,
          to_regclass('public.audit_events') is not null as audit_events
      `);
      if (!Object.values(check.rows[0] ?? {}).every(Boolean)) {
        throw new Error("Restored database is missing a critical table");
      }
    } finally {
      await restored.end();
    }

    let storageFiles = null;
    if (process.env.RECOVERY_REHEARSAL_STORAGE_ROOT) {
      const restoredStorage = join(workspace, "restored-private-storage");
      const sourceCount = await countFiles(
        process.env.RECOVERY_REHEARSAL_STORAGE_ROOT,
      );
      await cp(process.env.RECOVERY_REHEARSAL_STORAGE_ROOT, restoredStorage, {
        recursive: true,
      });
      const restoredCount = await countFiles(restoredStorage);
      if (sourceCount !== restoredCount) {
        throw new Error("Private-storage rehearsal file count mismatch");
      }
      storageFiles = restoredCount;
    }
    console.log(
      JSON.stringify(
        {
          database: "restored-and-validated",
          privateStorageFiles: storageFiles,
        },
        null,
        2,
      ),
    );
  } finally {
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [rehearsalName],
    );
    await admin.query(`drop database if exists "${rehearsalName}"`);
    await admin.end();
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
