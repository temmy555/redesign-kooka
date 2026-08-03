import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const requiredRuntimePackages = [
  "better-auth",
  "bullmq",
  "drizzle-orm",
  "ioredis",
  "next",
  "nodemailer",
  "pdf-lib",
  "pg",
  "pino",
  "react",
  "react-dom",
  "zod",
] as const;

const requiredQualityPackages = [
  "@vitest/coverage-v8",
  "cross-env",
  "drizzle-kit",
  "eslint",
  "eslint-config-next",
  "prettier",
  "typescript",
  "vitest",
] as const;

describe("dependency baseline", () => {
  it("pins every selected dependency to an exact version", async () => {
    const contents = await readFile(
      new URL("../../package.json", import.meta.url),
      "utf8",
    );
    const packageJson = JSON.parse(contents) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      packageManager: string;
    };
    const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

    for (const name of requiredRuntimePackages) {
      expect(packageJson.dependencies[name], name).toMatch(exactVersion);
    }

    for (const name of requiredQualityPackages) {
      expect(packageJson.devDependencies[name], name).toMatch(exactVersion);
    }

    expect(packageJson.packageManager).toMatch(/^npm@\d+\.\d+\.\d+$/);
  });
});
