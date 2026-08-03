import { type NextRequest, NextResponse } from "next/server";

import { isTrustedStaffMutation } from "./src/platform/request-security";

export function proxy(request: NextRequest) {
  if (
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
  matcher: "/api/staff/:path*",
};
