import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const mocks = vi.hoisted(() => ({
  getFinancialDocumentRenderStatus: vi.fn(),
  retryFinancialDocumentRender: vi.fn(),
  getActivePropertyId: vi.fn(),
  readStoredFile: vi.fn(),
  requireCurrentSession: vi.fn(),
}));

vi.mock("../../src/modules/operations/finance-service", () => ({
  getFinancialDocumentRenderStatus: mocks.getFinancialDocumentRenderStatus,
  retryFinancialDocumentRender: mocks.retryFinancialDocumentRender,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/file-storage", () => ({
  FileNotAccessibleError: class FileNotAccessibleError extends Error {},
  readStoredFile: mocks.readStoredFile,
}));

import {
  GET,
  POST,
} from "../../app/api/staff/financial-documents/[documentId]/route";

const DOCUMENT_ID = "11111111-1111-4111-a111-111111111111";
const FILE_ID = "22222222-2222-4222-a222-222222222222";
const PROPERTY_ID = "33333333-3333-4333-a333-333333333333";
const USER_ID = "44444444-4444-4444-a444-444444444444";

function context() {
  return { params: Promise.resolve({ documentId: DOCUMENT_ID }) };
}

describe("financial document PDF route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getActivePropertyId.mockResolvedValue(PROPERTY_ID);
  });

  it("returns processing while the PDF worker is rendering", async () => {
    mocks.getFinancialDocumentRenderStatus.mockResolvedValue({
      documentId: DOCUMENT_ID,
      documentNumber: "INV/202608/00001",
      documentType: "INVOICE",
      renderedFileId: null,
      ready: false,
      renderStatus: "PROCESSING",
    });

    const response = await GET(
      new Request(
        `http://localhost/api/staff/financial-documents/${DOCUMENT_ID}?status=1`,
      ),
      context(),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ready: false });
    expect(mocks.readStoredFile).not.toHaveBeenCalled();
  });

  it("serves a ready PDF inline for browser printing", async () => {
    mocks.getFinancialDocumentRenderStatus.mockResolvedValue({
      documentId: DOCUMENT_ID,
      documentNumber: "INV/202608/00001",
      documentType: "INVOICE",
      renderedFileId: FILE_ID,
      ready: true,
      renderStatus: "READY",
    });
    mocks.readStoredFile.mockResolvedValue({
      file: { purpose: "FINANCIAL_DOCUMENT" },
      bytes: Buffer.from("%PDF-1.4\nUAT"),
    });

    const response = await GET(
      new Request(
        `http://localhost/api/staff/financial-documents/${DOCUMENT_ID}`,
      ),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(mocks.readStoredFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: FILE_ID,
        actorUserId: USER_ID,
        action: "PRINT",
      }),
    );
  });

  it("marks a superseded invoice archive as no longer valid", async () => {
    const archivedPdf = await PDFDocument.create();
    archivedPdf.addPage([419.53, 595.28]);
    const sourceBytes = await archivedPdf.save();
    mocks.getFinancialDocumentRenderStatus.mockResolvedValue({
      documentId: DOCUMENT_ID,
      documentNumber: "INV/202608/00001",
      documentType: "INVOICE",
      documentStatus: "SUPERSEDED",
      renderedFileId: FILE_ID,
      ready: true,
      renderStatus: "READY",
    });
    mocks.readStoredFile.mockResolvedValue({
      file: { purpose: "FINANCIAL_DOCUMENT" },
      bytes: Buffer.from(sourceBytes),
    });

    const response = await GET(
      new Request(
        `http://localhost/api/staff/financial-documents/${DOCUMENT_ID}`,
      ),
      context(),
    );
    const watermarkedBytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-kooka-document-status")).toBe("SUPERSEDED");
    expect(watermarkedBytes.byteLength).toBeGreaterThan(sourceBytes.byteLength);
    await expect(PDFDocument.load(watermarkedBytes)).resolves.toBeDefined();
  });

  it("queues a retry for a failed PDF render", async () => {
    mocks.retryFinancialDocumentRender.mockResolvedValue({
      documentId: DOCUMENT_ID,
      ready: false,
      renderStatus: "PROCESSING",
      renderedFileId: null,
    });

    const response = await POST(
      new Request(
        `http://localhost/api/staff/financial-documents/${DOCUMENT_ID}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "retry-pdf-1",
          },
          body: JSON.stringify({ action: "RETRY_RENDER" }),
        },
      ),
      context(),
    );

    expect(response.status).toBe(202);
    expect(mocks.retryFinancialDocumentRender).toHaveBeenCalledWith({
      propertyId: PROPERTY_ID,
      documentId: DOCUMENT_ID,
      idempotencyKey: "retry-pdf-1",
      session: { user: { id: USER_ID } },
    });
  });
});
