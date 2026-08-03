import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";

import { getStandaloneFoodInvoice } from "../../../../../../../src/modules/commerce/fnb-service";
import { AuthorizationError } from "../../../../../../../src/platform/authorization";
import {
  AppError,
  toErrorResponse,
} from "../../../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function idr(value: number | string) {
  return `Rp${Math.abs(Number(value)).toLocaleString("id-ID")}`;
}

function jakartaDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function safeText(value: string | null | undefined) {
  return (value ?? "-")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError)
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  if (
    error instanceof Error &&
    error.message === "No authenticated staff session"
  )
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
      { status: 401 },
    );
  const response = toErrorResponse(error);
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const { orderId } = await context.params;
    if (!z.string().uuid().safeParse(orderId).success)
      throw new AppError("VALIDATION_ERROR", "ID pesanan F&B tidak valid");
    const invoice = await getStandaloneFoodInvoice({
      propertyId,
      foodOrderId: orderId,
      session,
    });

    const pdf = await PDFDocument.create();
    pdf.setTitle(`Invoice F&B ${invoice.receiptCode}`);
    pdf.setAuthor(INVOICE_IDENTITY.name);
    pdf.setSubject(`Pembayaran pesanan ${invoice.orderCode}`);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const logo = await pdf.embedPng(
      await readFile(
        resolve(process.cwd(), "public/images/kooka-logo-official.png"),
      ),
    );
    const green = rgb(0.06, 0.24, 0.2);
    const terracotta = rgb(0.66, 0.28, 0.06);
    const olive = rgb(0.33, 0.31, 0.12);
    const gold = rgb(0.76, 0.67, 0.18);
    const muted = rgb(0.42, 0.43, 0.35);
    const soft = rgb(0.97, 0.97, 0.94);
    const white = rgb(1, 1, 1);
    let page = pdf.addPage([A5.width, A5.height]);
    let y = 0;

    const drawRight = (
      text: string,
      xRight: number,
      atY: number,
      size = 7.5,
      useBold = false,
    ) => {
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
    const drawPageHeader = (full: boolean) => {
      page.drawRectangle({
        x: 0,
        y: 591.5,
        width: A5.width,
        height: 3.8,
        color: green,
      });
      page.drawImage(logo, {
        x: full ? 294 : 302,
        y: full ? 545 : 548,
        width: full ? 96 : 90,
        height: full ? 33.2 : 31.2,
      });
      if (full) {
        page.drawText(`INVOICE ${invoice.receiptCode}`, {
          x: 24,
          y: 565,
          size: 8,
          font: bold,
          color: olive,
        });
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
        page.drawText(`DATE  ${jakartaDate(invoice.issuedAt)}`, {
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
        page.drawText("F&B", {
          x: 306,
          y: y - 13,
          size: 8.2,
          font: bold,
          color: olive,
        });
        y -= 28;
        const meta = [
          ["Customer", invoice.recipientName],
          ["Order", invoice.orderCode],
          ["Form", invoice.paperReference],
          [
            "Payment",
            `${invoice.paymentMethod.replaceAll("_", " ")} / ${invoice.paymentCode}`,
          ],
        ];
        for (const [label, value] of meta) {
          page.drawText(`${label}:`, {
            x: 24,
            y,
            size: 7.4,
            font: bold,
            color: olive,
          });
          page.drawText(safeText(value).slice(0, 58), {
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
        page.drawText(`INVOICE ${invoice.receiptCode}`, {
          x: 24,
          y: 565,
          size: 8,
          font: bold,
          color: olive,
        });
        y = 530;
      }
      drawTableHeader();
    };
    const nextPage = () => {
      page = pdf.addPage([A5.width, A5.height]);
      drawPageHeader(false);
    };
    const ensureSpace = (height: number) => {
      if (y - height < 32) nextPage();
    };

    drawPageHeader(true);
    for (const item of invoice.items) {
      ensureSpace(item.notes ? 38 : 27);
      page.drawText(safeText(item.name).slice(0, 38), {
        x: 29,
        y,
        size: 7.6,
        font: regular,
        color: olive,
      });
      page.drawText(String(Number(item.quantity)), {
        x: 251,
        y,
        size: 7.6,
        font: regular,
        color: olive,
      });
      drawRight(idr(item.unitPriceIdr), 333, y, 7.6);
      drawRight(idr(item.totalIdr), 390, y, 7.6, true);
      y -= 13;
      if (item.notes) {
        page.drawText(`Note: ${safeText(item.notes).slice(0, 66)}`, {
          x: 29,
          y,
          size: 6.2,
          font: regular,
          color: muted,
        });
        y -= 11;
      }
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
      ["SUBTOTAL", invoice.subtotalIdr],
      ["SERVICE", invoice.serviceChargeIdr],
      ["TAX", invoice.taxIdr],
      ["DISCOUNT", invoice.discountIdr],
    ] as const;
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
    page.drawText("TOTAL PAID", {
      x: 224,
      y,
      size: 8,
      font: bold,
      color: white,
    });
    const totalText = idr(invoice.totalIdr);
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
    page.drawText(
      `HP ${INVOICE_IDENTITY.phone}  |  ${INVOICE_IDENTITY.email}`,
      {
        x: 24,
        y,
        size: 7.2,
        font: regular,
        color: olive,
      },
    );
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
    const bytes = await pdf.save();
    const safeCode = invoice.receiptCode.replace(/[^a-zA-Z0-9._-]+/gu, "-");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="Invoice-FNB-${safeCode}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
