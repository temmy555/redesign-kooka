import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);

const infrastructurePath = join(projectRoot, ".env.infrastructure");
const applicationPath = join(projectRoot, ".env.local");
const applicationExamplePath = join(projectRoot, ".env.example");

function generatedSecret() {
  return randomBytes(32).toString("base64");
}

function configuredValue(contents, key) {
  const match = contents.match(new RegExp(`^${key}=(.*)$`, "mu"));
  return match?.[1]?.trim() ?? "";
}

function setEnvironmentValue(contents, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "mu");
  if (pattern.test(contents))
    return contents.replace(pattern, `${key}=${value}`);
  return `${contents.trimEnd()}\n${key}=${value}\n`;
}

function ensureGeneratedSecrets(contents) {
  const updatedKeys = [];
  let updated = contents;
  const authSecret = configuredValue(updated, "BETTER_AUTH_SECRET");
  if (!authSecret || authSecret === "generate-with-openssl-rand-base64-32") {
    updated = setEnvironmentValue(
      updated,
      "BETTER_AUTH_SECRET",
      generatedSecret(),
    );
    updatedKeys.push("BETTER_AUTH_SECRET");
  }

  const encryptionKey = configuredValue(updated, "DATA_ENCRYPTION_KEY");
  let decodedKeyLength = 0;
  try {
    decodedKeyLength = Buffer.from(encryptionKey, "base64").length;
  } catch {
    decodedKeyLength = 0;
  }
  if (
    !encryptionKey ||
    encryptionKey === "generate-with-openssl-rand-base64-32" ||
    decodedKeyLength !== 32
  ) {
    updated = setEnvironmentValue(
      updated,
      "DATA_ENCRYPTION_KEY",
      generatedSecret(),
    );
    updatedKeys.push("DATA_ENCRYPTION_KEY");
  }
  return { contents: updated, updatedKeys };
}

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
    const current = readFileSync(applicationPath, "utf8");
    const ensured = ensureGeneratedSecrets(current);
    if (ensured.updatedKeys.length > 0) {
      writeFileSync(applicationPath, ensured.contents, { mode: 0o600 });
    }
    chmodSync(applicationPath, 0o600);
    return {
      path: applicationPath,
      created: false,
      updatedKeys: ensured.updatedKeys,
    };
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

  const fromTemplate = readFileSync(applicationExamplePath, "utf8")
    .replace("copy-from-env-infrastructure", databasePassword)
    .replace("copy-from-env-infrastructure", redisPassword);
  const generated = ensureGeneratedSecrets(fromTemplate);

  writeFileSync(applicationPath, generated.contents, { mode: 0o600 });
  chmodSync(applicationPath, 0o600);
  return {
    path: applicationPath,
    created: true,
    updatedKeys: generated.updatedKeys,
  };
}

export function loadLocalApplicationEnvironment() {
  const result = ensureLocalApplicationEnvironment();
  process.loadEnvFile(result.path);
  return result;
}
