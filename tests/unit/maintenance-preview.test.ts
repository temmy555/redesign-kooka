import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
});
