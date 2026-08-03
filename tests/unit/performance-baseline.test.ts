import { describe, expect, it, vi } from "vitest";

import {
  percentile,
  runPerformanceScenario,
} from "../../scripts/performance-baseline.mjs";

describe("performance baseline", () => {
  it("computes deterministic nearest-rank percentiles", () => {
    expect(percentile([50, 10, 30, 20, 40], 0.5)).toBe(30);
    expect(percentile([50, 10, 30, 20, 40], 0.95)).toBe(50);
    expect(percentile([], 0.95)).toBe(0);
  });

  it("runs bounded concurrency and reports HTTP failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true });
    const result = await runPerformanceScenario({
      name: "test",
      url: "http://localhost/test",
      requests: 4,
      concurrency: 2,
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({
      requests: 4,
      failures: 1,
      failureRate: 0.25,
    });
  });
});
