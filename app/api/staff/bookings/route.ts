import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { createBookingQuote } from "../../../../src/modules/booking/quote-service";
import {
  cancelReservation,
  createReservation,
} from "../../../../src/modules/booking/reservation-service";
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

const quoteSchema = z.object({
  action: z.literal("QUOTE"),
  checkInDate: z.string(),
  checkoutDate: z.string(),
  ratePlanCode: z.string().trim().min(1).max(64),
  language: z.enum(["id", "en"]),
  displayCurrency: z.enum(["IDR", "USD", "AUD"]),
  rooms: z
    .array(
      z.object({
        roomTypeId: z.string().uuid(),
        adults: z.number().int().min(1),
        children: z.number().int().min(0).default(0),
        infants: z.number().int().min(0).default(0),
        extraBedQuantity: z.number().int().min(0).default(0),
      }),
    )
    .min(1)
    .max(15),
});
const reservationSchema = z.object({
  action: z.literal("RESERVE"),
  quoteId: z.string().uuid(),
  booker: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().email().max(320),
    phone: z.string().trim().max(40).nullable().optional(),
  }),
  internalNotes: z.string().trim().max(2_000).nullable().optional(),
  paymentMode: z.enum([
    "FULL",
    "FIXED_DEPOSIT",
    "PERCENTAGE_DEPOSIT",
    "PAY_AT_CHECKIN",
    "PAY_AT_CHECKOUT",
  ]),
  depositValue: z.number().nonnegative().nullable().optional(),
  acknowledgedPolicyVersionIds: z.array(z.string().uuid()).max(20),
});
const cancelSchema = z.object({
  action: z.literal("CANCEL"),
  reservationId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
const schema = z.discriminatedUnion("action", [
  quoteSchema,
  reservationSchema,
  cancelSchema,
]);

interface BookingDeskRow extends Record<string, unknown> {
  id: string;
  bookingCode: string;
  bookerName: string;
  bookerEmail: string;
  source: string;
  status: string;
  paymentMode: string;
  requiredPaymentIdr: string;
  paymentDeadlineAt: Date | null;
  folioId: string | null;
  folioBalanceIdr: string;
  folioChargeTotalIdr: string;
  verifiedPaymentIdr: string;
  rooms: Array<Record<string, unknown>>;
}

export async function GET(request?: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    await requirePermission(session, propertyId, "booking.manage");
    const url = new URL(request?.url ?? "http://localhost/api/staff/bookings");
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
        from reservations r
        where r.property_id = ${propertyId}
          and (${operational} = false
            or r.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED')
            or (r.status = 'COMPLETED' and exists (
              select 1
              from folios outstanding_folio
              join folio_entries outstanding_entry on outstanding_entry.folio_id = outstanding_folio.id
              where outstanding_folio.reservation_id = r.id
              group by outstanding_folio.id
              having abs(sum(case when outstanding_entry.entry_type = 'DEBIT'
                then outstanding_entry.total_amount_idr
                else -outstanding_entry.total_amount_idr end)) >= 0.5
            )))
          and (${search} = '' or r.booking_code ilike ${`%${search}%`}
            or r.booker_name ilike ${`%${search}%`}
            or r.booker_email ilike ${`%${search}%`})
          and (${status} = 'ALL' or r.status = ${status})
      `),
      database.execute<BookingDeskRow>(sql`
      with paged_reservations as (
        select r.id, r.created_at
        from reservations r
        where r.property_id = ${propertyId}
          and (${operational} = false
            or r.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED')
            or (r.status = 'COMPLETED' and exists (
              select 1
              from folios outstanding_folio
              join folio_entries outstanding_entry on outstanding_entry.folio_id = outstanding_folio.id
              where outstanding_folio.reservation_id = r.id
              group by outstanding_folio.id
              having abs(sum(case when outstanding_entry.entry_type = 'DEBIT'
                then outstanding_entry.total_amount_idr
                else -outstanding_entry.total_amount_idr end)) >= 0.5
            )))
          and (${search} = '' or r.booking_code ilike ${`%${search}%`}
            or r.booker_name ilike ${`%${search}%`}
            or r.booker_email ilike ${`%${search}%`})
          and (${status} = 'ALL' or r.status = ${status})
        order by r.created_at desc, r.id desc
        limit ${pagination.pageSize} offset ${pagination.offset}
      )
      select r.id, r.booking_code as "bookingCode", r.booker_name as "bookerName",
        r.booker_email as "bookerEmail", r.source, r.status,
        r.payment_mode as "paymentMode", r.required_payment_idr::text as "requiredPaymentIdr",
        r.payment_deadline_at as "paymentDeadlineAt", f.id as "folioId",
        coalesce(folio_balance.balance_idr, 0)::text as "folioBalanceIdr",
        coalesce(folio_balance.charge_total_idr, 0)::text as "folioChargeTotalIdr",
        coalesce(folio_balance.verified_payment_idr, 0)::text as "verifiedPaymentIdr",
        coalesce(jsonb_agg(jsonb_build_object(
          'reservationRoomId', rr.id,
          'roomStayId', st.id,
          'roomUnitId', current_assignment.room_unit_id,
          'roomNumber', assigned_room.room_number,
          'roomTypeId', rr.fulfilled_room_type_id,
          'checkInDate', rr.check_in_date,
          'checkoutDate', rr.checkout_date,
          'adults', rr.adults,
          'children', rr.children,
          'extraBedQuantity', rr.extra_bed_quantity,
          'lineStatus', rr.line_status,
          'stayStatus', st.status,
          'registrationStatus', registration.status,
          'registrationItems', coalesce(registration_items.items, '[]'::jsonb),
          'identityType', registration_identity.identity_type,
          'identityNumberLast4', registration_identity.identity_number_last4
        ) order by rr.line_number) filter (where rr.id is not null), '[]'::jsonb) as rooms
      from paged_reservations page
      join reservations r on r.id = page.id
      left join reservation_rooms rr on rr.reservation_id = r.id
        and (${operational} = false or rr.line_status = 'ACTIVE')
      left join room_stays st on st.reservation_room_id = rr.id
      left join lateral (
        select ra.room_unit_id
        from room_assignments ra
        where ra.room_stay_id = st.id and ra.status in ('PLANNED', 'ACTIVE')
        order by ra.effective_from desc
        limit 1
      ) current_assignment on true
      left join room_units assigned_room on assigned_room.id = current_assignment.room_unit_id
      left join checkin_registrations registration on registration.room_stay_id = st.id
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'captureType', item.capture_type,
          'outcome', item.outcome,
          'capturedAt', item.captured_at
        ) order by item.created_at) as items
        from checkin_capture_items item
        where item.registration_id = registration.id
      ) registration_items on true
      left join lateral (
        select identity.identity_type, identity.identity_number_last4
        from guest_identity_details identity
        where identity.registration_id = registration.id
        order by identity.created_at desc
        limit 1
      ) registration_identity on true
      left join folios f on f.reservation_id = r.id
      left join lateral (
        select coalesce(sum(
          case when entry.entry_type = 'DEBIT'
            then entry.total_amount_idr
            else -entry.total_amount_idr
          end
        ), 0) as balance_idr,
        coalesce(sum(case
          when entry.category not in ('PAYMENT', 'PAYMENT_REVERSAL', 'REFUND')
            and entry.entry_type = 'DEBIT' then entry.total_amount_idr
          when entry.category not in ('PAYMENT', 'PAYMENT_REVERSAL', 'REFUND')
            and entry.entry_type = 'CREDIT' then -entry.total_amount_idr
          else 0
        end), 0) as charge_total_idr,
        coalesce(sum(case
          when entry.category = 'PAYMENT' and entry.entry_type = 'CREDIT'
            then entry.total_amount_idr
          when entry.category = 'PAYMENT_REVERSAL' and entry.entry_type = 'DEBIT'
            then -entry.total_amount_idr
          else 0
        end), 0) as verified_payment_idr
        from folio_entries entry
        where entry.folio_id = f.id
      ) folio_balance on true
      group by r.id, f.id, folio_balance.balance_idr,
        folio_balance.charge_total_idr, folio_balance.verified_payment_idr,
        page.created_at
      order by page.created_at desc, r.id desc
    `),
    ]);
    return NextResponse.json({
      bookings: result.rows,
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
    if (body.action === "QUOTE") {
      return NextResponse.json(
        await createBookingQuote({
          propertyId,
          input: {
            checkInDate: body.checkInDate,
            checkoutDate: body.checkoutDate,
            ratePlanCode: body.ratePlanCode,
            language: body.language,
            displayCurrency: body.displayCurrency,
            rooms: body.rooms,
          },
          idempotencyKey,
          source: "ADMIN_MANUAL",
          session,
        }),
        { status: 201 },
      );
    }
    if (body.action === "RESERVE") {
      return NextResponse.json(
        await createReservation({
          propertyId,
          input: {
            source: "ADMIN_MANUAL",
            quoteId: body.quoteId,
            booker: body.booker,
            internalNotes: body.internalNotes,
            paymentMode: body.paymentMode,
            depositValue: body.depositValue,
            acknowledgedPolicyVersionIds: body.acknowledgedPolicyVersionIds,
          },
          idempotencyKey,
          session,
        }),
        { status: 201 },
      );
    }
    return NextResponse.json(
      await cancelReservation({
        propertyId,
        reservationId: body.reservationId,
        reason: body.reason,
        idempotencyKey,
        session,
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
        ? new AppError("VALIDATION_ERROR", "Invalid staff booking request")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
