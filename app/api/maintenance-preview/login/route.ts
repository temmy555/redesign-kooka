import { NextResponse } from "next/server";

import {
  createMaintenancePreviewToken,
  isMaintenanceModeEnabled,
  isMaintenancePreviewConfigured,
  MAINTENANCE_PREVIEW_COOKIE,
  verifyMaintenancePreviewPassword,
} from "../../../../src/platform/maintenance-preview";
import { isTrustedStaffMutation } from "../../../../src/platform/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isTrustedRequest(request: Request): boolean {
  return isTrustedStaffMutation({
    method: request.method,
    requestOrigin: new URL(request.url).origin,
    configuredOrigin: process.env.APP_URL,
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });
}

function isLimited(key: string, now: number): boolean {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.delete(key);
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string, now: number) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

function publicUrl(pathname: string, request: Request): URL {
  const configuredUrl = process.env.APP_URL?.trim();
  try {
    return new URL(pathname, configuredUrl || request.url);
  } catch {
    return new URL(pathname, request.url);
  }
}

function redirectTo(request: Request, error?: "invalid" | "limited") {
  const url = publicUrl("/maintenance-preview", request);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (
    !isMaintenanceModeEnabled() ||
    !isMaintenancePreviewConfigured() ||
    !isTrustedRequest(request)
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const key = clientKey(request);
  const now = Date.now();
  if (isLimited(key, now)) return redirectTo(request, "limited");

  let password = "";
  try {
    const body = await request.formData();
    const supplied = body.get("password");
    password = typeof supplied === "string" ? supplied : "";
  } catch {
    return redirectTo(request, "invalid");
  }

  if (!verifyMaintenancePreviewPassword(password)) {
    recordFailure(key, now);
    return redirectTo(request, "invalid");
  }

  attempts.delete(key);
  const { token, expiresAt } = createMaintenancePreviewToken(now);
  const response = NextResponse.redirect(publicUrl("/", request), 303);
  response.cookies.set(MAINTENANCE_PREVIEW_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
