import { pathToFileURL } from "node:url";

export function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}

export async function runPerformanceScenario({
  name,
  url,
  requests = 60,
  concurrency = 6,
  fetchImpl = fetch,
}) {
  const latencies = [];
  let failures = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < requests) {
      cursor += 1;
      const started = performance.now();
      try {
        const response = await fetchImpl(url, {
          headers: { "user-agent": "kooka-hardening-baseline/1.0" },
          cache: "no-store",
        });
        if (!response.ok) failures += 1;
      } catch {
        failures += 1;
      } finally {
        latencies.push(performance.now() - started);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, requests) }, () => worker()),
  );
  return {
    name,
    requests,
    failures,
    failureRate: failures / requests,
    p50Ms: Math.round(percentile(latencies, 0.5)),
    p95Ms: Math.round(percentile(latencies, 0.95)),
    maxMs: Math.round(Math.max(...latencies)),
  };
}

async function main() {
  const baseUrl = new URL(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000");
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (
    !localHosts.has(baseUrl.hostname) &&
    process.env.PERF_ALLOW_REMOTE !== "true"
  ) {
    throw new Error("Remote performance runs require PERF_ALLOW_REMOTE=true");
  }
  const requests = Number(process.env.PERF_REQUESTS ?? 60);
  const concurrency = Number(process.env.PERF_CONCURRENCY ?? 6);
  const p95LimitMs = Number(process.env.PERF_P95_LIMIT_MS ?? 750);
  const scenarios = [
    ["health", "/api/health"],
    ["public-landing", "/api/content/landing?locale=id&currency=IDR"],
  ];
  const results = [];
  for (const [name, path] of scenarios) {
    results.push(
      await runPerformanceScenario({
        name,
        url: new URL(path, baseUrl).toString(),
        requests,
        concurrency,
      }),
    );
  }
  console.log(JSON.stringify({ baseUrl: baseUrl.origin, results }, null, 2));
  if (
    results.some(
      (result) => result.failureRate > 0.01 || result.p95Ms > p95LimitMs,
    )
  ) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
