import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsertJobScheduler, QueueMock } = vi.hoisted(() => {
  const upsertJobScheduler = vi.fn();
  class QueueMock {
    name: string;
    opts: unknown;
    upsertJobScheduler = upsertJobScheduler;
    constructor(name: string, opts: unknown) {
      this.name = name;
      this.opts = opts;
    }
  }
  return { upsertJobScheduler, QueueMock };
});

const { WorkerMock, workerInstances } = vi.hoisted(() => {
  const workerInstances: InstanceType<typeof WorkerMockClass>[] = [];
  class WorkerMockClass {
    name: string;
    processor: (job: unknown) => unknown;
    opts: unknown;
    handlers: Record<string, (...args: unknown[]) => void> = {};
    constructor(
      name: string,
      processor: (job: unknown) => unknown,
      opts: unknown,
    ) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      workerInstances.push(this);
    }
    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers[event] = handler;
      return this;
    }
  }
  return { WorkerMock: WorkerMockClass, workerInstances };
});

const { processNextOutboxEvent } = vi.hoisted(() => ({
  processNextOutboxEvent: vi.fn(),
}));
const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }));
const { createRedisConnection } = vi.hoisted(() => ({
  createRedisConnection: vi.fn(() => ({ id: "fake-redis-connection" })),
}));

vi.mock("bullmq", () => ({ Queue: QueueMock, Worker: WorkerMock }));
vi.mock("../../src/platform/redis", () => ({ createRedisConnection }));
vi.mock("../../src/platform/outbox", () => ({ processNextOutboxEvent }));
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
  OUTBOX_QUEUE_NAME,
  createOutboxQueue,
  createOutboxWorker,
  scheduleOutboxDrainTick,
} from "../../src/platform/queue";

describe("createOutboxQueue / createOutboxWorker", () => {
  beforeEach(() => {
    upsertJobScheduler.mockReset();
    processNextOutboxEvent.mockReset();
    loggerError.mockReset();
    createRedisConnection.mockClear();
    workerInstances.length = 0;
  });

  it("requests a BullMQ-flavored Redis connection (maxRetriesPerRequest: null requirement)", () => {
    createOutboxQueue();
    expect(createRedisConnection).toHaveBeenCalledWith({ forBullMq: true });
  });

  it("schedules the drain tick via upsertJobScheduler, not a one-off repeat option", async () => {
    const queue = createOutboxQueue();
    await scheduleOutboxDrainTick(queue, 5_000);

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      "drain",
      { every: 5_000 },
      expect.objectContaining({ name: "drain" }),
    );
  });

  it("drains due outbox events in a loop until nothing is left, on a drain tick", async () => {
    processNextOutboxEvent
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    createOutboxWorker({});
    const worker = workerInstances[0];
    expect(worker.name).toBe(OUTBOX_QUEUE_NAME);

    await worker.processor({ name: "drain" });

    expect(processNextOutboxEvent).toHaveBeenCalledTimes(3);
  });

  it("ignores jobs that are not the drain tick", async () => {
    createOutboxWorker({});
    const worker = workerInstances[0];

    await worker.processor({ name: "something-else" });

    expect(processNextOutboxEvent).not.toHaveBeenCalled();
  });

  it("logs a failed drain tick through the shared structured logger", () => {
    createOutboxWorker({});
    const worker = workerInstances[0];

    worker.handlers.failed?.({ id: "job-1" }, new Error("redis timeout"));

    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", error: "redis timeout" }),
      expect.any(String),
    );
  });
});
