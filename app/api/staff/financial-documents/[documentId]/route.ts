import { NextResponse } from "next/server";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";

import {
  getFinancialDocumentRenderStatus,
  retryFinancialDocumentRender,
} from "../../../../../src/modules/operations/finance-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import {
  FileNotAccessibleError,
  readStoredFile,
} from "../../../../../src/platform/file-storage";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const response = toErrorResponse(
    error instanceof FileNotAccessibleError
      ? new AppError("NOT_FOUND", "PDF tidak tersedia")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const { documentId } = await context.params;
    if (!z.string().uuid().safeParse(documentId).success)
      throw new AppError("VALIDATION_ERROR", "ID dokumen tidak valid");

    const document = await getFinancialDocumentRenderStatus({
      propertyId,
      documentId,
      session,
    });
    const statusOnly = new URL(request.url).searchParams.get("status") === "1";
    if (statusOnly || !document.renderedFileId)
      return NextResponse.json(document, {
        status: document.ready ? 200 : 202,
        headers: { "Cache-Control": "private, no-store" },
      });

    const result = await readStoredFile({
      fileId: document.renderedFileId,
      actorUserId: session.user.id,
      permissionCode: "payment.manage",
      action: "PRINT",
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      requestId: request.headers.get("x-request-id"),
      reason: `Print ${document.documentType} ${document.documentNumber ?? document.documentId}`,
    });
    if (result.file.purpose !== "FINANCIAL_DOCUMENT")
      throw new FileNotAccessibleError("File is not a financial document");

    const safeNumber = (document.documentNumber ?? document.documentId).replace(
      /[^a-zA-Z0-9._-]+/gu,
      "-",
    );
    let responseBytes = result.bytes;
    if (
      document.documentStatus === "SUPERSEDED" ||
      document.documentStatus === "VOIDED"
    ) {
      const archivedPdf = await PDFDocument.load(result.bytes);
      const watermarkFont = await archivedPdf.embedFont(
        StandardFonts.HelveticaBold,
      );
      const watermark =
        document.documentStatus === "SUPERSEDED"
          ? "TIDAK BERLAKU - DIGANTIKAN"
          : "TIDAK BERLAKU - DIBATALKAN";
      for (const page of archivedPdf.getPages()) {
        const size = 27;
        const textWidth = watermarkFont.widthOfTextAtSize(watermark, size);
        page.drawText(watermark, {
          x: Math.max(22, (page.getWidth() - textWidth) / 2),
          y: page.getHeight() / 2,
          size,
          font: watermarkFont,
          color: rgb(0.66, 0.18, 0.08),
          opacity: 0.16,
          rotate: degrees(24),
        });
      }
      responseBytes = Buffer.from(await archivedPdf.save());
    }
    return new Response(new Uint8Array(responseBytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${document.documentType}-${safeNumber}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "X-Kooka-Document-Status": document.documentStatus,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const { documentId } = await context.params;
    if (!z.string().uuid().safeParse(documentId).success)
      throw new AppError("VALIDATION_ERROR", "ID dokumen tidak valid");
    z.object({ action: z.literal("RETRY_RENDER") }).parse(await request.json());
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160)
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required",
      );

    return NextResponse.json(
      await retryFinancialDocumentRender({
        propertyId,
        documentId,
        idempotencyKey,
        session,
      }),
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
