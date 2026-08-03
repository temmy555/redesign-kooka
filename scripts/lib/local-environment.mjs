import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);

const infrastructurePath = join(projectRoot, ".env.infrastructure");
const applicationPath = join(projectRoot, ".env.local");
const applicationExamplePath = join(projectRoot, ".env.example");

export function parseEnvironmentFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) throw new Error(`Invalid environment line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

export function ensureLocalApplicationEnvironment() {
  if (existsSync(applicationPath)) {
    chmodSync(applicationPath, 0o600);
    return { path: applicationPath, created: false };
  }

  if (!existsSync(infrastructurePath)) {
    throw new Error(
      ".env.infrastructure is missing; run npm run infra:up first",
    );
  }

  const infrastructure = parseEnvironmentFile(
    readFileSync(infrastructurePath, "utf8"),
  );
  const databasePassword = encodeURIComponent(
    infrastructure.POSTGRES_PASSWORD ?? "",
  );
  const redisPassword = encodeURIComponent(infrastructure.REDIS_PASSWORD ?? "");

  if (!databasePassword || !redisPassword) {
    throw new Error("Local infrastructure credentials are incomplete");
  }

  const generated = readFileSync(applicationExamplePath, "utf8")
    .replace("copy-from-env-infrastructure", databasePassword)
    .replace("copy-from-env-infrastructure", redisPassword);

  writeFileSync(applicationPath, generated, { mode: 0o600 });
  chmodSync(applicationPath, 0o600);
  return { path: applicationPath, created: true };
}

export function loadLocalApplicationEnvironment() {
  const result = ensureLocalApplicationEnvironment();
  process.loadEnvFile(result.path);
  return result;
}
