import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
    set: () => link,
    values: () => link,
    returning: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  enqueueOutboxEvent: vi.fn(),
  withIdempotency: vi.fn(),
}));

vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/outbox", () => ({
  enqueueOutboxEvent: mocks.enqueueOutboxEvent,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import {
  recordPaymentForReview,
  reviewPayment,
  voidPayment,
} from "../../src/modules/booking/payment-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const session = { user: { id: U1 } };

const reservation = {
  id: U2,
  propertyId: U1,
  bookingCode: "KR-260802-ABCDEFGH",
  source: "ONLINE",
  status: "ON_HOLD",
  language: "id",
  bookerEmailNormalized: "guest@example.com",
  paymentDeadlineAt: new Date("2099-08-02T12:00:00.000Z"),
  requiredPaymentIdr: "500000",
  paymentInstructionVersionId: U4,
};

const payment = {
  id: U3,
  folioId: U4,
  paymentCode: "PAY-260802-ABCDEFGH",
  method: "BANK_TRANSFER",
  amountIdr: "500000",
  status: "PENDING_VERIFICATION",
  folioEntryId: null,
};

describe("manual booking payment service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.enqueueOutboxEvent.mockResolvedValue(undefined);
    mocks.insert.mockReturnValue(chain());
    mocks.update.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.withIdempotency.mockImplementation(
      async (_options: unknown, run: (tx: unknown) => Promise<unknown>) => {
        const result = (await run({
          select: mocks.select,
          insert: mocks.insert,
          update: mocks.update,
          execute: mocks.execute,
        })) as { response: unknown };
        return result.response;
      },
    );
  });

  it("rejects a non-positive or fractional IDR payment", async () => {
    await expect(
      recordPaymentForReview({
        propertyId: U1,
        session,
        reservationId: U2,
        amountIdr: 1.5,
        method: "CASH",
        receivedAt: new Date(),
        idempotencyKey: "payment-invalid",
      }),
    ).rejects.toThrow("whole positive IDR");
    expect(mocks.withIdempotency).not.toHaveBeenCalled();
  });

  it("records payment evidence and queues the review notification", async () => {
    mocks.select
      .mockReturnValueOnce(chain([reservation]))
      .mockReturnValueOnce(chain([{ id: U4 }]));
    mocks.insert
      .mockReturnValueOnce(
        chain([{ id: U3, paymentCode: payment.paymentCode }]),
      )
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));

    const result = await recordPaymentForReview({
      propertyId: U1,
      session,
      reservationId: U2,
      amountIdr: 500000,
      method: "BANK_TRANSFER",
      receivedAt: new Date("2026-08-02T08:00:00.000Z"),
      reference: " BANK-123 ",
      proofFileId: U4,
      notes: " WhatsApp proof ",
      idempotencyKey: "payment-record-1",
    });

    expect(result).toMatchObject({
      paymentId: U3,
      status: "PENDING_VERIFICATION",
    });
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledOnce();
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("rejects evidence received after an online booking deadline", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          ...reservation,
          paymentDeadlineAt: new Date("2026-08-02T07:00:00.000Z"),
        },
      ]),
    );
    await expect(
      recordPaymentForReview({
        propertyId: U1,
        session,
        reservationId: U2,
        amountIdr: 500000,
        method: "BANK_TRANSFER",
        receivedAt: new Date("2026-08-02T08:00:00.000Z"),
        idempotencyKey: "payment-late",
      }),
    ).rejects.toThrow("after the booking deadline");
  });

  it("verifies full online payment, confirms booking, and commits inventory", async () => {
    mocks.select
      .mockReturnValueOnce(chain([payment]))
      .mockReturnValueOnce(chain([{ id: U4, reservationId: U2 }]))
      .mockReturnValueOnce(chain([reservation]))
      .mockReturnValueOnce(chain([{ amountIdr: "500000" }]))
      .mockReturnValueOnce(chain());
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));
    mocks.update
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValue(chain());

    const result = await reviewPayment({
      propertyId: U1,
      session,
      paymentId: U3,
      decision: "VERIFY",
      reason: "Bank statement matched",
      idempotencyKey: "payment-verify-1",
    });

    expect(result).toEqual({ paymentId: U3, status: "VERIFIED" });
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("rejects a pending payment and notifies the guest", async () => {
    mocks.select
      .mockReturnValueOnce(chain([payment]))
      .mockReturnValueOnce(chain([{ id: U4, reservationId: U2 }]))
      .mockReturnValueOnce(chain([{ ...reservation, status: "CONFIRMED" }]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));

    const result = await reviewPayment({
      propertyId: U1,
      session,
      paymentId: U3,
      decision: "REJECT",
      reason: "Reference could not be matched",
      idempotencyKey: "payment-reject-1",
    });
    expect(result.status).toBe("REJECTED");
  });

  it("voids verified payment, reverses its folio entry, and reopens payment hold", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([{ ...payment, status: "VERIFIED", folioEntryId: U1 }]),
      )
      .mockReturnValueOnce(chain([{ id: U4, reservationId: U2 }]))
      .mockReturnValueOnce(chain([{ ...reservation, status: "CONFIRMED" }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));

    const result = await voidPayment({
      propertyId: U1,
      session,
      paymentId: U3,
      reason: "Duplicate bank transfer record",
      idempotencyKey: "payment-void-1",
    });
    expect(result.status).toBe("VOIDED");
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it("requires a meaningful reason for review and void", async () => {
    await expect(
      reviewPayment({
        propertyId: U1,
        session,
        paymentId: U3,
        decision: "VERIFY",
        reason: "x",
        idempotencyKey: "short-review",
      }),
    ).rejects.toThrow("reason is required");
    await expect(
      voidPayment({
        propertyId: U1,
        session,
        paymentId: U3,
        reason: "x",
        idempotencyKey: "short-void",
      }),
    ).rejects.toThrow("reason is required");
  });

  it("verifies a partial payment while keeping the booking on hold", async () => {
    mocks.select
      .mockReturnValueOnce(chain([payment]))
      .mockReturnValueOnce(chain([{ id: U4, reservationId: U2 }]))
      .mockReturnValueOnce(
        chain([
          {
            ...reservation,
            language: "en",
            requiredPaymentIdr: "1000000",
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ amountIdr: "500000" }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));
    const result = await reviewPayment({
      propertyId: U1,
      session,
      paymentId: U3,
      decision: "VERIFY",
      reason: "Partial transfer matched",
      idempotencyKey: "payment-partial",
    });
    expect(result.status).toBe("VERIFIED");
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("expires an overdue hold when its payment proof is rejected", async () => {
    mocks.select
      .mockReturnValueOnce(chain([payment]))
      .mockReturnValueOnce(chain([{ id: U4, reservationId: U2 }]))
      .mockReturnValueOnce(
        chain([
          {
            ...reservation,
            paymentDeadlineAt: new Date("2020-01-01T00:00:00.000Z"),
          },
        ]),
      );
    mocks.update
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));
    const result = await reviewPayment({
      propertyId: U1,
      session,
      paymentId: U3,
      decision: "REJECT",
      reason: "Proof does not match bank statement",
      idempotencyKey: "payment-reject-expired",
    });
    expect(result.status).toBe("REJECTED");
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it("voids a pending manual payment without reversing a folio credit", async () => {
    mocks.select
      .mockReturnValueOnce(chain([payment]))
      .mockReturnValueOnce(chain([{ id: U4, reservationId: U2 }]))
      .mockReturnValueOnce(
        chain([
          {
            ...reservation,
            source: "ADMIN_MANUAL",
            status: "CONFIRMED",
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]));
    const result = await voidPayment({
      propertyId: U1,
      session,
      paymentId: U3,
      reason: "Pending record entered twice",
      idempotencyKey: "payment-void-pending",
    });
    expect(result.status).toBe("VOIDED");
  });
});
