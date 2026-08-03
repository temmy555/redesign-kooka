import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const staffApiRoot = join(process.cwd(), "app", "api", "staff");

describe("staff authorization matrix", () => {
  it("keeps every staff API behind an individual server session", async () => {
    const entries = await readdir(staffApiRoot, { recursive: true });
    const routes = entries
      .filter((entry) => entry.endsWith("route.ts"))
      .map((entry) => join(staffApiRoot, entry));
    expect(routes.length).toBeGreaterThanOrEqual(15);
    for (const route of routes) {
      const source = await readFile(route, "utf8");
      expect(source, route).toContain("requireCurrentSession");
    }
  });

  it("keeps all staff mutation routes behind the central origin guard", async () => {
    const source = await readFile(join(process.cwd(), "proxy.ts"), "utf8");
    expect(source).toContain("isTrustedStaffMutation");
    expect(source).toContain("/api/staff/:path*");
  });
});
