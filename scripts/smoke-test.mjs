import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_TIMEOUT_MS = 10_000;
const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const EXPECTED_MAINTENANCE_VALUES = new Set(["either", "on", "off"]);

function booleanEnvironment(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return new Set(["1", "true", "yes", "on"]).has(value.toLowerCase());
}

function dateInJakarta(offsetDays) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(Date.now() + offsetDays * 86_400_000))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

export function smokeConfiguration(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  const baseUrl = new URL(
    optionValue(argv, "--url") ??
      environment.SMOKE_BASE_URL ??
      DEFAULT_BASE_URL,
  );
  const timeoutMs = Number(
    optionValue(argv, "--timeout") ??
      environment.SMOKE_TIMEOUT_MS ??
      DEFAULT_TIMEOUT_MS,
  );
  const expectedMaintenance = (
    optionValue(argv, "--maintenance") ??
    environment.SMOKE_EXPECT_MAINTENANCE ??
    "either"
  ).toLowerCase();

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error(
      "Smoke timeout must be between 1000 and 120000 milliseconds",
    );
  }
  if (!EXPECTED_MAINTENANCE_VALUES.has(expectedMaintenance)) {
    throw new Error("Maintenance expectation must be either, on, or off");
  }

  const staffEmail = environment.SMOKE_STAFF_EMAIL?.trim() || null;
  const staffPassword = environment.SMOKE_STAFF_PASSWORD || null;
  if (Boolean(staffEmail) !== Boolean(staffPassword)) {
    throw new Error(
      "SMOKE_STAFF_EMAIL and SMOKE_STAFF_PASSWORD must be supplied together",
    );
  }

  return {
    baseUrl,
    timeoutMs,
    expectedMaintenance,
    previewPassword: environment.SMOKE_PREVIEW_PASSWORD || null,
    staffEmail,
    staffPassword,
    requireHealthyOutbox: booleanEnvironment(
      environment.SMOKE_REQUIRE_HEALTHY_OUTBOX,
      true,
    ),
    json: argv.includes("--json") || booleanEnvironment(environment.SMOKE_JSON),
  };
}

