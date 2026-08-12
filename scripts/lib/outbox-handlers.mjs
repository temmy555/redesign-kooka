import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { expireReservationPaymentHold } from "./reservation-expiry.mjs";

const A5 = { width: 419.53, height: 595.28 };
const INVOICE_IDENTITY = {
  name: "KOOKA RESIDENCE SURABAYA",
  address: "DARMO PERMAI SELATAN XVI / 28, Surabaya, Indonesia",
  bank: "BANK PANIN",
  accountName: "KOOKA EDUCARE SANCTUARY",
  accountNumber: "4082777111",
  phone: "+61437783424",
  email: "kookacare@gmail.com",
};

function idr(value) {
  const amount = Number(value ?? 0);
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}Rp${Math.abs(amount).toLocaleString("id-ID")}`;
}

function safePdfText(value) {
  return String(value ?? "-")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function jakartaDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function scopeLabel(scope) {
  if (scope === "ROOM_ONLY") return "ROOM";
  if (scope === "COMBINED") return "ROOM & SERVICES";
  return "SELECTED CHARGES";
}

export async function buildFinancialDocumentPdf(row, logoBytes) {
  const snapshot = row.rendered_snapshot ?? {};
  const documentHeading = String(row.document_number).startsWith(
    row.document_type,
  )
    ? String(row.document_number)
    : `${row.document_type} ${row.document_number}`;
  const pdf = await PDFDocument.create();
  pdf.setTitle(documentHeading);
  pdf.setAuthor(INVOICE_IDENTITY.name);
  pdf.setSubject(
    `${scopeLabel(snapshot.scope)} charges for ${snapshot.bookingCode ?? row.recipient_name}`,
  );
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let logo = null;
  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }
  const green = rgb(0.06, 0.24, 0.2);
  const terracotta = rgb(0.66, 0.28, 0.06);
  const olive = rgb(0.33, 0.31, 0.12);
  const gold = rgb(0.76, 0.67, 0.18);
  const muted = rgb(0.42, 0.43, 0.35);
  const soft = rgb(0.97, 0.97, 0.94);
  const white = rgb(1, 1, 1);
  let page = pdf.addPage([A5.width, A5.height]);
  let y = 0;

  const drawRight = (text, xRight, atY, size = 7.5, useBold = false) => {
    const font = useBold ? bold : regular;
    page.drawText(text, {
      x: xRight - font.widthOfTextAtSize(text, size),
      y: atY,
      size,
      font,
      color: olive,
    });
  };
  const drawTableHeader = () => {
    page.drawRectangle({
      x: 24,
      y: y - 7,
      width: 371,
      height: 22,
      color: soft,
    });
    page.drawText("DETAILS", {
      x: 29,
      y,
      size: 7.2,
      font: bold,
      color: olive,
    });
    page.drawText("QTY", { x: 247, y, size: 7.2, font: bold, color: olive });
    page.drawText("RATE", { x: 290, y, size: 7.2, font: bold, color: olive });
    page.drawText("AMOUNT", {
      x: 348,
      y,
      size: 7.2,
      font: bold,
      color: olive,
    });
    y -= 22;
  };
  const drawPageHeader = (full) => {
    page.drawRectangle({
      x: 0,
      y: 591.5,
      width: A5.width,
      height: 3.8,
      color: green,
    });
    if (logo) {
      page.drawImage(logo, {
        x: full ? 294 : 302,
        y: full ? 545 : 548,
        width: full ? 96 : 90,
        height: full ? 33.2 : 31.2,
      });
    }
    page.drawText(documentHeading, {
      x: 24,
      y: 565,
      size: 8,
      font: bold,
      color: olive,
    });
    if (full) {
      page.drawText(INVOICE_IDENTITY.name, {
        x: 24,
        y: 520,
        size: 15.4,
        font: serif,
        color: terracotta,
      });
      page.drawText(INVOICE_IDENTITY.address, {
        x: 24,
        y: 498,
        size: 7.2,
        font: bold,
        color: olive,
      });
      page.drawLine({
        start: { x: 24, y: 484 },
        end: { x: 395, y: 484 },
        thickness: 0.65,
        color: gold,
      });
      y = 461;
      page.drawText(`DATE  ${jakartaDate(snapshot.issuedAt)}`, {
        x: 24,
        y,
        size: 8.2,
        font: bold,
        color: olive,
      });
      page.drawText("FOR", {
        x: 306,
        y,
        size: 8.2,
        font: serif,
        color: terracotta,
      });
      page.drawText(scopeLabel(snapshot.scope), {
        x: 306,
        y: y - 13,
        size: 7.6,
        font: bold,
        color: olive,
      });
      y -= 28;
      const meta = [
        ["Customer", row.recipient_name],
        ["Booking", snapshot.bookingCode ?? "-"],
        ["Scope", scopeLabel(snapshot.scope)],
      ];
      for (const [label, value] of meta) {
        page.drawText(`${label}:`, {
          x: 24,
          y,
          size: 7.4,
          font: bold,
          color: olive,
        });
        page.drawText(safePdfText(value).slice(0, 58), {
          x: 87,
          y,
          size: 7.4,
          font: regular,
          color: olive,
        });
        y -= 13;
      }
      y -= 8;
    } else {
      y = 530;
    }
    drawTableHeader();
  };
  const nextPage = () => {
    page = pdf.addPage([A5.width, A5.height]);
    drawPageHeader(false);
  };
  const ensureSpace = (height) => {
    if (y - height < 32) nextPage();
  };

  drawPageHeader(true);
  for (const entry of snapshot.entries ?? []) {
    ensureSpace(38);
    const sign = entry.entryType === "CREDIT" ? -1 : 1;
    page.drawText(safePdfText(entry.description).slice(0, 38), {
      x: 29,
      y,
      size: 7.6,
      font: regular,
      color: olive,
    });
    page.drawText(String(Number(entry.quantity ?? 1)), {
      x: 251,
      y,
      size: 7.6,
      font: regular,
      color: olive,
    });
    drawRight(
      idr(Number(entry.unitAmountIdr ?? entry.netAmountIdr)),
      333,
      y,
      7.6,
    );
    drawRight(idr(sign * Number(entry.totalAmountIdr)), 390, y, 7.6, true);
    y -= 13;
    page.drawText(
      `${safePdfText(entry.category).replaceAll("_", " ")} · ${safePdfText(entry.date)}`.slice(
        0,
        70,
      ),
      {
        x: 29,
        y,
        size: 6.2,
        font: regular,
        color: muted,
      },
    );
    y -= 11;
    page.drawLine({
      start: { x: 24, y: y + 4 },
      end: { x: 395, y: y + 4 },
      thickness: 0.65,
      color: gold,
    });
    y -= 8;
  }

  ensureSpace(180);
  y -= 2;
  const paymentsIdr = Number(snapshot.paymentsIdr ?? 0);
  const refundsIdr = Number(snapshot.refundsIdr ?? 0);
  const chargeTotalIdr = Number(
    snapshot.chargeTotalIdr ?? snapshot.totalIdr ?? 0,
  );
  const balanceIdr = Number(snapshot.balanceIdr ?? snapshot.totalIdr ?? 0);
  const totals =
    row.document_type === "RECEIPT"
      ? [["PAYMENTS", paymentsIdr || snapshot.totalIdr]]
      : row.document_type === "REFUND_NOTE"
        ? [["REFUNDS", refundsIdr || snapshot.totalIdr]]
        : [
            ["SUBTOTAL", snapshot.subtotalIdr],
            ["SERVICE", snapshot.serviceChargeIdr],
            ["TAX", snapshot.taxIdr],
            ["DISCOUNT", snapshot.discountIdr],
            ["TOTAL CHARGES", chargeTotalIdr],
            ...(paymentsIdr > 0 ? [["PAYMENTS", -paymentsIdr]] : []),
            ...(refundsIdr > 0 ? [["REFUNDS", refundsIdr]] : []),
          ];
  for (const [label, amount] of totals) {
    page.drawText(label, {
      x: 224,
      y,
      size: 7.4,
      font: regular,
      color: olive,
    });
    drawRight(idr(amount), 390, y, 7.4);
    y -= 13;
  }
  y -= 18;
  page.drawRectangle({
    x: 216,
    y: y - 7,
    width: 179,
    height: 24,
    color: green,
  });
  const totalLabel =
    row.document_type === "RECEIPT"
      ? "TOTAL PAID"
      : row.document_type === "REFUND_NOTE"
        ? "TOTAL REFUND"
        : row.document_type === "FOLIO_STATEMENT"
          ? "BALANCE"
          : "BALANCE DUE";
  page.drawText(totalLabel, {
    x: 224,
    y,
    size: 8,
    font: bold,
    color: white,
  });
  const totalText = idr(
    ["INVOICE", "PROFORMA", "FOLIO_STATEMENT"].includes(row.document_type)
      ? balanceIdr
      : snapshot.totalIdr,
  );
  page.drawText(totalText, {
    x: 389 - bold.widthOfTextAtSize(totalText, 9.5),
    y: y - 1,
    size: 9.5,
    font: bold,
    color: white,
  });
  y -= 36;
  page.drawText(INVOICE_IDENTITY.bank, {
    x: 24,
    y,
    size: 8.5,
    font: bold,
    color: olive,
  });
  y -= 13;
  page.drawText(`A/N : ${INVOICE_IDENTITY.accountName}`, {
    x: 24,
    y,
    size: 8,
    font: regular,
    color: olive,
  });
  y -= 13;
  page.drawText(`A/C : ${INVOICE_IDENTITY.accountNumber}`, {
    x: 24,
    y,
    size: 8,
    font: regular,
    color: olive,
  });
  y -= 23;
  page.drawText("Questions concerning this invoice:", {
    x: 24,
    y,
    size: 6.8,
    font: regular,
    color: muted,
  });
  y -= 12;
  page.drawText(`HP ${INVOICE_IDENTITY.phone}  |  ${INVOICE_IDENTITY.email}`, {
    x: 24,
    y,
    size: 7.2,
    font: regular,
    color: olive,
  });
  y -= 17;
  page.drawLine({
    start: { x: 24, y: y + 13 },
    end: { x: 395, y: y + 13 },
    thickness: 0.65,
    color: gold,
  });
  page.drawText("THANK YOU FOR CHOOSING KOOKA", {
    x: 24,
    y,
    size: 8,
    font: bold,
    color: olive,
  });

  for (const [index, invoicePage] of pdf.getPages().entries()) {
    invoicePage.drawText(`${index + 1} / ${pdf.getPageCount()}`, {
      x: 367,
      y: 14,
      size: 6,
      font: regular,
      color: muted,
    });
  }
  return Buffer.from(await pdf.save());
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required by the outbox worker`);
  }
  return value;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function recipientReference(email) {
  return createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

function stableMessageId(event, appUrl) {
  const host = new URL(requiredString(appUrl, "APP_URL")).hostname;
  const reference = createHash("sha256")
    .update(`${event.topic}:${event.id}`)
    .digest("hex")
    .slice(0, 32);
  return `<kooka-${reference}@${host}>`;
}

function financialDocumentEmailHtml(row, appUrl) {
  const documentLabel = escapeHtml(String(row.document_type ?? "INVOICE"));
  const documentNumber = escapeHtml(String(row.document_number));
  const recipientName = escapeHtml(row.recipient_name ?? "Guest");
  const logoUrl = `${String(appUrl).replace(/\/$/u, "")}/images/kooka-logo-official.png`;
  return `<!doctype html>
<html lang="${row.language === "en" ? "en" : "id"}">
  <body style="margin:0;background:#f3efe7;color:#153f35;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe7;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #d9ded7;">
          <tr><td style="background:#103c32;padding:24px 32px;"><img src="${escapeHtml(logoUrl)}" width="154" alt="KOOKA Residence" style="display:block;width:154px;max-width:100%;height:auto;background:#fffdf8;border-radius:5px;padding:6px 10px;" /></td></tr>
          <tr><td style="padding:42px 36px 18px;">
            <div style="color:#b85e41;font-size:12px;font-weight:700;letter-spacing:2px;line-height:1.5;">${documentLabel}</div>
            <h1 style="margin:14px 0 18px;color:#153f35;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400;">${row.language === "en" ? "Your document is ready." : "Dokumen Anda telah siap."}</h1>
            <p style="margin:0;color:#536d66;font-size:16px;line-height:1.7;">${row.language === "en" ? `Hello ${recipientName}, your official document is attached to this email as a PDF.` : `Halo ${recipientName}, dokumen resmi Anda terlampir pada email ini dalam format PDF.`}</p>
          </td></tr>
          <tr><td style="padding:14px 36px 38px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf1e9;border-left:4px solid #628269;"><tr><td style="padding:20px 22px;">
              <div style="color:#75857e;font-size:11px;font-weight:700;letter-spacing:1.6px;">DOCUMENT NUMBER</div>
              <div style="margin-top:7px;color:#153f35;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.25;word-break:break-word;">${documentNumber}</div>
            </td></tr></table>
            <p style="margin:22px 0 0;color:#536d66;font-size:14px;line-height:1.7;">${row.language === "en" ? "All official amounts are processed in Indonesian Rupiah (IDR)." : "Seluruh nominal resmi diproses dalam Rupiah Indonesia (IDR)."}</p>
          </td></tr>
          <tr><td style="border-top:1px solid #d9ded7;padding:22px 36px 28px;color:#73817c;font-size:12px;line-height:1.6;">KOOKA Residence Surabaya · Darmo Permai Selatan XVI / 28, Surabaya</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function createOutboxHandlers(environment, pool) {
  const host = requiredString(environment.SMTP_HOST, "SMTP_HOST");
  const from = requiredString(environment.SMTP_FROM, "SMTP_FROM");
  const port = Number(environment.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      environment.SMTP_USER && environment.SMTP_PASSWORD
        ? { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD }
        : undefined,
  });

  const renderFinancialDocument = async (event) => {
    const documentId = requiredString(
      event?.payload?.documentId,
      "financial-document payload.documentId",
    );
    const versionId = requiredString(
      event?.payload?.versionId,
      "financial-document payload.versionId",
    );
    const selected = await pool.query(
      `select d.property_id, d.document_number, d.document_type,
              d.recipient_name, d.recipient_email, d.language,
              v.rendered_file_id, v.rendered_snapshot,
              sf.storage_key as rendered_storage_key
       from financial_documents d
       join financial_document_versions v on v.document_id = d.id
       left join stored_files sf on sf.id = v.rendered_file_id
       where d.id = $1 and v.id = $2`,
      [documentId, versionId],
    );
    const row = selected.rows[0];
    if (!row) throw new Error("Financial document version was not found");
    const storageRoot = resolve(
      requiredString(environment.PRIVATE_STORAGE_ROOT, "PRIVATE_STORAGE_ROOT"),
    );
    let fileId = row.rendered_file_id;
    let storageKey = row.rendered_storage_key;
    let bytes;

    if (fileId && storageKey) {
      const existingPath = resolve(storageRoot, storageKey);
      if (!existingPath.startsWith(`${storageRoot}/`)) {
        throw new Error("Invalid financial document storage path");
      }
      // Render succeeded previously but a later step (usually email) failed.
      // Reuse the exact PDF instead of silently skipping the delivery retry.
      bytes = await readFile(existingPath);
    } else {
      let logoBytes = null;
      try {
        logoBytes = await readFile(
          resolve(process.cwd(), "public/images/kooka-logo-official.png"),
        );
      } catch {
        logoBytes = null;
      }
      bytes = await buildFinancialDocumentPdf(row, logoBytes);
      storageKey = `${row.property_id}/financial-documents/${documentId}/${versionId}.pdf`;
      const absolutePath = resolve(storageRoot, storageKey);
      if (!absolutePath.startsWith(`${storageRoot}/`)) {
        throw new Error("Invalid financial document storage path");
      }
      await mkdir(dirname(absolutePath), { recursive: true, mode: 0o750 });
      await writeFile(absolutePath, bytes, { mode: 0o640 });
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const client = await pool.connect();
      try {
        await client.query("begin");
        const inserted = await client.query(
          `insert into stored_files
           (property_id, storage_key, original_name, mime_type, byte_size,
            sha256, classification, purpose, scan_status, retention_category)
         values ($1, $2, $3, 'application/pdf', $4, $5,
                 'CONFIDENTIAL', 'FINANCIAL_DOCUMENT', 'CLEAN', 'FINANCIAL')
         on conflict (storage_key) do update set sha256 = excluded.sha256,
           byte_size = excluded.byte_size, updated_at = now(), version = stored_files.version + 1
         returning id`,
          [
            row.property_id,
            storageKey,
            `${row.document_number}.pdf`,
            bytes.length,
            sha256,
          ],
        );
        fileId = inserted.rows[0].id;
        await client.query(
          `update financial_document_versions
         set rendered_file_id = $2 where id = $1 and rendered_file_id is null`,
          [versionId, fileId],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
    if (
      event?.payload?.emailAfterRender &&
      row.recipient_email &&
      row.document_type === "INVOICE"
    ) {
      const documentText =
        row.language === "en"
          ? `Attached is ${row.document_type} ${row.document_number} from KOOKA Residence Surabaya. All official amounts are in IDR.`
          : `Terlampir ${row.document_type} ${row.document_number} dari KOOKA Residence Surabaya. Seluruh nominal resmi dalam IDR.`;
      await transporter.sendMail({
        messageId: stableMessageId(event, environment.APP_URL),
        from,
        to: row.recipient_email,
        subject: `${row.document_type} ${row.document_number}`,
        text: documentText,
        html: financialDocumentEmailHtml(row, environment.APP_URL),
        attachments: [
          {
            filename: `${row.document_number}.pdf`,
            content: bytes,
            contentType: "application/pdf",
          },
        ],
      });
    }
    return { fileId, storageKey, byteSize: bytes.length };
  };

  return {
    "financial-document.render": renderFinancialDocument,
    "auth.password-reset": async (event) => {
      const payload = event?.payload;
      const to = requiredString(payload?.to, "password-reset payload.to");
      const name = requiredString(payload?.name, "password-reset payload.name");
      const url = requiredString(payload?.url, "password-reset payload.url");

      const info = await transporter.sendMail({
        messageId: stableMessageId(event, environment.APP_URL),
        from,
        to,
        subject: "Reset password KOOKA Residence",
        text: `Halo ${name},\n\nGunakan tautan berikut untuk membuat password baru. Tautan berlaku selama 1 jam:\n${url}\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
        html: `<p>Halo ${escapeHtml(name)},</p><p>Gunakan tautan berikut untuk membuat password baru. Tautan berlaku selama 1 jam:</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>Jika Anda tidak meminta reset password, abaikan email ini.</p>`,
      });

      console.info(
        `[email] password reset sent recipient=${recipientReference(to)} message=${info.messageId}`,
      );
      return { messageId: info.messageId };
    },
    "notification.email": async (event) => {
      const payload = event?.payload;
      const messageId = requiredString(
        payload?.messageId,
        "email payload.messageId",
      );
      const to = requiredString(payload?.to, "email payload.to");
      const subject = requiredString(payload?.subject, "email payload.subject");
      const text = requiredString(payload?.text, "email payload.text");
      const customerEmailType = payload?.customerEmailType;
      const html =
        typeof payload?.html === "string" && payload.html.trim()
          ? payload.html
          : `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
      const state = await pool.query(
        "select status from notification_messages where id = $1",
        [messageId],
      );
      if (state.rows[0]?.status === "CANCELLED") {
        return { skipped: "cancelled" };
      }
      if (state.rows[0]?.status === "SENT") {
        return { skipped: "already-sent" };
      }
      if (
        !["PAYMENT_RECORDED", "BOOKING_CONFIRMED"].includes(customerEmailType)
      ) {
        await pool.query(
          `update notification_messages
           set status = 'CANCELLED', last_error = 'Suppressed by customer email policy',
               updated_at = now(), version = version + 1
           where id = $1 and status = 'QUEUED'`,
          [messageId],
        );
        return { skipped: "customer-email-policy" };
      }
      const info = await transporter.sendMail({
        messageId: stableMessageId(event, environment.APP_URL),
        from,
        to,
        subject,
        text,
        html,
      });
      await pool.query(
        `update notification_messages
         set status = 'SENT', sent_at = now(), provider_reference = $2,
             last_error = null, updated_at = now(), version = version + 1
         where id = $1 and status = 'QUEUED'`,
        [messageId, info.messageId],
      );
      console.info(
        `[email] transactional message sent recipient=${recipientReference(to)} message=${info.messageId}`,
      );
      return { messageId: info.messageId };
    },
    "booking.quote-expire": async (event) => {
      const quoteId = requiredString(
        event?.payload?.quoteId,
        "quote-expire payload.quoteId",
      );
      const client = await pool.connect();
      try {
        await client.query("begin");
        const quote = await client.query(
          `update booking_quotes
           set status = 'EXPIRED', updated_at = now(), version = version + 1
           where id = $1 and status = 'ACTIVE' and expires_at <= now()
           returning id`,
          [quoteId],
        );
        if (quote.rowCount) {
          const claims = await client.query(
            `update inventory_claims
             set claim_status = 'EXPIRED', released_at = now(), updated_at = now(), version = version + 1
             where source_type = 'BOOKING_QUOTE' and source_id = $1
               and claim_status = 'ACTIVE'
             returning id`,
            [quoteId],
          );
          for (const claim of claims.rows) {
            await client.query(
              `insert into inventory_claim_events
                 (inventory_claim_id, action, from_status, to_status, reason)
               values ($1, 'EXPIRE', 'ACTIVE', 'EXPIRED', 'Checkout quote deadline elapsed')`,
              [claim.id],
            );
          }
          await client.query(
            `update resource_claims
             set claim_status = 'EXPIRED', released_at = now(),
                 updated_at = now(), version = version + 1
             where booking_quote_room_id in (
               select id from booking_quote_rooms where quote_id = $1
             ) and claim_status = 'ACTIVE'`,
            [quoteId],
          );
        }
        await client.query("commit");
        return { expired: Boolean(quote.rowCount) };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    "booking.reservation-expire": async (event) => {
      const reservationId = requiredString(
        event?.payload?.reservationId,
        "reservation-expire payload.reservationId",
      );
      const client = await pool.connect();
      try {
        await client.query("begin");
        const selected = await client.query(
          `select r.*, f.id as folio_id
           from reservations r
           join folios f on f.reservation_id = r.id
           where r.id = $1
           for update`,
          [reservationId],
        );
        const result = await expireReservationPaymentHold(
          client,
          selected.rows[0],
        );
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
