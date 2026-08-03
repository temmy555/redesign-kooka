import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Minimal thenable chain mimicking the slice of the Drizzle query builder
 * `src/platform/outbox.ts` calls, including `.orderBy()`/`.for()` for the
 * `SELECT ... FOR UPDATE SKIP LOCKED` claim query. `recorder`, when passed,
 * captures the payload given to `.set()`/`.values()` so a test can assert
 * on it without re-implementing SQL.
 */
function chain(resolveValue: unknown, recorder: Record<string, unknown> = {}) {
  const link: Record<string, unknown> = {
    values: (v: unknown) => {
      recorder.values = v;
      return link;
    },
    set: (v: unknown) => {
      recorder.set = v;
      return link;
    },
    onConflictDoNothing: () => link,
    returning: () => link,
    from: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
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

const { loggerError, loggerWarn } = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ insert, select, update, transaction }),
}));

vi.mock("../../src/platform/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarn,
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
  claimNextOutboxEvent,
  enqueueOutboxEvent,
  processNextOutboxEvent,
  wasOutboxEventAlreadyCompleted,
} from "../../src/platform/outbox";

beforeEach(() => {
  insert.mockReset();
  select.mockReset();
  update.mockReset();
  transaction.mockReset();
  loggerError.mockReset();
  loggerWarn.mockReset();
  // The transaction callback receives a tx handle; select/update on it are
  // the same mocks the rest of the module also uses non-transactionally,
  // which is enough to control both call sites from one test.
  transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({ insert, select, update }),
  );
});

describe("enqueueOutboxEvent", () => {
  it("inserts a row with the given topic and payload", async () => {
    const recorder: Record<string, unknown> = {};
    insert.mockReturnValueOnce(chain(undefined, recorder));

    await enqueueOutboxEvent({
      topic: "email.send",
      aggregateType: "booking",
      aggregateId: "b-1",
      payload: { to: "guest@example.com" },
    });

    expect(recorder.values).toMatchObject({
      topic: "email.send",
      aggregateType: "booking",
      aggregateId: "b-1",
    });
  });
});

