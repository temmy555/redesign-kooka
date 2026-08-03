import { getAuth } from "../../../../src/platform/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// getAuth() is called per-request (not at module scope) so the route module
// can be loaded during `next build` without a live database connection,
// matching the lazy pattern already used by src/db/client.ts and
// app/api/health/route.ts.
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
