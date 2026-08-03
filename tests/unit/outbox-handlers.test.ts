import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const { sendMail, createTransport, readFile } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile,
}));

import {
  buildFinancialDocumentPdf,
  createOutboxHandlers,
} from "../../scripts/lib/outbox-handlers.mjs";

const environment = {
  APP_URL: "https://kooka.example",
  SMTP_HOST: "smtp.example",
  SMTP_PORT: "587",
  SMTP_FROM: "KOOKA <noreply@kooka.example>",
  PRIVATE_STORAGE_ROOT: "/private/kooka",
};

describe("outbox delivery hardening", () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: "provider-1" });
    createTransport.mockReset().mockReturnValue({ sendMail });
    readFile.mockReset().mockResolvedValue(Buffer.from("existing-pdf"));
  });

  it("reuses an already-rendered PDF when delivery is retried", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            property_id: "property-1",
            document_number: "INV-1",
            document_type: "INVOICE",
            recipient_name: "Guest",
            recipient_email: "guest@example.test",
            rendered_file_id: "file-1",
            rendered_storage_key: "property-1/financial-documents/d/v.pdf",
            rendered_snapshot: {},
          },
        ],
      }),
      connect: vi.fn(),
    };
    const handler = createOutboxHandlers(environment, pool)[
      "financial-document.render"
    ];
    const event = {
      id: "event-1",
      topic: "financial-document.render",
      payload: {
        documentId: "document-1",
        versionId: "version-1",
        emailAfterRender: true,
      },
    };

    await handler(event);
    await handler(event);

    expect(readFile).toHaveBeenCalledTimes(2);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0]?.[0].attachments[0].content).toEqual(
      Buffer.from("existing-pdf"),
    );
    expect(sendMail.mock.calls[0]?.[0].messageId).toBe(
      sendMail.mock.calls[1]?.[0].messageId,
    );
  });

  it("uses a stable Message-ID and skips messages already marked sent", async () => {
    const queuedPool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ status: "QUEUED" }] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    const event = {
      id: "event-email-1",
      topic: "notification.email",
      payload: {
        messageId: "message-1",
        to: "guest@example.test",
        subject: "Booking",
        text: "Confirmed",
      },
    };
    await createOutboxHandlers(environment, queuedPool)["notification.email"](
      event,
    );
    const firstMessageId = sendMail.mock.calls[0]?.[0].messageId;
    expect(firstMessageId).toMatch(/^<kooka-[a-f0-9]{32}@kooka\.example>$/u);

    const sentPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ status: "SENT" }] }),
    };
    await expect(
      createOutboxHandlers(environment, sentPool)["notification.email"](event),
    ).resolves.toEqual({ skipped: "already-sent" });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("renders room and combined documents with the same A5 invoice format", async () => {
    const bytes = await buildFinancialDocumentPdf(
      {
        document_number: "INVOICE/202608/00002",
        document_type: "INVOICE",
        recipient_name: "Temmy Kurniawan",
        rendered_snapshot: {
          issuedAt: "2026-08-03T08:00:00.000Z",
          bookingCode: "KR-260803-TEST",
          scope: "COMBINED",
          subtotalIdr: 510000,
          serviceChargeIdr: 0,
          taxIdr: 0,
          discountIdr: 0,
          totalIdr: 510000,
          entries: [
            {
              date: "2026-08-03",
              description: "Deluxe room",
              category: "ROOM",
              entryType: "DEBIT",
              quantity: 1,
              unitAmountIdr: 450000,
              totalAmountIdr: 450000,
            },
            {
              date: "2026-08-03",
              description: "Nasi goreng",
              category: "FNB",
              entryType: "DEBIT",
              quantity: 2,
              unitAmountIdr: 30000,
              totalAmountIdr: 60000,
            },
          ],
        },
      },
      null,
    );
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);

    expect(pdf.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeCloseTo(419.53, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
  });
});
