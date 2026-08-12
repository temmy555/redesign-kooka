import { NextResponse } from "next/server";

import { MAINTENANCE_PREVIEW_COOKIE } from "../../../../src/platform/maintenance-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const response = NextResponse.redirect(
    new URL("/maintenance-preview", request.url),
    303,
  );
  response.cookies.set(MAINTENANCE_PREVIEW_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
