import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parseEnvironmentFile, projectRoot } from "./local-environment.mjs";

export const uatDatabaseName = "kooka_phase1_uat_test";
export const uatEnvironmentPath = join(projectRoot, ".env.uat.local");
export const uatCredentialPath = join(
  projectRoot,
  ".data",
  "uat",
  "credentials.json",
);

const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function uatDatabaseUrl(baseDatabaseUrl) {
  const parsed = new URL(baseDatabaseUrl);
  parsed.pathname = `/${uatDatabaseName}`;
  return parsed.toString();
}

export function assertLocalUatTarget(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (
    parsed.protocol !== "postgresql:" ||
    !localHosts.has(parsed.hostname) ||
    name !== uatDatabaseName
  ) {
    throw new Error(
      `UAT operation is restricted to the local ${uatDatabaseName} database`,
    );
  }
}

export async function readLocalEnvironment() {
  const source = await readFile(join(projectRoot, ".env.local"), "utf8");
  return parseEnvironmentFile(source);
}

function serializeEnvironment(environment) {
  return `${Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

export async function writeUatEnvironment(localEnvironment, databaseUrl) {
  assertLocalUatTarget(databaseUrl);
  const environment = {
    ...localEnvironment,
    APP_ENV: "development",
    APP_URL: "http://localhost:3100",
    UAT_BROWSER_URL: "http://192.168.1.4:3100",
    DATABASE_URL: databaseUrl,
    PRIVATE_STORAGE_ROOT: ".data/uat/private-files",
  };
  delete environment.OWNER_BOOTSTRAP_TOKEN;

  await mkdir(join(projectRoot, ".data", "uat", "private-files"), {
    recursive: true,
  });
  await writeFile(uatEnvironmentPath, serializeEnvironment(environment), {
    mode: 0o600,
  });
  await chmod(uatEnvironmentPath, 0o600);
}

export async function readCredentials() {
  try {
    return JSON.parse(await readFile(uatCredentialPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCredentials(credentials) {
  await mkdir(join(projectRoot, ".data", "uat"), { recursive: true });
  await writeFile(
    uatCredentialPath,
    `${JSON.stringify(credentials, null, 2)}\n`,
    { mode: 0o600 },
  );
  await chmod(uatCredentialPath, 0o600);
}
