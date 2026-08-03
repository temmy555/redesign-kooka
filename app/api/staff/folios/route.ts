import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allocatePayment,
  completeManualRefund,
  getFolio,
  issueFinancialDocument,
  postFolioEntry,
  requestManualRefund,
  reverseFolioEntry,
} from "../../../../src/modules/operations/finance-service";
import { AuthorizationError } from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("POST_ENTRY"),
    folioId: z.string().uuid(),
    billingBucketId: z.string().uuid().optional(),
    entryType: z.enum(["DEBIT", "CREDIT"]),
    category: z.string().trim().min(2).max(64),
    description: z.string().trim().min(2).max(255),
    sourceType: z.string().trim().min(2).max(64),
    sourceId: z.string().uuid(),
    reservationRoomId: z.string().uuid().optional(),
    roomUnitId: z.string().uuid().optional(),
    serviceDate: z.iso.date(),
    quantity: z.number().positive(),
    unitAmountIdr: z.number().int().nonnegative(),
    netAmountIdr: z.number().int().nonnegative(),
    discountAmountIdr: z.number().int().nonnegative(),
    serviceChargeAmountIdr: z.number().int().nonnegative(),
    taxAmountIdr: z.number().int().nonnegative(),
    totalAmountIdr: z.number().int().nonnegative(),
    taxProfileVersionId: z.string().uuid().optional(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("REVERSE_ENTRY"),
    folioEntryId: z.string().uuid(),
    serviceDate: z.iso.date(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("ISSUE_DOCUMENT"),
    folioId: z.string().uuid(),
    documentType: z.enum([
      "PROFORMA",
      "INVOICE",
      "RECEIPT",
      "REFUND_NOTE",
      "FOLIO_STATEMENT",
    ]),
    scope: z.enum(["COMBINED", "ROOM_ONLY", "CUSTOM"]),
    folioEntryIds: z.array(z.string().uuid()).max(500).optional(),
    recipientName: z.string().trim().min(2).max(200),
    recipientEmail: z.string().email().max(320).optional(),
    language: z.enum(["id", "en"]),
    supersedeReason: z.string().trim().min(3).max(500).optional(),
  }),
  z.object({
    action: z.literal("ALLOCATE_PAYMENT"),
    paymentId: z.string().uuid(),
    documentId: z.string().uuid(),
    amountIdr: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("REQUEST_REFUND"),
    folioId: z.string().uuid(),
    amountIdr: z.number().int().positive(),
    reason: z.string().trim().min(3).max(1000),
    destination: z.string().trim().min(4).max(500),
    policySnapshot: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("COMPLETE_REFUND"),
    refundId: z.string().uuid(),
    result: z.enum(["REFUNDED", "FAILED"]),
    transferReference: z.string().trim().max(160).optional(),
    proofFileId: z.string().uuid().optional(),
    failureReason: z.string().trim().max(1000).optional(),
    serviceDate: z.iso.date(),
  }),
]);

function responseFor(error: unknown) {
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
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid folio operation")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const folioId = new URL(request.url).searchParams.get("folioId");
    if (!folioId || !z.string().uuid().safeParse(folioId).success)
      throw new AppError("VALIDATION_ERROR", "folioId is required");
    return NextResponse.json(await getFolio({ propertyId, folioId, session }));
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160)
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required",
      );
    const body = schema.parse(await request.json());
    if (body.action === "POST_ENTRY")
      return NextResponse.json(
        await postFolioEntry({ propertyId, session, idempotencyKey, ...body }),
        { status: 201 },
      );
    if (body.action === "REVERSE_ENTRY")
      return NextResponse.json(
        await reverseFolioEntry({
          propertyId,
          session,
          idempotencyKey,
          folioEntryId: body.folioEntryId,
          serviceDate: body.serviceDate,
          reason: body.reason,
        }),
        { status: 201 },
      );
    if (body.action === "ISSUE_DOCUMENT")
      return NextResponse.json(
        await issueFinancialDocument({
          propertyId,
          session,
          idempotencyKey,
          folioId: body.folioId,
          documentType: body.documentType,
          scope: body.scope,
          folioEntryIds: body.folioEntryIds,
          recipientName: body.recipientName,
          recipientEmail: body.recipientEmail,
          language: body.language,
          supersedeReason: body.supersedeReason,
        }),
        { status: 201 },
      );
    if (body.action === "ALLOCATE_PAYMENT")
      return NextResponse.json(
        await allocatePayment({
          propertyId,
          session,
          idempotencyKey,
          paymentId: body.paymentId,
          documentId: body.documentId,
          amountIdr: body.amountIdr,
        }),
        { status: 201 },
      );
    if (body.action === "REQUEST_REFUND")
      return NextResponse.json(
        await requestManualRefund({
          propertyId,
          session,
          idempotencyKey,
          folioId: body.folioId,
          amountIdr: body.amountIdr,
          reason: body.reason,
          destination: body.destination,
          policySnapshot: body.policySnapshot,
        }),
        { status: 201 },
      );
    return NextResponse.json(
      await completeManualRefund({
        propertyId,
        session,
        idempotencyKey,
        refundId: body.refundId,
        result: body.result,
        transferReference: body.transferReference,
        proofFileId: body.proofFileId,
        failureReason: body.failureReason,
        serviceDate: body.serviceDate,
      }),
    );
  } catch (error) {
    return responseFor(error);
  }
}
