import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  withIdempotency: vi.fn(),
  tx: undefined as unknown,
}));

vi.mock("../../src/db", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("../../src/platform/authorization", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/platform/authorization")>();
  return { ...original, requirePermission: mocks.requirePermission };
});
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import {
  createExcelReportExport,
  getOperationalDashboard,
  runDailyRollover,
  runReconciliation,
  updateReconciliationException,
} from "../../src/modules/reporting/reporting-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const session = { user: { id: U1 } };

function selectChain(rows: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy"])
    chain[method] = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.for = vi.fn().mockResolvedValue(rows);
  chain.then = vi.fn((resolve: (value: unknown[]) => void) => resolve(rows));
  return chain;
}

function queuedDatabase(
  options: {
    selects?: unknown[][];
    returns?: unknown[][];
    executes?: unknown[][];
  } = {},
) {
  const selections = [...(options.selects ?? [])];
  const returns = [...(options.returns ?? [])];
  const executes = [...(options.executes ?? [])];
  const db: Record<string, ReturnType<typeof vi.fn>> = {};
  db.select = vi.fn(() => selectChain(selections.shift() ?? []));
  db.execute = vi.fn(async () => ({ rows: executes.shift() ?? [] }));
  db.insert = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.values = vi.fn(() => mutation);
    mutation.onConflictDoUpdate = vi.fn(() => mutation);
    mutation.onConflictDoNothing = vi.fn(() => mutation);
    mutation.returning = vi.fn(async () => returns.shift() ?? []);
    return mutation;
  });
  db.update = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.set = vi.fn(() => mutation);
    mutation.where = vi.fn().mockResolvedValue(undefined);
    return mutation;
  });
  return db;
}

