import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
  const totals = [
    ["SUBTOTAL", snapshot.subtotalIdr],
    ["SERVICE", snapshot.serviceChargeIdr],
    ["TAX", snapshot.taxIdr],
    ["DISCOUNT", snapshot.discountIdr],
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
        : "TOTAL";
  page.drawText(totalLabel, {
    x: 224,
    y,
    size: 8,
    font: bold,
    color: white,
  });
  const totalText = idr(snapshot.totalIdr);
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
    if (event?.payload?.emailAfterRender && row.recipient_email) {
      await transporter.sendMail({
        messageId: stableMessageId(event, environment.APP_URL),
        from,
        to: row.recipient_email,
        subject: `${row.document_type} ${row.document_number}`,
        text: `Attached is ${row.document_type} ${row.document_number} from KOOKA Residence Surabaya. All official amounts are in IDR.`,
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
      const info = await transporter.sendMail({
        messageId: stableMessageId(event, environment.APP_URL),
        from,
        to,
        subject,
        text,
        html: `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`,
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
        const reservation = selected.rows[0];
        if (
          !reservation ||
          reservation.status !== "ON_HOLD" ||
          !reservation.payment_deadline_at ||
          new Date(reservation.payment_deadline_at) > new Date()
        ) {
          await client.query("commit");
          return { skipped: "not-due" };
        }
        const review = await client.query(
          `select 1 from payments
           where folio_id = $1 and status = 'PENDING_VERIFICATION'
             and received_at <= $2
           limit 1`,
          [reservation.folio_id, reservation.payment_deadline_at],
        );
        if (review.rowCount) {
          await client.query("commit");
          return { skipped: "payment-review-hold" };
        }
        await client.query(
          `update reservations
           set status = 'EXPIRED', updated_at = now(), version = version + 1
           where id = $1`,
          [reservationId],
        );
        await client.query(
          `insert into reservation_status_events
             (reservation_id, action, from_status, to_status, reason)
           values ($1, 'EXPIRE', 'ON_HOLD', 'EXPIRED', 'Payment deadline elapsed without evidence under review')`,
          [reservationId],
        );
        const claims = await client.query(
          `update inventory_claims
           set claim_status = 'EXPIRED', released_at = now(), updated_at = now(), version = version + 1
           where source_type = 'RESERVATION' and source_id = $1
             and claim_type = 'PAYMENT_HOLD' and claim_status = 'ACTIVE'
           returning id`,
          [reservationId],
        );
        for (const claim of claims.rows) {
          await client.query(
            `insert into inventory_claim_events
               (inventory_claim_id, action, from_status, to_status, reason)
             values ($1, 'EXPIRE', 'ACTIVE', 'EXPIRED', 'Reservation payment deadline elapsed')`,
            [claim.id],
          );
        }
        await client.query(
          `update resource_claims
           set claim_status = 'EXPIRED', released_at = now(),
               updated_at = now(), version = version + 1
           where reservation_room_id in (
             select id from reservation_rooms where reservation_id = $1
           ) and claim_status = 'ACTIVE'`,
          [reservationId],
        );
        await client.query(
          `update notification_messages
           set status = 'CANCELLED', updated_at = now(), version = version + 1
           where reservation_id = $1 and status = 'QUEUED'`,
          [reservationId],
        );
        const language = reservation.language;
        const subject =
          language === "en"
            ? `Booking expired ${reservation.booking_code}`
            : `Booking kedaluwarsa ${reservation.booking_code}`;
        const text =
          language === "en"
            ? `Booking ${reservation.booking_code} expired because no payment evidence was recorded before the deadline. Please make a new booking or contact Front Office.`
            : `Booking ${reservation.booking_code} kedaluwarsa karena belum ada bukti pembayaran yang tercatat sebelum batas waktu. Silakan buat booking baru atau hubungi Front Office.`;
        const message = await client.query(
          `insert into notification_messages
             (property_id, reservation_id, channel, recipient, status,
              rendered_subject, rendered_body, scheduled_at, idempotency_key)
           values ($1, $2, 'EMAIL', $3, 'QUEUED', $4, $5, now(), $6)
           returning id`,
          [
            reservation.property_id,
            reservationId,
            reservation.booker_email_normalized,
            subject,
            text,
            `reservation:${reservationId}:expired`,
          ],
        );
        await client.query(
          `insert into outbox_events
             (topic, aggregate_type, aggregate_id, payload, available_at)
           values ('notification.email', 'notification_message', $1,
             jsonb_build_object('messageId', $1, 'to', $2, 'subject', $3, 'text', $4), now())`,
          [
            message.rows[0].id,
            reservation.booker_email_normalized,
            subject,
            text,
          ],
        );
        await client.query(
          `insert into audit_events
             (property_id, actor_type, action, target_type, target_id,
              after_json, reason, result)
           values ($1, 'system', 'booking.reservation.expire', 'reservation', $2,
             jsonb_build_object('status', 'EXPIRED'),
             'Payment deadline elapsed without evidence under review', 'SUCCESS')`,
          [reservation.property_id, reservationId],
        );
        await client.query("commit");
        return { expired: true, releasedClaims: claims.rowCount };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
