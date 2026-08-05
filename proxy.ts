import { type NextRequest, NextResponse } from "next/server";

import { isTrustedStaffMutation } from "./src/platform/request-security";

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
function isTrue(value: string | undefined | null): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function isMaintenanceEnabled() {
  return isTrue(process.env.SITE_MAINTENANCE_MODE);
}

function isMaintenanceAllowedPath(pathname: string) {
  const allowlist = [
    "/staff",
    "/staff/login",
    "/api/health",
    "/maintenance",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
  ];

  if (allowlist.some((prefix) => pathname.startsWith(prefix))) return true;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/")
  ) {
    return true;
  }

  return false;
}

function isStaffApiPath(pathname: string) {
  return pathname.startsWith("/api/staff/");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isMaintenanceEnabled() && !isMaintenanceAllowedPath(pathname)) {
    return NextResponse.rewrite(new URL("/maintenance", request.url));
  }

  if (
    isStaffApiPath(pathname) &&
    !isTrustedStaffMutation({
      method: request.method,
      requestOrigin: request.nextUrl.origin,
      configuredOrigin: process.env.APP_URL,
      originHeader: request.headers.get("origin"),
      secFetchSite: request.headers.get("sec-fetch-site"),
    })
  ) {
    return NextResponse.json(
      {
        error: { code: "FORBIDDEN", message: "Request origin is not allowed" },
      },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|images|public|assets).*)"],
};
