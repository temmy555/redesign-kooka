import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { z } from "zod";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const composeFile = join(projectRoot, "infra", "compose.yaml");
const environmentExample = join(projectRoot, ".env.infrastructure.example");
const environmentFile = join(projectRoot, ".env.infrastructure");

const environmentSchema = z.object({
  COMPOSE_PROJECT_NAME: z.string().regex(/^[a-z0-9][a-z0-9_-]+$/),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(24),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().min(1024).max(65535),
  REDIS_PASSWORD: z.string().min(24),
  REDIS_PORT: z.coerce.number().int().min(1024).max(65535),
  MAILPIT_SMTP_PORT: z.coerce.number().int().min(1024).max(65535),
  MAILPIT_UI_PORT: z.coerce.number().int().min(1024).max(65535),
  TZ: z.literal("Asia/Jakarta"),
});

function parseEnvironment(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) {
          throw new Error(`Invalid environment line: ${line}`);
        }
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function ensureEnvironmentFile() {
  if (!existsSync(environmentFile)) {
    const generated = readFileSync(environmentExample, "utf8")
      .replace(
        "__GENERATE_POSTGRES_PASSWORD__",
        randomBytes(24).toString("base64url"),
      )
      .replace(
        "__GENERATE_REDIS_PASSWORD__",
        randomBytes(24).toString("base64url"),
      );
    writeFileSync(environmentFile, generated, { mode: 0o600 });
    console.log(
      "Created ignored .env.infrastructure with generated local secrets.",
    );
  }

  chmodSync(environmentFile, 0o600);
  return environmentSchema.parse(
    parseEnvironment(readFileSync(environmentFile, "utf8")),
  );
}

function runDocker(arguments_, { capture = false } = {}) {
  const result = spawnSync("docker", arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Docker command failed with exit code ${result.status}`);
  }
  return result.stdout?.trim() ?? "";
}

function compose(arguments_, options) {
  return runDocker(
    [
      "compose",
      "--env-file",
      environmentFile,
      "-f",
      composeFile,
      ...arguments_,
    ],
    options,
  );
}

function assertDockerAvailable() {
  runDocker(["info"], { capture: true });
}

async function waitForMailpit(port) {
  const endpoint = `http://127.0.0.1:${port}/readyz`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {
      // Mailpit may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Mailpit did not become ready at ${endpoint}`);
}

async function health(environment) {
  compose([
    "exec",
    "-T",
    "postgres",
    "pg_isready",
    "-U",
    environment.POSTGRES_USER,
    "-d",
    environment.POSTGRES_DB,
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "sh",
    "-eu",
    "-c",
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping',
  ]);
  compose(["run", "--rm", "storage-init"]);
  await waitForMailpit(environment.MAILPIT_UI_PORT);

  for (const [service, internalPort] of [
    ["postgres", "5432"],
    ["redis", "6379"],
    ["mailpit", "1025"],
    ["mailpit", "8025"],
  ]) {
    const binding = compose(["port", service, internalPort], { capture: true });
    if (!binding.startsWith("127.0.0.1:")) {
      throw new Error(
        `${service}:${internalPort} is not loopback-only: ${binding}`,
      );
    }
  }

  console.log("Local infrastructure is healthy and loopback-only.");
  console.log(`Mailpit UI: http://127.0.0.1:${environment.MAILPIT_UI_PORT}`);
}

async function main() {
  const command = process.argv[2] ?? "status";
  const environment = ensureEnvironmentFile();
  assertDockerAvailable();

  if (command === "config") {
    compose(["config", "--quiet"]);
    console.log("Compose configuration is valid.");
    return;
  }

  if (command === "up") {
    compose(["config", "--quiet"]);
    compose(["run", "--rm", "storage-init"]);
    compose([
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "120",
      "postgres",
      "redis",
      "mailpit",
    ]);
    await health(environment);
    return;
  }

  if (command === "down") {
    compose(["down", "--remove-orphans"]);
    console.log("Local services stopped; named volumes were preserved.");
    return;
  }

  if (command === "health") {
    await health(environment);
    return;
  }

  if (command === "status") {
    compose(["ps"]);
    return;
  }

  throw new Error(`Unknown infra command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
