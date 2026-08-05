import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

function isTrue(value: string | undefined | null): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const maintenanceMode = isTrue(process.env.SITE_MAINTENANCE_MODE);
  if (!maintenanceMode) return NextResponse.next();

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

  if (allowlist.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/")
  ) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|images|public|assets).*)"],
};
