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
  encryptSensitiveValue: vi.fn(),
  enqueueOutboxEvent: vi.fn(),
  withIdempotency: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ select: mocks.select }),
}));
vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/encryption", () => ({
  encryptSensitiveValue: mocks.encryptSensitiveValue,
}));
vi.mock("../../src/platform/outbox", () => ({
  enqueueOutboxEvent: mocks.enqueueOutboxEvent,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import {
  allocatePayment,
  completeManualRefund,
  getFinancialDocumentRenderStatus,
  getFolio,
  issueFinancialDocument,
  postFolioEntry,
  requestManualRefund,
  retryFinancialDocumentRender,
  reverseFolioEntry,
} from "../../src/modules/operations/finance-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const session = { user: { id: U1 } };

const entry = {
  id: U2,
  folioId: U1,
  billingBucketId: U3,
  entryType: "DEBIT",
  category: "ROOM",
  description: "Room charge 2026-08-03",
  sourceType: "RESERVATION_ROOM_NIGHT",
  sourceId: U4,
  sourceLineId: U3,
  reservationRoomId: U4,
  roomUnitId: null,
  guestId: null,
  serviceDate: "2026-08-03",
  quantity: "1",
  unitAmountIdr: "500000",
  netAmountIdr: "450000",
  discountAmountIdr: "0",
  serviceChargeAmountIdr: "0",
  taxAmountIdr: "50000",
  totalAmountIdr: "500000",
  taxProfileVersionId: U3,
  pricingSnapshot: { taxRate: 0.11 },
  reversalOfEntryId: null,
  postedAt: new Date(),
  postedByUserId: U1,
  idempotencyKey: "room-night-1",
};

describe("finance service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.enqueueOutboxEvent.mockResolvedValue(undefined);
    mocks.encryptSensitiveValue.mockReturnValue("encrypted-destination");
    mocks.update.mockReturnValue(chain());
    mocks.insert.mockReturnValue(chain());
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

  it("returns the master folio balance as debit minus credit", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          { id: U1, status: "OPEN", reservationId: U2, bookingCode: "KR-1" },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          entry,
          { ...entry, id: U3, entryType: "CREDIT", totalAmountIdr: "100000" },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            documentId: U4,
            documentNumber: "INV/202608/00001",
            documentType: "INVOICE",
            documentStatus: "ISSUED",
            issuedAt: new Date(),
            versionId: U3,
            versionNumber: 1,
            totalIdr: "500000",
            renderedFileId: U2,
          },
        ]),
      );
    const folio = await getFolio({ propertyId: U1, folioId: U1, session });
    expect(folio.balanceIdr).toBe(400000);
    expect(folio.documents).toMatchObject([
      { documentId: U4, ready: true, renderStatus: "READY" },
    ]);
  });

  it("reports when an issued PDF is ready to print", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          documentId: U2,
          documentNumber: "INV/202608/00001",
          documentType: "INVOICE",
          documentStatus: "ISSUED",
          versionId: U3,
          versionNumber: 1,
          renderedFileId: U4,
        },
      ]),
    );

    const result = await getFinancialDocumentRenderStatus({
      propertyId: U1,
      documentId: U2,
      session,
    });

    expect(result).toMatchObject({
      documentId: U2,
      ready: true,
      renderStatus: "READY",
      renderedFileId: U4,
    });
  });

  it("reports a dead-lettered PDF render instead of polling forever", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          documentId: U2,
          documentNumber: "INV/202608/00001",
          documentType: "INVOICE",
          documentStatus: "ISSUED",
          versionId: U3,
          versionNumber: 1,
          renderedFileId: null,
          outboxStatus: "DEAD_LETTER",
        },
      ]),
    );

    await expect(
      getFinancialDocumentRenderStatus({
        propertyId: U1,
        documentId: U2,
        session,
      }),
    ).resolves.toMatchObject({ ready: false, renderStatus: "FAILED" });
  });

  it("queues a fresh PDF render after a failed attempt", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          documentId: U2,
          versionId: U3,
          renderedFileId: null,
        },
      ]),
    );

    const result = await retryFinancialDocumentRender({
      propertyId: U1,
      documentId: U2,
      idempotencyKey: "retry-render-1",
      session,
    });

    expect(result).toMatchObject({
      documentId: U2,
      ready: false,
      renderStatus: "PROCESSING",
    });
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "financial-document.render",
        aggregateId: U2,
      }),
      expect.anything(),
    );
  });

  it("posts a validated tax-aware immutable folio entry", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U1, status: "OPEN" }]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U2 }]));
    const result = await postFolioEntry({
      propertyId: U1,
      folioId: U1,
      entryType: "DEBIT",
      category: "FNB",
      description: "Nasi goreng",
      sourceType: "FNB_ORDER",
      sourceId: U2,
      serviceDate: "2026-08-03",
      quantity: 1,
      unitAmountIdr: 100000,
      netAmountIdr: 90000,
      discountAmountIdr: 0,
      serviceChargeAmountIdr: 0,
      taxAmountIdr: 10000,
      totalAmountIdr: 100000,
      reason: "Paper order entered by Front Office",
      idempotencyKey: "folio-post-1",
      session,
    });
    expect(result.folioEntryId).toBe(U2);
  });

  it("rejects inconsistent price components before opening a transaction", async () => {
    await expect(
      postFolioEntry({
        propertyId: U1,
        folioId: U1,
        entryType: "DEBIT",
        category: "FNB",
        description: "Invalid total",
        sourceType: "FNB_ORDER",
        sourceId: U2,
        serviceDate: "2026-08-03",
        quantity: 1,
        unitAmountIdr: 100000,
        netAmountIdr: 90000,
        discountAmountIdr: 0,
        serviceChargeAmountIdr: 0,
        taxAmountIdr: 10000,
        totalAmountIdr: 99999,
        reason: "Validation test",
        idempotencyKey: "folio-invalid",
        session,
      }),
    ).rejects.toThrow("does not match");
  });

  it("reverses an entry without mutating the original", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        { folio_entries: entry, folios: { id: U1 }, reservations: { id: U2 } },
      ]),
    );
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await reverseFolioEntry({
      propertyId: U1,
      folioEntryId: U2,
      reason: "Incorrect damage assessment",
      serviceDate: "2026-08-03",
      idempotencyKey: "reverse-1",
      session,
    });
    expect(result).toEqual({ reversalEntryId: U3, originalEntryId: U2 });
  });

  it("issues a combined invoice snapshot and queues PDF rendering", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([entry]))
      .mockReturnValueOnce(chain([]));
    mocks.execute.mockResolvedValue({
      rows: [{ prefix: "INV", issuedValue: 1, padding: 5 }],
    });
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());

    const result = await issueFinancialDocument({
      propertyId: U1,
      folioId: U1,
      documentType: "INVOICE",
      scope: "COMBINED",
      recipientName: "Budi Santoso",
      recipientEmail: "budi@example.com",
      language: "id",
      idempotencyKey: "invoice-1",
      session,
    });
    expect(result).toMatchObject({
      documentId: U2,
      versionId: U3,
      documentNumber: "INV/202608/00001",
      renderStatus: "QUEUED",
      totalIdr: 500000,
    });
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledOnce();
  });

  it("supersedes prior invoice coverage when a revised invoice is issued", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([{ id: U1, reservationId: U3, bookingCode: "KR-1" }]),
      )
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([entry]))
      .mockReturnValueOnce(chain([{ entryId: U2, documentId: U4 }]));
    mocks.execute.mockResolvedValue({
      rows: [{ prefix: "INV", issuedValue: 2, padding: 5 }],
    });
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());

    const result = await issueFinancialDocument({
      propertyId: U1,
      folioId: U1,
      documentType: "INVOICE",
      scope: "ROOM_ONLY",
      recipientName: "Budi Santoso",
      language: "id",
      idempotencyKey: "invoice-revision",
      session,
    });

    expect(result).toMatchObject({
      documentId: U2,
      documentNumber: "INV/202608/00002",
      supersededDocumentIds: [U4],
    });
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "FINANCIAL_DOCUMENT_SUPERSEDED",
        targetId: U4,
      }),
      expect.anything(),
    );
  });

  it("allocates only the unallocated part of a verified payment", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          { id: U1, amountIdr: "500000", status: "VERIFIED", folioId: U2 },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U3, folioId: U2, status: "ISSUED" }]))
      .mockReturnValueOnce(chain([{ amountIdr: "100000", reversalId: null }]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U4 }]));
    const result = await allocatePayment({
      propertyId: U1,
      paymentId: U1,
      documentId: U3,
      amountIdr: 400000,
      idempotencyKey: "allocation-1",
      session,
    });
    expect(result.allocatedAmountIdr).toBe(400000);
  });

  it("creates an immediately approved manual refund with encrypted destination", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U1 }]));
    mocks.execute.mockResolvedValue({ rows: [{ code: "RF-260802-ABC" }] });
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());
    const result = await requestManualRefund({
      propertyId: U1,
      folioId: U1,
      amountIdr: 100000,
      reason: "Manual cancellation adjustment",
      destination: "BCA 1234567890",
      idempotencyKey: "refund-request-1",
      session,
    });
    expect(result).toMatchObject({ refundId: U2, status: "APPROVED" });
    expect(mocks.encryptSensitiveValue).toHaveBeenCalledWith("BCA 1234567890");
  });

  it("completes a manual refund with proof and folio trace", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            status: "APPROVED",
            amountIdr: "100000",
            folioId: U2,
            refundCode: "RF-1",
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain());
    const result = await completeManualRefund({
      propertyId: U1,
      refundId: U1,
      result: "REFUNDED",
      transferReference: "TRX-001",
      proofFileId: U3,
      serviceDate: "2026-08-03",
      idempotencyKey: "refund-complete-1",
      session,
    });
    expect(result).toMatchObject({
      status: "REFUNDED",
      attemptId: U3,
      folioEntryId: U4,
    });
  });

  it("posts and reverses a credit entry", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U1, status: "OPEN" }]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U2 }]));
    const posted = await postFolioEntry({
      propertyId: U1,
      folioId: U1,
      billingBucketId: U3,
      entryType: "CREDIT",
      category: "DISCOUNT",
      description: "Goodwill credit",
      sourceType: "MANUAL_ADJUSTMENT",
      sourceId: U2,
      reservationRoomId: U4,
      roomUnitId: U3,
      serviceDate: "2026-08-03",
      quantity: 1,
      unitAmountIdr: 50000,
      netAmountIdr: 50000,
      discountAmountIdr: 0,
      serviceChargeAmountIdr: 0,
      taxAmountIdr: 0,
      totalAmountIdr: 50000,
      reason: "Guest recovery credit",
      idempotencyKey: "folio-credit",
      session,
    });
    expect(posted.folioEntryId).toBe(U2);

    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.select.mockReturnValueOnce(
      chain([
        {
          folio_entries: { ...entry, entryType: "CREDIT" },
          folios: { id: U1 },
          reservations: { id: U2 },
        },
      ]),
    );
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const reversed = await reverseFolioEntry({
      propertyId: U1,
      folioEntryId: U2,
      reason: "Credit entered twice",
      serviceDate: "2026-08-03",
      idempotencyKey: "reverse-credit",
      session,
    });
    expect(reversed.reversalEntryId).toBe(U3);
  });

  it("issues a room-only receipt without final invoice coverage", async () => {
    const credit = { ...entry, entryType: "CREDIT", totalAmountIdr: "100000" };
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([entry, credit]));
    mocks.execute.mockResolvedValue({
      rows: [{ prefix: "RCT", issuedValue: 2, padding: 4 }],
    });
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());
    const result = await issueFinancialDocument({
      propertyId: U1,
      folioId: U1,
      documentType: "RECEIPT",
      scope: "ROOM_ONLY",
      recipientName: "Sari Dewi",
      language: "en",
      idempotencyKey: "receipt-room-only",
      session,
    });
    expect(result).toMatchObject({
      documentNumber: "RCT/202608/0002",
      totalIdr: 400000,
    });
  });

  it("requires entries for a custom financial document", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]));
    await expect(
      issueFinancialDocument({
        propertyId: U1,
        folioId: U1,
        documentType: "PROFORMA",
        scope: "CUSTOM",
        recipientName: "Guest",
        language: "id",
        idempotencyKey: "custom-no-entries",
        session,
      }),
    ).rejects.toThrow("requires folio entries");
  });

  it("records a failed manual refund attempt without a folio entry", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            status: "PROCESSING",
            amountIdr: "100000",
            folioId: U2,
            refundCode: "RF-1",
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U4 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());
    const result = await completeManualRefund({
      propertyId: U1,
      refundId: U1,
      result: "FAILED",
      failureReason: "Destination account rejected transfer",
      serviceDate: "2026-08-03",
      idempotencyKey: "refund-failed",
      session,
    });
    expect(result).toMatchObject({
      status: "FAILED",
      attemptId: U3,
      folioEntryId: null,
    });
  });
});
