import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PostgreSQL schema entrypoint", () => {
  it("keeps the approved domain exports reachable", async () => {
    const schemaIndex = await readFile(
      new URL("../../src/db/schema/index.ts", import.meta.url),
      "utf8",
    );

    expect(schemaIndex).toMatch(/\.\/lodging/);
    expect(schemaIndex).toMatch(/\.\/finance/);
    expect(schemaIndex).toMatch(/\.\/attendance/);
  });
});