describe("Batch 6 reporting and daily operations services", () => {
  beforeEach(() => {
    mocks.getDatabase.mockReset();
    mocks.requirePermission.mockReset().mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockReset().mockResolvedValue(undefined);
    mocks.withIdempotency
      .mockReset()
      .mockImplementation(
        async (
          _options: unknown,
          run: (tx: unknown) => Promise<{ response: unknown }>,
        ) => (await run(mocks.tx)).response,
      );
  });

  it("builds queues and separates revenue, payments, refunds, and outstanding", async () => {
    const db = queuedDatabase({
      executes: [
        [
          {
            queueType: "ARRIVAL",
            entityId: U1,
            bookingCode: "KR-001",
            roomNumber: null,
            guestName: "Budi",
            status: "DUE_IN",
            scheduledAt: new Date(),
            amountIdr: null,
            alert: "ROOM_UNASSIGNED",
          },
          {
            queueType: "PAYMENT_REVIEW",
            entityId: U2,
            bookingCode: "KR-001",
            roomNumber: null,
            guestName: "Budi",
            status: "PENDING_VERIFICATION",
            scheduledAt: new Date(),
            amountIdr: "500000",
            alert: "STALE",
          },
        ],
        [
          { metric: "physical_rooms", value: "15" },
          { metric: "occupied_rooms", value: "9" },
          { metric: "room_revenue_idr", value: "3000000" },
          { metric: "total_revenue_idr", value: "3500000" },
          { metric: "verified_payments_idr", value: "3000000" },
          { metric: "refunded_idr", value: "100000" },
          { metric: "outstanding_idr", value: "500000" },
        ],
      ],
      selects: [
        [
          {
            id: U3,
            severity: "CRITICAL",
            status: "OPEN",
            lastDetectedAt: new Date(),
          },
          {
            id: U2,
            severity: "LOW",
            status: "ACKNOWLEDGED",
            lastDetectedAt: new Date(),
          },
        ],
      ],
    });
    mocks.getDatabase.mockReturnValue(db);
    const dashboard = await getOperationalDashboard({
      propertyId: U2,
      session,
      businessDate: "2026-08-01",
      rangeStart: "2026-08-01",
      rangeEnd: "2026-08-02",
      now: new Date("2026-08-02T00:00:00Z"),
    });
    expect(dashboard.summary).toMatchObject({
      physical_rooms: 15,
      occupied_rooms: 9,
      occupancyPercent: 60,
      total_revenue_idr: 3_500_000,
    });
    expect(dashboard.queues.ARRIVAL).toHaveLength(1);
    expect(dashboard.queues.PAYMENT_REVIEW?.[0]?.alert).toBe("STALE");
    expect(Object.getPrototypeOf(dashboard.queues)).toBe(Object.prototype);
    expect(dashboard.reconciliation).toMatchObject({
      openCount: 2,
      criticalCount: 1,
    });
    expect(dashboard.metadata).toMatchObject({
      currency: "IDR",
      timezone: "Asia/Jakarta",
    });
  });

  it("handles a property with no rooms without dividing by zero", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase({
        executes: [
          [],
          [
            { metric: "physical_rooms", value: "0" },
            { metric: "occupied_rooms", value: "0" },
          ],
        ],
        selects: [[]],
      }),
    );
    const dashboard = await getOperationalDashboard({
      propertyId: U2,
      session,
    });
    expect(dashboard.summary.occupancyPercent).toBe(0);
  });

  it("rejects an excessive dashboard range before accessing the database", async () => {
    await expect(
      getOperationalDashboard({
        propertyId: U2,
        session,
        rangeStart: "2026-01-01",
        rangeEnd: "2026-03-01",
      }),
    ).rejects.toThrow("31 days");
  });

  it("detects and persists reconciliation exceptions without repairing source data", async () => {
    const issue = {
      checkCode: "PAYMENT_POSTING_MISSING",
      fingerprint: `payment:${U3}`,
      severity: "CRITICAL",
      entityType: "payment",
      entityId: U3,
      details: { paymentCode: "PAY-1" },
    };
    const tx = queuedDatabase({ executes: [[issue]], returns: [[{ id: U3 }]] });
    mocks.tx = tx;
    const result = await runReconciliation({
      propertyId: U2,
      session,
      idempotencyKey: "recon-1",
      businessDate: "2026-08-01",
    });
    expect(result).toMatchObject({
      detected: 1,
      critical: 1,
      exceptionIds: [U3],
    });
    expect(result.attendanceReadiness).toMatchObject({
      blockingDailyClose: false,
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RECONCILIATION_RUN" }),
      tx,
    );
  });

  it("runs daily rollover once, creates housekeeping, and closes with exceptions", async () => {
    const issue = {
      checkCode: "INVENTORY_OVERCLAIM",
      fingerprint: `inventory:${U3}`,
      severity: "CRITICAL",
      entityType: "inventory_day",
      entityId: U3,
      details: { claimed: 2, capacity: 1 },
    };
    const tx = queuedDatabase({
      selects: [[]],
      executes: [[{ id: U1, taskType: "CHECKOUT" }], [issue]],
      returns: [[{ id: U2, status: "RUNNING", summary: null }], [{ id: U3 }]],
    });
    mocks.tx = tx;
    const result = await runDailyRollover({
      propertyId: U2,
      session,
      idempotencyKey: "rollover-1",
      businessDate: "2026-08-01",
    });
    expect(result).toMatchObject({
      businessDayRunId: U2,
      status: "NEEDS_ATTENTION",
      replayed: false,
      summary: {
        cleaningTasksCreated: 1,
        criticalExceptions: 1,
        authoritativeDataMutated: false,
      },
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BUSINESS_DAY_ROLLOVER_COMPLETED" }),
      tx,
    );
  });

  it("replays an already-finished business day without duplicating tasks", async () => {
    const tx = queuedDatabase({
      selects: [
        [{ id: U2, status: "COMPLETED", summary: { cleaningTasksCreated: 2 } }],
      ],
    });
    mocks.tx = tx;
    await expect(
      runDailyRollover({
        propertyId: U2,
        session,
        idempotencyKey: "rollover-2",
      }),
    ).resolves.toMatchObject({ status: "COMPLETED", replayed: true });
    expect(tx.execute).not.toHaveBeenCalled();
  });

  it("completes a clean rollover and fails closed if a run cannot be created", async () => {
    mocks.tx = queuedDatabase({
      selects: [[]],
      executes: [[], []],
      returns: [[{ id: U2, status: "RUNNING", summary: null }]],
    });
    await expect(
      runDailyRollover({
        propertyId: U2,
        session,
        idempotencyKey: "rollover-clean",
      }),
    ).resolves.toMatchObject({ status: "COMPLETED" });

    mocks.tx = queuedDatabase({ selects: [[]], returns: [[]] });
    await expect(
      runDailyRollover({
        propertyId: U2,
        session,
        idempotencyKey: "rollover-fail",
      }),
    ).rejects.toThrow("Failed to create business day run");
  });

  it.each([
    ["ACKNOWLEDGE", "ACKNOWLEDGED", undefined],
    ["INVESTIGATE", "INVESTIGATING", undefined],
    ["RESOLVE", "RESOLVED", "Corrected at source"],
    ["ACCEPT_WITH_REASON", "ACCEPTED_WITH_REASON", "Accepted by owner"],
  ] as const)(
    "transitions an exception using %s",
    async (action, expected, reason) => {
      const tx = queuedDatabase({
        selects: [
          [
            {
              id: U3,
              propertyId: U2,
              status: "OPEN",
              assignedToUserId: null,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
            },
          ],
        ],
      });
      mocks.tx = tx;
      await expect(
        updateReconciliationException({
          propertyId: U2,
          session,
          idempotencyKey: `exception-${action}`,
          exceptionId: U3,
          action,
          reason,
          assignedToUserId: U1,
        }),
      ).resolves.toEqual({ exceptionId: U3, status: expected });
    },
  );

  it("requires a closure reason and rejects missing or already-closed exceptions", async () => {
    await expect(
      updateReconciliationException({
        propertyId: U2,
        session,
        idempotencyKey: "no-reason",
        exceptionId: U3,
        action: "RESOLVE",
      }),
    ).rejects.toThrow("reason is required");

    mocks.tx = queuedDatabase({ selects: [[]] });
    await expect(
      updateReconciliationException({
        propertyId: U2,
        session,
        idempotencyKey: "missing",
        exceptionId: U3,
        action: "ACKNOWLEDGE",
      }),
    ).rejects.toThrow("not found");

    mocks.tx = queuedDatabase({ selects: [[{ id: U3, status: "RESOLVED" }]] });
    await expect(
      updateReconciliationException({
        propertyId: U2,
        session,
        idempotencyKey: "closed",
        exceptionId: U3,
        action: "INVESTIGATE",
      }),
    ).rejects.toThrow("already closed");
  });

  it.each([
    "BOOKINGS",
    "DAILY_OPERATIONS",
    "FINANCIAL_LEDGER",
    "CLEANING",
    "RECONCILIATION",
  ] as const)(
    "exports a masked and audited %s Excel report",
    async (reportCode) => {
      const sourceRow =
        reportCode === "BOOKINGS" || reportCode === "DAILY_OPERATIONS"
          ? {
              bookingCode: "KR-001",
              guestName: "Budi Santoso",
              checkInDate: "2026-08-01",
            }
          : { status: "OPEN", amountIdr: "500000" };
      const tx = queuedDatabase({
        executes: [[sourceRow]],
        returns: [[{ id: U3 }]],
      });
      mocks.tx = tx;
      const result = await createExcelReportExport({
        propertyId: U2,
        session,
        idempotencyKey: `export-${reportCode}`,
        reportCode,
        rangeStart: "2026-08-01",
        rangeEnd: "2026-08-02",
      });
      expect(result.filename).toContain(
        reportCode.toLowerCase().replaceAll("_", "-"),
      );
      expect(result.rowCount).toBe(1);
      expect(result.filename).toMatch(/\.xlsx$/u);
      if (reportCode === "BOOKINGS" || reportCode === "DAILY_OPERATIONS") {
        expect(result.rows.flat()).toContain("B*** S***");
        expect(result.rows.flat()).not.toContain("Budi Santoso");
      }
      expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "REPORT_EXPORTED" }),
        tx,
      );
    },
  );

  it("guards export date range, row count, and missing metadata record", async () => {
    await expect(
      createExcelReportExport({
        propertyId: U2,
        session,
        idempotencyKey: "wide",
        reportCode: "BOOKINGS",
        rangeStart: "2025-01-01",
        rangeEnd: "2026-08-02",
      }),
    ).rejects.toThrow("366 days");

    mocks.tx = queuedDatabase({
      executes: [
        Array.from({ length: 10_001 }, () => ({
          bookingCode: "KR",
          guestName: "Budi",
        })),
      ],
    });
    await expect(
      createExcelReportExport({
        propertyId: U2,
        session,
        idempotencyKey: "large",
        reportCode: "BOOKINGS",
        rangeStart: "2026-08-01",
        rangeEnd: "2026-08-02",
      }),
    ).rejects.toThrow("10000 rows");

    mocks.tx = queuedDatabase({ executes: [[]], returns: [[]] });
    await expect(
      createExcelReportExport({
        propertyId: U2,
        session,
        idempotencyKey: "metadata-fail",
        reportCode: "CLEANING",
        rangeStart: "2026-08-01",
        rangeEnd: "2026-08-02",
      }),
    ).rejects.toThrow("Failed to record report export");
  });
});
