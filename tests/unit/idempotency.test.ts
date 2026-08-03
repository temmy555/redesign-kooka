import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Minimal thenable chain mimicking the slice of the Drizzle query builder
 * `src/platform/idempotency.ts` calls (`insert().values().onConflictDoNothing().returning()`,
 * `select().from().where().limit()`, `update().set().where()` and
 * `update().set().where().returning()`), matching the style already used in
 * tests/unit/authorization.test.ts.
 */
function chain(resolveValue: unknown) {
  const link: Record<string, unknown> = {
    values: () => link,
    onConflictDoNothing: () => link,
    returning: () => link,
    from: () => link,
    where: () => link,
    limit: () => link,
    for: () => link,
    set: () => link,
    then: (resolve: (value: unknown) => void) => resolve(resolveValue),
  };
  return link;
}

const { insert, select, update, transaction } = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ insert, select, update, transaction }),
}));

vi.mock("../../src/platform/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerError,
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }),
}));

import {
  IdempotencyConflictError,
  IdempotencyInProgressError,
  withIdempotency,
} from "../../src/platform/idempotency";

const BASE_PARAMS = {
  scope: "booking.create",
  key: "client-key-1",
  requestHash: "hash-a",
};

describe("withIdempotency", () => {
  beforeEach(() => {
    insert.mockReset();
    select.mockReset();
    update.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ insert, select, update }),
    );
    loggerError.mockReset();
  });

  it("runs the handler and records COMPLETED on a fresh claim", async () => {
    insert.mockReturnValueOnce(chain([{ id: "row-1" }])); // claim insert
    update.mockReturnValueOnce(chain(undefined)); // mark COMPLETED
    const run = vi.fn().mockResolvedValue({
      resultType: "booking",
      resultId: "b-1",
      response: { bookingId: "b-1" },
    });

    const result = await withIdempotency(BASE_PARAMS, run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ bookingId: "b-1" });
  });

  it("does not run the handler again and replays the stored response for a COMPLETED duplicate", async () => {
    insert.mockReturnValueOnce(chain([])); // conflict: someone else already claimed it
    select.mockReturnValueOnce(
      chain([
        {
          status: "COMPLETED",
          requestHash: "hash-a",
          ownerUserId: null,
          expiresAt: new Date(Date.now() + 60_000),
          responseSnapshot: { bookingId: "b-1" },
        },
      ]),
    );
    const run = vi.fn();

    const result = await withIdempotency(BASE_PARAMS, run);

    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({ bookingId: "b-1" });
  });

  it("throws IdempotencyInProgressError instead of duplicating an in-flight request", async () => {
    insert.mockReturnValueOnce(chain([]));
    select.mockReturnValueOnce(
      chain([
        {
          status: "PROCESSING",
          requestHash: "hash-a",
          ownerUserId: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]),
    );
    const run = vi.fn();

    await expect(withIdempotency(BASE_PARAMS, run)).rejects.toBeInstanceOf(
      IdempotencyInProgressError,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("throws IdempotencyConflictError when the same key is reused for a different request body", async () => {
    insert.mockReturnValueOnce(chain([]));
    select.mockReturnValueOnce(
      chain([
        {
          status: "COMPLETED",
          requestHash: "hash-different",
          ownerUserId: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]),
    );

    await expect(withIdempotency(BASE_PARAMS, vi.fn())).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it("reclaims and retries a previously FAILED key -- failed job dapat diulang", async () => {
    insert.mockReturnValueOnce(chain([]));
    select.mockReturnValueOnce(
      chain([
        {
          status: "FAILED",
          requestHash: "hash-a",
          ownerUserId: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]),
    );
    update.mockReturnValueOnce(chain([{ id: "row-1" }])); // reclaim succeeds
    update.mockReturnValueOnce(chain(undefined)); // mark COMPLETED
    const run = vi.fn().mockResolvedValue({
      resultType: "booking",
      response: { bookingId: "b-1" },
    });

    const result = await withIdempotency(BASE_PARAMS, run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ bookingId: "b-1" });
  });

  it("rolls the transaction back when the handler throws", async () => {
    insert.mockReturnValueOnce(chain([{ id: "row-1" }]));
    const run = vi.fn().mockRejectedValue(new Error("downstream boom"));

    await expect(withIdempotency(BASE_PARAMS, run)).rejects.toThrow(
      "downstream boom",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("reclaims an expired PROCESSING key instead of leaving it stuck forever", async () => {
    insert.mockReturnValueOnce(chain([]));
    select.mockReturnValueOnce(
      chain([
        {
          status: "PROCESSING",
          requestHash: "old-hash",
          ownerUserId: null,
          expiresAt: new Date(Date.now() - 1_000),
        },
      ]),
    );
    update.mockReturnValueOnce(chain([{ id: "row-1" }]));
    update.mockReturnValueOnce(chain(undefined));

    await expect(
      withIdempotency(BASE_PARAMS, async () => ({
        resultType: "booking",
        response: { bookingId: "b-2" },
      })),
    ).resolves.toEqual({ bookingId: "b-2" });
  });
});
