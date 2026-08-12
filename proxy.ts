import { type NextRequest, NextResponse } from "next/server";

import {
  isMaintenanceModeEnabled,
  isValidMaintenancePreviewToken,
  MAINTENANCE_PREVIEW_COOKIE,
} from "./src/platform/maintenance-preview";
import { isTrustedStaffMutation } from "./src/platform/request-security";

function isMaintenanceAllowedPath(pathname: string) {
  const allowlist = [
    "/staff",
    "/api/auth",
    "/api/health",
    "/api/staff",
    "/api/content",
    "/api/maintenance-preview",
    "/maintenance",
    "/maintenance-preview",
    "/preview",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
  ];

  if (
    allowlist.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  if (
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
  const previewActive = isValidMaintenancePreviewToken(
    request.cookies.get(MAINTENANCE_PREVIEW_COOKIE)?.value,
  );

  if (
    isMaintenanceModeEnabled() &&
    !previewActive &&
    !isMaintenanceAllowedPath(pathname)
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "The website is currently under maintenance",
          },
        },
        { status: 503, headers: { "Retry-After": "3600" } },
      );
    }
    return NextResponse.rewrite(new URL("/maintenance", request.url), {
      status: 503,
    });
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
