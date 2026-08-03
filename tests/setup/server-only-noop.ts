/**
 * Vitest-only stub for the `server-only` package.
 *
 * `server-only`'s real `index.js` unconditionally throws
 * ("This module cannot be imported from a Client Component module...").
 * That's safe in a real app build because Next.js's webpack config aliases
 * `server-only` to a no-op for the server bundle and only lets the throwing
 * version reach the client bundle -- the package relies entirely on that
 * bundler-level substitution, it has no runtime environment check of its
 * own. Vitest runs everything in plain Node with no such substitution, so
 * every module that does `import "server-only"` (audit, idempotency,
 * outbox, file-storage, email, authorization, session, property,
 * rbac-admin, auth, ...) throws the instant it's imported directly, not
 * just when actually used from a client component.
 *
 * `vitest.config.ts` aliases `server-only` to this file so those modules
 * stay importable under test, exactly mirroring what Next.js's build does
 * for the server bundle. This does not weaken the real production
 * server/client boundary -- `next build` still uses Next's own aliasing,
 * this file only affects `vitest run`.
 */
export {};
