import "server-only";

import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDatabase } from "../db";
import { idempotencyKeys } from "../db/schema";
import type * as schema from "../db/schema";

/**
 * Idempotency service (Roadmap Langkah 8). Wraps a mutation so that
 * retrying the same logical request (same `scope`/`key`) never duplicates
 * the underlying record -- the exit-gate verification the roadmap asks
 * for: "retry tidak menggandakan record; failed job dapat diulang."
 *
 * The `idempotency_keys` row is claimed via `INSERT ... ON CONFLICT DO
 * NOTHING`, not a separate read-then-write, so two concurrent requests
 * racing on the same key cannot both believe they own it.
 */
export class IdempotencyInProgressError extends Error {
  constructor(scope: string, key: string) {
    super(
      `Request with idempotency key "${key}" in scope "${scope}" is already being processed`,
    );
    this.name = "IdempotencyInProgressError";
  }
}

/**
 * The same (scope, key) pair was reused for a request with a different
 * body/requestHash. This is a caller bug (or a client-generated key
 * collision), not something that should silently replay the wrong
 * response.
 */
export class IdempotencyConflictError extends Error {
  constructor(scope: string, key: string) {
    super(
      `Idempotency key "${key}" in scope "${scope}" was already used for a different request`,
    );
    this.name = "IdempotencyConflictError";
  }
}

export interface IdempotentResult<T extends Record<string, unknown>> {
  resultType: string;
  resultId?: string;
  response: T;
}

export interface WithIdempotencyParams {
  scope: string;
  key: string;
  requestHash: string;
  ownerUserId?: string | null;
  /** How long a claimed key stays valid. Default 24h. */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type DrizzleDb = NodePgDatabase<typeof schema>;
export type IdempotencyTransaction = Parameters<
  Parameters<DrizzleDb["transaction"]>[0]
>[0];

function sameOwner(
  stored: string | null,
  requested: string | null | undefined,
): boolean {
  return stored === (requested ?? null);
}

export async function withIdempotency<T extends Record<string, unknown>>(
  params: WithIdempotencyParams,
  run: (tx: IdempotencyTransaction) => Promise<IdempotentResult<T>>,
): Promise<T> {
  const db = getDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.ttlMs ?? DEFAULT_TTL_MS));

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(idempotencyKeys)
      .values({
        scope: params.scope,
        key: params.key,
        requestHash: params.requestHash,
        ownerUserId: params.ownerUserId ?? null,
        status: "PROCESSING",
        expiresAt,
      })
      .onConflictDoNothing({
        target: [idempotencyKeys.scope, idempotencyKeys.key],
      })
      .returning({ id: idempotencyKeys.id });

    if (inserted.length === 0) {
      const [existing] = await tx
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.scope, params.scope),
            eq(idempotencyKeys.key, params.key),
          ),
        )
        .limit(1)
        .for("update");

      if (!existing) {
        throw new IdempotencyInProgressError(params.scope, params.key);
      }

      const expired = existing.expiresAt.getTime() <= now.getTime();
      if (!expired) {
        if (
          existing.requestHash !== params.requestHash ||
          !sameOwner(existing.ownerUserId, params.ownerUserId)
        ) {
          throw new IdempotencyConflictError(params.scope, params.key);
        }
        if (existing.status === "COMPLETED") {
          return existing.responseSnapshot as T;
        }
        if (existing.status === "PROCESSING") {
          throw new IdempotencyInProgressError(params.scope, params.key);
        }
      }

      const reclaimed = await tx
        .update(idempotencyKeys)
        .set({
          requestHash: params.requestHash,
          ownerUserId: params.ownerUserId ?? null,
          status: "PROCESSING",
          resultType: null,
          resultId: null,
          responseSnapshot: null,
          completedAt: null,
          expiresAt,
        })
        .where(
          and(
            eq(idempotencyKeys.scope, params.scope),
            eq(idempotencyKeys.key, params.key),
          ),
        )
        .returning({ id: idempotencyKeys.id });

      if (reclaimed.length === 0) {
        throw new IdempotencyInProgressError(params.scope, params.key);
      }
    }

    // The callback receives this exact transaction. Every domain mutation,
    // outbox insert, mandatory audit row, and idempotency completion must use
    // it so they commit or roll back as one unit.
    const result = await run(tx);
    await tx
      .update(idempotencyKeys)
      .set({
        status: "COMPLETED",
        resultType: result.resultType,
        resultId: result.resultId ?? null,
        responseSnapshot: result.response,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(idempotencyKeys.scope, params.scope),
          eq(idempotencyKeys.key, params.key),
          eq(idempotencyKeys.status, "PROCESSING"),
        ),
      );
    return result.response;
  });
}