function cookiesFrom(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return { text, json: null };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function runSmokeTests(configuration, fetchImpl = fetch) {
  const results = [];
  const warnings = [];
  let previewCookie = "";
  let staffCookie = "";

  async function request(path, init = {}) {
    return fetchImpl(new URL(path, configuration.baseUrl), {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(configuration.timeoutMs),
      ...init,
      headers: {
        "user-agent": "kooka-automated-smoke/1.0",
        ...init.headers,
      },
    });
  }

  async function check(name, callback) {
    const startedAt = performance.now();
    try {
      const detail = await callback();
      results.push({
        name,
        status: "PASS",
        durationMs: Math.round(performance.now() - startedAt),
        detail,
      });
    } catch (error) {
      results.push({
        name,
        status: "FAIL",
        durationMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await check("Application, database, and worker readiness", async () => {
    const response = await request("/api/health");
    const { json } = await responsePayload(response);
    assert(response.status === 200, `health returned HTTP ${response.status}`);
    assert(json && typeof json === "object", "health did not return JSON");
    assert(json.database?.status === "connected", "database is not connected");
    assert(json.database?.schemaReady === true, "database schema is not ready");

    if (configuration.requireHealthyOutbox) {
      assert(
        json.outbox?.status === "ok",
        `worker/outbox is ${json.outbox?.status ?? "unknown"}`,
      );
    }
    if (json.redis?.status !== "ok") {
      warnings.push("Redis is unavailable (allowed because Redis is optional)");
    }
    if ((json.outbox?.deadLetterCount ?? 0) > 0) {
      warnings.push(
        `${json.outbox.deadLetterCount} outbox event(s) require manual review`,
      );
    }
    return `database ${json.database.latencyMs ?? "?"}ms; outbox ${json.outbox?.status ?? "unknown"}`;
  });

  await check("English landing content API", async () => {
    const response = await request("/api/content/landing?locale=en");
    const { json } = await responsePayload(response);
    assert(
      response.status === 200,
      `landing API returned HTTP ${response.status}`,
    );
    assert(json?.locale === "en", "landing API did not return English content");
    assert(
      typeof json?.property?.name === "string",
      "property profile is missing",
    );
    assert(Array.isArray(json?.sections), "landing sections are missing");
    assert(Array.isArray(json?.rooms), "landing room types are missing");
    return `${json.sections.length} sections; ${json.rooms.length} room types`;
  });

  await check("English menu API", async () => {
    const response = await request("/api/content/menu?locale=en");
    const { json } = await responsePayload(response);
    assert(
      response.status === 200,
      `menu API returned HTTP ${response.status}`,
    );
    assert(json?.locale === "en", "menu API did not return English content");
    assert(Array.isArray(json?.categories), "menu categories are missing");
    const itemCount = json.categories.reduce(
      (total, category) =>
        total + (Array.isArray(category.items) ? category.items.length : 0),
      0,
    );
    return `${json.categories.length} categories; ${itemCount} items`;
  });

  if (configuration.previewPassword) {
    await check("Maintenance preview authentication", async () => {
      const body = new URLSearchParams({
        password: configuration.previewPassword,
      });
      const response = await request("/api/maintenance-preview/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: configuration.baseUrl.origin,
        },
        body,
      });
      previewCookie = cookiesFrom(response);
      assert(
        response.status === 303,
        `preview login returned HTTP ${response.status}`,
      );
      assert(previewCookie, "preview login did not issue an access cookie");
      return "protected production preview opened";
    });
  }

  await check("Read-only room availability", async () => {
    const query = new URLSearchParams({
      checkInDate: dateInJakarta(1),
      checkoutDate: dateInJakarta(2),
      rooms: "1",
      adults: "2",
      children: "0",
      infants: "0",
    });
    const response = await request(`/api/booking/availability?${query}`, {
      headers: previewCookie ? { cookie: previewCookie } : undefined,
    });
    const { json, text } = await responsePayload(response);
    const blockedByMaintenance =
      response.status === 503 &&
      (json?.error?.code === "SERVICE_UNAVAILABLE" ||
        /under maintenance|currently under maintenance/i.test(text));
    if (
      blockedByMaintenance &&
      !previewCookie &&
      configuration.expectedMaintenance !== "off"
    ) {
      return "public booking search is blocked as expected during maintenance";
    }
    assert(
      response.status === 200,
      `availability API returned HTTP ${response.status}`,
    );
    assert(
      json && typeof json === "object",
      "availability API did not return JSON",
    );
    return "search completed without creating a booking";
  });

  await check("Staff login page", async () => {
    const response = await request("/staff/login");
    const { text } = await responsePayload(response);
    assert(
      response.status === 200,
      `staff login returned HTTP ${response.status}`,
    );
    assert(/KOOKA/i.test(text), "staff login page content is incomplete");
    return "login form is reachable";
  });

  await check("Public website state", async () => {
    const response = await request("/", {
      headers: previewCookie ? { cookie: previewCookie } : undefined,
    });
    const { text } = await responsePayload(response);
    const maintenance =
      response.status === 503 || /under maintenance|coming soon/i.test(text);
    assert(
      response.status === 200 || (response.status === 503 && maintenance),
      `public website returned HTTP ${response.status}`,
    );
    if (configuration.expectedMaintenance === "on") {
      assert(maintenance, "maintenance mode was expected but is not active");
    }
    if (configuration.expectedMaintenance === "off") {
      assert(!maintenance, "maintenance mode is still active");
    }
    if (previewCookie) {
      assert(!maintenance, "preview cookie did not bypass maintenance mode");
    }
    assert(/KOOKA/i.test(text), "public page does not contain KOOKA content");
    return maintenance
      ? "maintenance page is active"
      : "landing page is active";
  });

  if (configuration.staffEmail && configuration.staffPassword) {
    await check("Staff credential and permission session", async () => {
      const response = await request("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: configuration.baseUrl.origin,
        },
        body: JSON.stringify({
          email: configuration.staffEmail,
          password: configuration.staffPassword,
          rememberMe: false,
          callbackURL: "/staff",
        }),
      });
      staffCookie = cookiesFrom(response);
      assert(response.ok, `staff sign-in returned HTTP ${response.status}`);
      assert(staffCookie, "staff sign-in did not issue a session cookie");

      const permissionResponse = await request("/api/staff/me/permissions", {
        headers: { cookie: staffCookie },
      });
      const { json } = await responsePayload(permissionResponse);
      assert(
        permissionResponse.status === 200,
        `permission session returned HTTP ${permissionResponse.status}`,
      );
      assert(
        Array.isArray(json?.permissions),
        "resolved permissions are missing",
      );
      return `${json.permissions.length} permissions resolved`;
    });
  }

  return {
    baseUrl: configuration.baseUrl.origin,
    checkedAt: new Date().toISOString(),
    results,
    warnings,
    passed: results.every((result) => result.status === "PASS"),
  };
}

function printReport(report) {
  console.log(`\nKOOKA smoke test · ${report.baseUrl}`);
  console.log("─".repeat(72));
  for (const result of report.results) {
    const symbol = result.status === "PASS" ? "✓" : "✗";
    console.log(
      `${symbol} ${result.status.padEnd(4)} ${result.name} (${result.durationMs}ms)`,
    );
    console.log(`       ${result.detail}`);
  }
  for (const warning of report.warnings) console.log(`! WARN ${warning}`);
  console.log("─".repeat(72));
  console.log(report.passed ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED");
}

async function main() {
  const configuration = smokeConfiguration();
  const report = await runSmokeTests(configuration);
  if (configuration.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  if (!report.passed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
