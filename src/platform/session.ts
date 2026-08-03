import "server-only";

import { headers } from "next/headers";

import { getAuth } from "./auth";

/**
 * Server-side session lookup for Server Components, Server Actions, and
 * route handlers. Reads the caller's own request cookies via Next.js's
 * `headers()` and asks Better Auth to resolve+validate the session against
 * the database — the client is never trusted for identity (see
 * docs/TECHNICAL-ARCHITECTURE.md §3).
 *
 * This only proves "who is this session for" (Roadmap Langkah 6's exit
 * gate). It does not check any module permission — that is Roadmap
 * Langkah 7's RBAC layer, built on top of the `userId` this returns.
 */
export async function getCurrentSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();
  if (!session) throw new Error("No authenticated staff session");
  return session;
}
