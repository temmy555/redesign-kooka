import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("local infrastructure contract", () => {
  it("pins service images and keeps every host port on loopback", async () => {
    const compose = await readFile(
      new URL("../../infra/compose.yaml", import.meta.url),
      "utf8",
    );

    expect(compose).toContain("postgres:18.4-alpine3.23");
    expect(compose).toContain("redis:8.8.1-alpine3.23");
    expect(compose).toContain("axllent/mailpit:v1.30.5");
    expect(compose).not.toMatch(/^\s+-\s+\$\{[^\n]+:\d+$/mu);
    expect(compose.match(/127\.0\.0\.1:/gu)).toHaveLength(4);
  });

  it("uses a project bridge and separate persistent volumes", async () => {
    const compose = await readFile(
      new URL("../../infra/compose.yaml", import.meta.url),
      "utf8",
    );

    expect(compose).toMatch(/backend:\n\s+driver: bridge/u);
    expect(compose).toContain("postgres_data:");
    expect(compose).toContain("redis_data:");
    expect(compose).toContain("mailpit_data:");
    expect(compose).toContain("private_files:");
    expect(compose).toContain("private-sensitive");
  });
});
