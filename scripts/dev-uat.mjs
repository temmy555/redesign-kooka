import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createDatabasePool, migrate } from "./lib/database-migrations.mjs";
import { parseEnvironmentFile, projectRoot } from "./lib/local-environment.mjs";
import {
  assertLocalUatTarget,
  uatEnvironmentPath,
} from "./lib/uat-environment.mjs";

const environment = parseEnvironmentFile(
  await readFile(uatEnvironmentPath, "utf8"),
);
assertLocalUatTarget(environment.DATABASE_URL);
const migrationPool = createDatabasePool(environment.DATABASE_URL, 1);
try {
  await migrate(migrationPool);
  console.log("UAT database schema is up to date.");
} finally {
  await migrationPool.end();
}
const browserOrigin = new URL(environment.UAT_BROWSER_URL);
const runtimeEnvironment = {
  ...process.env,
  ...environment,
  NEXT_DIST_DIR: ".next-uat",
  UAT_DEV_ORIGIN: browserOrigin.hostname,
};
const web = spawn(
  process.execPath,
  [
    join(projectRoot, "node_modules", "next", "dist", "bin", "next"),
    "dev",
    "-p",
    "3100",
  ],
  {
    cwd: projectRoot,
    env: runtimeEnvironment,
    stdio: "inherit",
  },
);
const worker = spawn(
  process.execPath,
  [join(projectRoot, "scripts", "worker.mjs")],
  {
    cwd: projectRoot,
    env: runtimeEnvironment,
    stdio: "inherit",
  },
);

const children = [web, worker];
let shuttingDown = false;

function stopAll(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopAll(signal));
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      stopAll("SIGTERM");
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
}
