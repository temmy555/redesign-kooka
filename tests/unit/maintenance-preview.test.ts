import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as loginToMaintenancePreview } from "../../app/api/maintenance-preview/login/route";
import { proxy } from "../../proxy";
import {
  createMaintenancePreviewToken,
  isMaintenanceModeEnabled,
  isValidMaintenancePreviewToken,
  MAINTENANCE_PREVIEW_COOKIE,
  maintenancePreviewDurationSeconds,
  verifyMaintenancePreviewPassword,
} from "../../src/platform/maintenance-preview";

const originalEnvironment = { ...process.env };
const previewSecret = "Kooka123";

describe("maintenance production preview", () => {
  beforeEach(() => {
    process.env.SITE_MAINTENANCE_MODE = "on";
    process.env.APP_URL = "https://kookaresidencesby.com";
    process.env.MAINTENANCE_PREVIEW_SECRET = previewSecret;
    process.env.MAINTENANCE_PREVIEW_DURATION_HOURS = "8";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("signs a time-limited cookie without storing the preview password", () => {
    const now = Date.UTC(2026, 7, 12, 8, 0, 0);
    const { token, expiresAt } = createMaintenancePreviewToken(now);

    expect(token).not.toContain(previewSecret);
    expect(expiresAt.getTime()).toBe(now + 8 * 60 * 60 * 1_000);
    expect(isValidMaintenancePreviewToken(token, now + 1_000)).toBe(true);
    expect(isValidMaintenancePreviewToken(token, expiresAt.getTime())).toBe(
      false,
    );
    expect(isValidMaintenancePreviewToken(`${token}tampered`, now)).toBe(false);
  });

  it("validates configuration and bounds the access duration", () => {
    expect(isMaintenanceModeEnabled()).toBe(true);
    expect(verifyMaintenancePreviewPassword(previewSecret)).toBe(true);
    expect(verifyMaintenancePreviewPassword("incorrect-password")).toBe(false);

    process.env.MAINTENANCE_PREVIEW_SECRET = "short7";
    expect(verifyMaintenancePreviewPassword("short7")).toBe(false);

    process.env.MAINTENANCE_PREVIEW_DURATION_HOURS = "999";
    expect(maintenancePreviewDurationSeconds()).toBe(168 * 60 * 60);
  });

  it("blocks public booking APIs while maintenance is active", () => {
    const response = proxy(
      new NextRequest("https://kookaresidencesby.com/api/booking/availability"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3600");
  });

  it("allows the real production route with a valid preview cookie", () => {
    const { token } = createMaintenancePreviewToken();
    const request = new NextRequest("https://kookaresidencesby.com/", {
      headers: { cookie: `${MAINTENANCE_PREVIEW_COOKIE}=${token}` },
    });
    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts the configured production origin behind a reverse proxy", async () => {
    const response = await loginToMaintenancePreview(
      new Request("http://127.0.0.1:3000/api/maintenance-preview/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://kookaresidencesby.com",
          "sec-fetch-site": "same-origin",
          "x-real-ip": "203.0.113.10",
        },
        body: new URLSearchParams({ password: previewSecret }),
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://kookaresidencesby.com/",
    );
    expect(response.headers.get("set-cookie")).toContain(
      `${MAINTENANCE_PREVIEW_COOKIE}=`,
    );
  });

  it("continues to reject a cross-site preview login", async () => {
    const response = await loginToMaintenancePreview(
      new Request("http://127.0.0.1:3000/api/maintenance-preview/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "x-real-ip": "203.0.113.11",
        },
        body: new URLSearchParams({ password: previewSecret }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