describe("claimNextOutboxEvent", () => {
  it("returns null when nothing is due", async () => {
    select.mockReturnValueOnce(chain([]));

    const claimed = await claimNextOutboxEvent("worker-1");

    expect(claimed).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("locks and returns the claimed row when one is due", async () => {
    select.mockReturnValueOnce(
      chain([{ id: "e-1", topic: "email.send", attempts: 0 }]),
    );
    const recorder: Record<string, unknown> = {};
    update.mockReturnValueOnce(
      chain(
        [
          {
            id: "e-1",
            topic: "email.send",
            attempts: 0,
            status: "PROCESSING",
            lockedBy: "worker-1",
            lockedAt: new Date(),
          },
        ],
        recorder,
      ),
    );

    const claimed = await claimNextOutboxEvent("worker-1");

    expect(claimed).toMatchObject({ id: "e-1" });
    expect(recorder.set).toMatchObject({
      status: "PROCESSING",
      lockedBy: "worker-1",
    });
  });
});

describe("wasOutboxEventAlreadyCompleted", () => {
  it("is true only when a COMPLETED job_executions row exists", async () => {
    select.mockReturnValueOnce(chain([{ status: "COMPLETED" }]));
    await expect(
      wasOutboxEventAlreadyCompleted({ id: "e-1", topic: "email.send" }),
    ).resolves.toBe(true);
  });

  it("is false when no row exists", async () => {
    select.mockReturnValueOnce(chain([]));
    await expect(
      wasOutboxEventAlreadyCompleted({ id: "e-1", topic: "email.send" }),
    ).resolves.toBe(false);
  });
});

describe("processNextOutboxEvent", () => {
  it("returns false and does nothing else when nothing is due", async () => {
    select.mockReturnValueOnce(chain([])); // claim

    const didWork = await processNextOutboxEvent("worker-1", {});

    expect(didWork).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("retries (not dead-letters) a missing handler on the first failure", async () => {
    select.mockReturnValueOnce(
      chain([{ id: "e-1", topic: "unregistered.topic", attempts: 0 }]),
    ); // claim
    update.mockReturnValueOnce(
      chain([
        {
          id: "e-1",
          topic: "unregistered.topic",
          attempts: 0,
          status: "PROCESSING",
          lockedBy: "worker-1",
        },
      ]),
    ); // claim
    const recorder: Record<string, unknown> = {};
    update.mockReturnValueOnce(chain(undefined, recorder)); // retry update

    const didWork = await processNextOutboxEvent("worker-1", {});

    expect(didWork).toBe(true);
    expect(recorder.set).toMatchObject({ status: "PENDING", attempts: 1 });
  });

  it("does not call the handler again for an event already completed -- retry tidak menggandakan record", async () => {
    select.mockReturnValueOnce(
      chain([{ id: "e-1", topic: "email.send", attempts: 1 }]),
    ); // claim
    update.mockReturnValueOnce(
      chain([
        {
          id: "e-1",
          topic: "email.send",
          attempts: 1,
          status: "PROCESSING",
          lockedBy: "worker-1",
        },
      ]),
    ); // claim
    select.mockReturnValueOnce(chain([{ status: "COMPLETED" }])); // already completed
    update.mockReturnValueOnce(chain([{ id: "e-1" }])); // completeOutboxEvent's outbox_events update
    insert.mockReturnValueOnce(chain(undefined)); // completeOutboxEvent's job_executions insert
    const handler = vi.fn();

    const didWork = await processNextOutboxEvent("worker-1", {
      "email.send": handler,
    });

    expect(didWork).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler once and records COMPLETED on success", async () => {
    select.mockReturnValueOnce(
      chain([{ id: "e-1", topic: "email.send", attempts: 0 }]),
    ); // claim
    update.mockReturnValueOnce(
      chain([
        {
          id: "e-1",
          topic: "email.send",
          attempts: 0,
          status: "PROCESSING",
          lockedBy: "worker-1",
        },
      ]),
    ); // claim
    select.mockReturnValueOnce(chain([])); // not already completed
    const completeRecorder: Record<string, unknown> = {};
    update.mockReturnValueOnce(chain([{ id: "e-1" }], completeRecorder)); // complete update
    const insertRecorder: Record<string, unknown> = {};
    insert.mockReturnValueOnce(chain(undefined, insertRecorder)); // job_executions insert
    const handler = vi.fn().mockResolvedValue({ messageId: "abc" });

    const didWork = await processNextOutboxEvent("worker-1", {
      "email.send": handler,
    });

    expect(didWork).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(completeRecorder.set).toMatchObject({ status: "COMPLETED" });
    expect(insertRecorder.values).toMatchObject({ status: "COMPLETED" });
  });

  it("moves an event to DEAD_LETTER once MAX_ATTEMPTS is reached instead of retrying forever", async () => {
    select.mockReturnValueOnce(
      chain([{ id: "e-1", topic: "email.send", attempts: 7 }]),
    ); // claim (about to become attempt 8)
    update.mockReturnValueOnce(
      chain([
        {
          id: "e-1",
          topic: "email.send",
          attempts: 7,
          status: "PROCESSING",
          lockedBy: "worker-1",
        },
      ]),
    ); // claim
    select.mockReturnValueOnce(chain([])); // not already completed
    const deadLetterRecorder: Record<string, unknown> = {};
    update.mockReturnValueOnce(chain([{ id: "e-1" }], deadLetterRecorder)); // dead-letter update
    const insertRecorder: Record<string, unknown> = {};
    insert.mockReturnValueOnce(chain(undefined, insertRecorder)); // job_executions insert
    const handler = vi.fn().mockRejectedValue(new Error("smtp unreachable"));

    const didWork = await processNextOutboxEvent("worker-1", {
      "email.send": handler,
    });

    expect(didWork).toBe(true);
    expect(deadLetterRecorder.set).toMatchObject({
      status: "DEAD_LETTER",
      attempts: 8,
    });
    expect(insertRecorder.values).toMatchObject({ status: "DEAD_LETTER" });
    expect(loggerError).toHaveBeenCalledTimes(1);
  });
});
