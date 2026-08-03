import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";

import {
  recordPaymentForReview,
  reviewPayment,
  voidPayment,
} from "../../../../src/modules/booking/payment-service";
import { getDatabase } from "../../../../src/db";
import {
  AuthorizationError,
  requirePermission,
} from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";
import {
  paginationMeta,
  parsePagination,
} from "../../../../src/platform/pagination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RECORD_FOR_REVIEW"),
    reservationId: z.string().uuid(),
    amountIdr: z.number().int().positive(),
    method: z.enum([
      "BANK_TRANSFER",
      "CASH",
      "PAY_AT_CHECKIN",
      "PAY_AT_CHECKOUT",
      "OTHER",
    ]),
    receivedAt: z.coerce.date(),
    reference: z.string().trim().max(160).nullable().optional(),
    proofFileId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(1_000).nullable().optional(),
  }),
  z.object({
    action: z.literal("REVIEW"),
    paymentId: z.string().uuid(),
    decision: z.enum(["VERIFY", "REJECT"]),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("VOID"),
    paymentId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
]);

interface PaymentDeskRow extends Record<string, unknown> {
  id: string;
  paymentCode: string;
  bookingCode: string;
  bookerName: string;
  amountIdr: string;
  method: string;
  status: string;
  receivedAt: Date | null;
  reference: string | null;
  folioId: string;
}

export async function GET(request?: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    await requirePermission(session, propertyId, "payment.manage");
    const url = new URL(request?.url ?? "http://localhost/api/staff/payments");
    const operational = url.searchParams.get("view") === "operational";
    const pagination = parsePagination(
      {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("pageSize"),
      },
      {
        defaultPageSize: operational ? 500 : 20,
        allowedPageSizes: operational ? [500] : [20, 50, 100],
      },
    );
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 120);
    const status = (url.searchParams.get("status") ?? "ALL")
      .trim()
      .slice(0, 40);
    const database = getDatabase();
    const [countResult, result] = await Promise.all([
      database.execute<{ total: string }>(sql`
        select count(*)::text as total
        from payments p
        join folios f on f.id = p.folio_id
        join reservations r on r.id = f.reservation_id
        where r.property_id = ${propertyId}
          and (${operational} = false or p.status = 'PENDING_VERIFICATION')
          and (${search} = '' or p.payment_code ilike ${`%${search}%`}
            or r.booking_code ilike ${`%${search}%`}
            or r.booker_name ilike ${`%${search}%`}
            or coalesce(p.reference, '') ilike ${`%${search}%`})
          and (${status} = 'ALL' or p.status = ${status})
      `),
      database.execute<PaymentDeskRow>(sql`
      select p.id, p.payment_code as "paymentCode", r.booking_code as "bookingCode",
        r.booker_name as "bookerName", p.amount_idr::text as "amountIdr",
        p.method, p.status, p.received_at as "receivedAt", p.reference,
        f.id as "folioId"
      from payments p
      join folios f on f.id = p.folio_id
      join reservations r on r.id = f.reservation_id
      where r.property_id = ${propertyId}
        and (${operational} = false or p.status = 'PENDING_VERIFICATION')
        and (${search} = '' or p.payment_code ilike ${`%${search}%`}
          or r.booking_code ilike ${`%${search}%`}
          or r.booker_name ilike ${`%${search}%`}
          or coalesce(p.reference, '') ilike ${`%${search}%`})
        and (${status} = 'ALL' or p.status = ${status})
      order by case when p.status = 'PENDING_VERIFICATION' then 0 else 1 end,
        p.created_at desc, p.id desc
      limit ${pagination.pageSize} offset ${pagination.offset}
    `),
    ]);
    return NextResponse.json({
      payments: result.rows,
      pagination: paginationMeta(
        pagination.page,
        pagination.pageSize,
        Number(countResult.rows[0]?.total ?? 0),
      ),
    });
  } catch (error) {
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
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A valid Idempotency-Key header is required",
      );
    }
    const body = schema.parse(await request.json());
    if (body.action === "RECORD_FOR_REVIEW") {
      return NextResponse.json(
        await recordPaymentForReview({
          propertyId,
          session,
          idempotencyKey,
          reservationId: body.reservationId,
          amountIdr: body.amountIdr,
          method: body.method,
          receivedAt: body.receivedAt,
          reference: body.reference,
          proofFileId: body.proofFileId,
          notes: body.notes,
        }),
        { status: 201 },
      );
    }
    if (body.action === "REVIEW") {
      return NextResponse.json(
        await reviewPayment({
          propertyId,
          session,
          paymentId: body.paymentId,
          decision: body.decision,
          reason: body.reason,
          idempotencyKey,
        }),
      );
    }
    return NextResponse.json(
      await voidPayment({
        propertyId,
        session,
        paymentId: body.paymentId,
        reason: body.reason,
        idempotencyKey,
      }),
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Forbidden" } },
        { status: 403 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    ) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    }
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid payment request")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
