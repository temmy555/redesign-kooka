import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  businessDayRuns,
  reconciliationExceptions,
  reportExports,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { getBusinessDate } from "../../platform/clock";
import { AppError } from "../../platform/errors";
import {
  type IdempotencyTransaction,
  withIdempotency,
} from "../../platform/idempotency";
import { stableRequestHash } from "../booking/domain";
import type { StaffSessionLike } from "../operations/contracts";
import {
  DASHBOARD_MAX_DAYS,
  EXPORT_MAX_DAYS,
  EXPORT_MAX_ROWS,
  maskNameForExport,
  REPORT_METRIC_VERSION,
  REPORT_TIMEZONE,
  type ReconciliationAction,
  type ReportCode,
  statusForReconciliationAction,
  validateDateRange,
} from "./contracts";

const EXCEL_REPORT_COLUMNS: Record<
  ReportCode,
  Array<{ key: string; label: string; width: number; numeric?: boolean }>
> = {
  DAILY_OPERATIONS: [
    { key: "bookingCode", label: "Kode booking", width: 24 },
    { key: "reservationStatus", label: "Status booking", width: 18 },
    { key: "roomLine", label: "Baris kamar", width: 12, numeric: true },
    { key: "checkInDate", label: "Check-in", width: 14 },
    { key: "checkoutDate", label: "Check-out", width: 14 },
    { key: "lineStatus", label: "Status kamar", width: 18 },
    { key: "guestName", label: "Nama tamu (disamarkan)", width: 28 },
    { key: "stayStatus", label: "Status menginap", width: 18 },
    { key: "roomNumber", label: "Nomor kamar", width: 14 },
  ],
  BOOKINGS: [
    { key: "bookingCode", label: "Kode booking", width: 24 },
    { key: "reservationStatus", label: "Status booking", width: 18 },
    { key: "roomLine", label: "Baris kamar", width: 12, numeric: true },
    { key: "checkInDate", label: "Check-in", width: 14 },
    { key: "checkoutDate", label: "Check-out", width: 14 },
    { key: "lineStatus", label: "Status kamar", width: 18 },
    { key: "guestName", label: "Nama tamu (disamarkan)", width: 28 },
    { key: "stayStatus", label: "Status menginap", width: 18 },
    { key: "roomNumber", label: "Nomor kamar", width: 14 },
  ],
  FINANCIAL_LEDGER: [
    { key: "bookingCode", label: "Kode booking", width: 24 },
    { key: "serviceDate", label: "Tanggal layanan", width: 16 },
    { key: "entryType", label: "Tipe entri", width: 14 },
    { key: "category", label: "Kategori", width: 18 },
    { key: "description", label: "Deskripsi", width: 36 },
    { key: "amountIdr", label: "Nominal IDR", width: 18, numeric: true },
    { key: "currency", label: "Mata uang", width: 12 },
    { key: "sourceType", label: "Sumber", width: 18 },
  ],
  CLEANING: [
    { key: "taskType", label: "Jenis tugas", width: 20 },
    { key: "priority", label: "Prioritas", width: 14 },
    { key: "status", label: "Status", width: 18 },
    { key: "roomNumber", label: "Nomor kamar", width: 14 },
    { key: "targetAt", label: "Target", width: 24 },
    { key: "completedAt", label: "Selesai", width: 24 },
    { key: "inspectedAt", label: "Diperiksa", width: 24 },
  ],
  RECONCILIATION: [
    { key: "checkCode", label: "Kode pemeriksaan", width: 30 },
    { key: "severity", label: "Tingkat", width: 14 },
    { key: "status", label: "Status", width: 18 },
    { key: "entityType", label: "Jenis data", width: 18 },
    { key: "businessDate", label: "Business date", width: 16 },
    { key: "detectedAt", label: "Terdeteksi", width: 24 },
    { key: "lastDetectedAt", label: "Terakhir terdeteksi", width: 24 },
    {
      key: "occurrenceCount",
      label: "Jumlah kejadian",
      width: 16,
      numeric: true,
    },
    { key: "resolutionReason", label: "Alasan penyelesaian", width: 34 },
    { key: "resolutionReference", label: "Referensi", width: 24 },
  ],
};

const EXCEL_REPORT_TITLES: Record<ReportCode, string> = {
  DAILY_OPERATIONS: "Laporan Operasional Harian",
  BOOKINGS: "Laporan Booking",
  FINANCIAL_LEDGER: "Laporan Financial Ledger",
  CLEANING: "Laporan Cleaning",
  RECONCILIATION: "Laporan Reconciliation",
};

interface QueueRow extends Record<string, unknown> {
  queueType: string;
  entityId: string;
  bookingCode: string | null;
  roomNumber: string | null;
  guestName: string | null;
  status: string;
  scheduledAt: Date | string | null;
  amountIdr: string | null;
  alert: string | null;
}

interface MetricRow extends Record<string, unknown> {
  metric: string;
  value: string;
}

export async function getOperationalDashboard(params: {
  propertyId: string;
  session: StaffSessionLike;
  businessDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  now?: Date;
}) {
  await requirePermission(params.session, params.propertyId, "report.view");
  const now = params.now ?? new Date();
  const businessDate = params.businessDate ?? getBusinessDate(now);
  const rangeStart = params.rangeStart ?? businessDate;
  const rangeEnd = params.rangeEnd ?? businessDate;
  validateDateRange(rangeStart, rangeEnd, DASHBOARD_MAX_DAYS);
  const db = getDatabase();

  const queueResult = await db.execute<QueueRow>(sql`
    select 'ARRIVAL'::text as "queueType", rr.id as "entityId", r.booking_code as "bookingCode",
      ru.room_number as "roomNumber", coalesce(g.full_name, r.booker_name) as "guestName",
      st.status, st.planned_arrival_at as "scheduledAt", null::numeric::text as "amountIdr",
      case when ra.id is null then 'ROOM_UNASSIGNED' else null end as alert
    from room_stays st
    join reservation_rooms rr on rr.id = st.reservation_room_id
    join reservations r on r.id = rr.reservation_id
    left join guests g on g.id = st.lead_guest_id
    left join room_assignments ra on ra.room_stay_id = st.id and ra.status in ('PLANNED','ACTIVE')
    left join room_units ru on ru.id = ra.room_unit_id
    where r.property_id = ${params.propertyId} and rr.check_in_date = ${businessDate}::date
      and st.status in ('NOT_STARTED','DUE_IN','NO_SHOW')
    union all
    select 'DEPARTURE', rr.id, r.booking_code, ru.room_number, coalesce(g.full_name, r.booker_name),
      st.status, st.planned_departure_at, coalesce(folio_balance.balance_idr, 0)::text,
      case
        when abs(coalesce(folio_balance.balance_idr, 0)) >= 0.5 then 'FOLIO_UNSETTLED'
        when st.status = 'DUE_OUT' then 'CHECKOUT_PENDING'
        else null
      end
    from room_stays st
    join reservation_rooms rr on rr.id = st.reservation_room_id
    join reservations r on r.id = rr.reservation_id
    left join guests g on g.id = st.lead_guest_id
    left join room_assignments ra on ra.room_stay_id = st.id and ra.status = 'ACTIVE'
    left join room_units ru on ru.id = ra.room_unit_id
    left join folios f on f.reservation_id = r.id
    left join lateral (
      select coalesce(sum(
        case when entry.entry_type = 'DEBIT'
          then entry.total_amount_idr
          else -entry.total_amount_idr
        end
      ), 0) as balance_idr
      from folio_entries entry
      where entry.folio_id = f.id
    ) folio_balance on true
    where r.property_id = ${params.propertyId} and rr.checkout_date = ${businessDate}::date
      and st.status in ('IN_HOUSE','DUE_OUT')
    union all
    select 'UPCOMING', rr.id, r.booking_code, null, r.booker_name, r.status,
      (rr.check_in_date::timestamp at time zone 'Asia/Jakarta'), null::numeric::text, null
    from reservation_rooms rr join reservations r on r.id = rr.reservation_id
    where r.property_id = ${params.propertyId} and rr.check_in_date > ${businessDate}::date
      and rr.check_in_date <= (${businessDate}::date + 7) and rr.line_status = 'ACTIVE'
      and r.status in ('ON_HOLD','CONFIRMED')
    union all
    select 'UNASSIGNED', rr.id, r.booking_code, null, coalesce(g.full_name, r.booker_name), st.status,
      st.planned_arrival_at, null::numeric::text, 'ROOM_UNASSIGNED'
    from room_stays st
    join reservation_rooms rr on rr.id = st.reservation_room_id
    join reservations r on r.id = rr.reservation_id
    left join guests g on g.id = st.lead_guest_id
    where r.property_id = ${params.propertyId} and rr.check_in_date <= (${businessDate}::date + 7)
      and rr.checkout_date > ${businessDate}::date and st.status not in ('CHECKED_OUT','NO_SHOW')
      and not exists (select 1 from room_assignments ra where ra.room_stay_id = st.id and ra.status in ('PLANNED','ACTIVE'))
    union all
    select 'PAYMENT_REVIEW', p.id, r.booking_code, null, r.booker_name, p.status, p.created_at,
      p.amount_idr::text, case when p.created_at < now() - interval '2 hours' then 'STALE' else null end
    from payments p join folios f on f.id = p.folio_id join reservations r on r.id = f.reservation_id
    where r.property_id = ${params.propertyId} and p.status = 'PENDING_VERIFICATION'
    union all
    select 'CLEANING', ct.id, null, ru.room_number, null, ct.status, coalesce(ct.target_at, ct.requested_at),
      null::numeric::text, case when ct.target_at < now() and ct.status not in ('CLEANED','INSPECTED') then 'OVERDUE' else null end
    from cleaning_tasks ct left join room_units ru on ru.id = ct.room_unit_id
    where ct.property_id = ${params.propertyId} and ct.status not in ('INSPECTED','CANCELLED')
    union all
    select 'MAINTENANCE', mi.id, null, ru.room_number, null, mi.status, mi.created_at,
      null::numeric::text, mi.severity
    from maintenance_issues mi left join room_units ru on ru.id = mi.room_unit_id
    where mi.property_id = ${params.propertyId} and mi.status not in ('VERIFIED','CANCELLED')
    union all
    select 'REFUND', rf.id, r.booking_code, null, r.booker_name, rf.status, rf.created_at,
      rf.amount_idr::text, case when rf.status in ('FAILED') then 'ATTENTION' else null end
    from refunds rf join folios f on f.id = rf.folio_id join reservations r on r.id = f.reservation_id
    where r.property_id = ${params.propertyId} and rf.status not in ('REFUNDED','REJECTED','CANCELLED')
    order by "queueType", "scheduledAt" nulls last
  `);

  const metricResult = await db.execute<MetricRow>(sql`
    select 'physical_rooms' metric, count(*)::text value from room_units where property_id = ${params.propertyId} and status = 'ACTIVE'
    union all select 'occupied_rooms', count(distinct ra.room_unit_id)::text
      from room_assignments ra join room_stays st on st.id = ra.room_stay_id
      join reservation_rooms rr on rr.id = st.reservation_room_id join reservations r on r.id = rr.reservation_id
      where r.property_id = ${params.propertyId} and ra.status = 'ACTIVE' and st.status in ('IN_HOUSE','DUE_OUT')
    union all select 'room_revenue_idr', coalesce(sum(case when fe.entry_type='DEBIT' then fe.total_amount_idr else -fe.total_amount_idr end),0)::text
      from folio_entries fe left join folio_entries original on original.id=fe.reversal_of_entry_id
      join folios f on f.id=fe.folio_id join reservations r on r.id=f.reservation_id
      where r.property_id=${params.propertyId} and coalesce(original.category,fe.category)='ROOM'
        and fe.service_date between ${rangeStart}::date and ${rangeEnd}::date
    union all select 'total_revenue_idr', coalesce(sum(case when fe.entry_type='DEBIT' then fe.total_amount_idr else -fe.total_amount_idr end),0)::text
      from folio_entries fe left join folio_entries original on original.id=fe.reversal_of_entry_id
      join folios f on f.id=fe.folio_id join reservations r on r.id=f.reservation_id
      where r.property_id=${params.propertyId}
        and coalesce(original.category,fe.category) not in ('PAYMENT','PAYMENT_REVERSAL','REFUND')
        and fe.service_date between ${rangeStart}::date and ${rangeEnd}::date
    union all select 'verified_payments_idr', coalesce(sum(p.amount_idr),0)::text
      from payments p join folios f on f.id=p.folio_id join reservations r on r.id=f.reservation_id
      where r.property_id=${params.propertyId} and p.status='VERIFIED'
        and (p.received_at at time zone 'Asia/Jakarta')::date between ${rangeStart}::date and ${rangeEnd}::date
    union all select 'refunded_idr', coalesce(sum(rf.amount_idr),0)::text
      from refunds rf join folios f on f.id=rf.folio_id join reservations r on r.id=f.reservation_id
      where r.property_id=${params.propertyId} and rf.status='REFUNDED'
        and (rf.refunded_at at time zone 'Asia/Jakarta')::date between ${rangeStart}::date and ${rangeEnd}::date
    union all select 'outstanding_idr', coalesce(sum(case when fe.entry_type='DEBIT' then fe.total_amount_idr else -fe.total_amount_idr end),0)::text
      from folio_entries fe join folios f on f.id=fe.folio_id join reservations r on r.id=f.reservation_id
      where r.property_id=${params.propertyId} and f.status='OPEN'
        and r.status not in ('CANCELLED','EXPIRED')
  `);
  const metrics = Object.fromEntries(
    metricResult.rows.map((row) => [row.metric, Number(row.value)]),
  );
  // Object.groupBy() intentionally returns a null-prototype object. That is
  // safe for JSON responses, but React Server Components reject it when the
  // dashboard is passed to the client view. Reduce into an ordinary object so
  // the same service result is valid across both the API and RSC boundaries.
  const queues = queueResult.rows.reduce<Record<string, QueueRow[]>>(
    (grouped, row) => {
      (grouped[row.queueType] ??= []).push(row);
      return grouped;
    },
    {},
  );
  const exceptions = await db
    .select()
    .from(reconciliationExceptions)
    .where(
      and(
        eq(reconciliationExceptions.propertyId, params.propertyId),
        inArray(reconciliationExceptions.status, [
          "OPEN",
          "ACKNOWLEDGED",
          "INVESTIGATING",
        ]),
      ),
    )
    .orderBy(desc(reconciliationExceptions.lastDetectedAt));

  return {
    metadata: {
      timezone: REPORT_TIMEZONE,
      businessDate,
      rangeStart,
      rangeEnd,
      dataAsOf: now.toISOString(),
      metricVersion: REPORT_METRIC_VERSION,
      currency: "IDR",
    },
    summary: {
      ...metrics,
      occupancyPercent:
        metrics.physical_rooms > 0
          ? Number(
              ((metrics.occupied_rooms / metrics.physical_rooms) * 100).toFixed(
                2,
              ),
            )
          : 0,
    },
    queues,
    reconciliation: {
      openCount: exceptions.length,
      criticalCount: exceptions.filter((item) => item.severity === "CRITICAL")
        .length,
      exceptions,
    },
  };
}

interface DetectedIssue {
  checkCode: string;
  fingerprint: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
}

async function detectIssues(
  tx: IdempotencyTransaction,
  propertyId: string,
): Promise<DetectedIssue[]> {
  const result = await tx.execute<{
    checkCode: string;
    fingerprint: string;
    severity: DetectedIssue["severity"];
    entityType: string;
    entityId: string | null;
    details: Record<string, unknown>;
  }>(sql`
    select 'INVENTORY_OVERCLAIM' "checkCode", 'inventory:'||d.id "fingerprint", 'CRITICAL' severity,
      'inventory_day' "entityType", d.id "entityId",
      jsonb_build_object('stayDate',d.stay_date,'capacity',d.physical_capacity,'claimed',sum(c.quantity)) details
    from inventory_days d join inventory_claims c on c.inventory_day_id=d.id and c.claim_status='ACTIVE'
    where d.property_id=${propertyId} group by d.id having sum(c.quantity)>d.physical_capacity
    union all
    select 'ASSIGNMENT_NIGHT_OVERLAP','assignment-night:'||ran.room_unit_id||':'||ran.stay_date,
      'CRITICAL','room_unit',ran.room_unit_id,
      jsonb_build_object('stayDate',ran.stay_date,'activeAssignments',count(*))
    from room_assignment_nights ran join room_units ru on ru.id=ran.room_unit_id
    where ru.property_id=${propertyId} and ran.released_at is null
    group by ran.room_unit_id,ran.stay_date having count(*)>1
    union all
    select 'PAYMENT_POSTING_MISSING','payment:'||p.id,'CRITICAL','payment',p.id,
      jsonb_build_object('paymentCode',p.payment_code,'status',p.status)
    from payments p join folios f on f.id=p.folio_id join reservations r on r.id=f.reservation_id
    where r.property_id=${propertyId} and p.status='VERIFIED' and p.folio_entry_id is null
    union all
    select 'DUPLICATE_SOURCE_CHARGE','folio-source:'||fe.folio_id||':'||fe.source_type||':'||fe.source_id||':'||coalesce(fe.source_line_id,fe.source_id),
      'CRITICAL','folio',fe.folio_id,
      jsonb_build_object('sourceType',fe.source_type,'sourceId',fe.source_id,'sourceLineId',fe.source_line_id,'count',count(*))
    from folio_entries fe join folios f on f.id=fe.folio_id join reservations r on r.id=f.reservation_id
    where r.property_id=${propertyId} and fe.entry_type='DEBIT' and fe.reversal_of_entry_id is null
    group by fe.folio_id,fe.source_type,fe.source_id,fe.source_line_id having count(*)>1
    union all
    select 'DOCUMENT_FINAL_COVERAGE_DUPLICATE','document-coverage:'||dec.folio_entry_id,
      'CRITICAL','folio_entry',dec.folio_entry_id,
      jsonb_build_object('activeFinalCoverage',count(*))
    from document_entry_coverage dec
    join financial_document_versions fdv on fdv.id=dec.document_version_id
    join financial_documents fd on fd.id=fdv.document_id
    where fd.property_id=${propertyId} and dec.active_final_coverage='YES'
    group by dec.folio_entry_id having count(*)>1
    union all
    select 'ROOM_STATE_MISMATCH','room-state:'||ru.id,'HIGH','room_unit',ru.id,
      jsonb_build_object('roomNumber',ru.room_number,'state',rus.occupancy_status)
    from room_units ru join room_unit_states rus on rus.room_unit_id=ru.id
    where ru.property_id=${propertyId} and (
      (rus.occupancy_status='OCCUPIED' and not exists (
        select 1 from room_assignments ra join room_stays st on st.id=ra.room_stay_id
        where ra.room_unit_id=ru.id and ra.status='ACTIVE' and st.status in ('IN_HOUSE','DUE_OUT')
      )) or
      (rus.occupancy_status='VACANT' and exists (
        select 1 from room_assignments ra join room_stays st on st.id=ra.room_stay_id
        where ra.room_unit_id=ru.id and ra.status='ACTIVE' and st.status in ('IN_HOUSE','DUE_OUT')
      )))
    union all
    select 'REFUND_OVERPAYMENT','refund-folio:'||f.id,'CRITICAL','folio',f.id,
      jsonb_build_object('verifiedPayments',coalesce(p.paid,0),'refunded',coalesce(rf.refunded,0))
    from folios f join reservations r on r.id=f.reservation_id
    left join lateral (select sum(amount_idr) paid from payments where folio_id=f.id and status='VERIFIED') p on true
    left join lateral (select sum(amount_idr) refunded from refunds where folio_id=f.id and status='REFUNDED') rf on true
    where r.property_id=${propertyId} and coalesce(rf.refunded,0)>coalesce(p.paid,0)
  `);
  return result.rows;
}

async function persistDetectedIssues(
  tx: IdempotencyTransaction,
  params: {
    propertyId: string;
    businessDate: string;
    actorUserId: string;
    issues: DetectedIssue[];
  },
) {
  const ids: string[] = [];
  for (const issue of params.issues) {
    const [saved] = await tx
      .insert(reconciliationExceptions)
      .values({
        propertyId: params.propertyId,
        businessDate: params.businessDate,
        ...issue,
        createdByUserId: params.actorUserId,
        updatedByUserId: params.actorUserId,
      })
      .onConflictDoUpdate({
        target: [
          reconciliationExceptions.propertyId,
          reconciliationExceptions.fingerprint,
        ],
        set: {
          businessDate: params.businessDate,
          severity: issue.severity,
          details: issue.details,
          status: sql`case when ${reconciliationExceptions.status} in ('RESOLVED','ACCEPTED_WITH_REASON') then 'OPEN' else ${reconciliationExceptions.status} end`,
          lastDetectedAt: new Date(),
          occurrenceCount: sql`${reconciliationExceptions.occurrenceCount} + 1`,
          updatedByUserId: params.actorUserId,
          updatedAt: new Date(),
          version: sql`${reconciliationExceptions.version} + 1`,
        },
      })
      .returning({ id: reconciliationExceptions.id });
    if (saved) ids.push(saved.id);
  }
  return ids;
}

export async function runReconciliation(params: {
  propertyId: string;
  businessDate?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "reconciliation.manage",
  );
  const businessDate = params.businessDate ?? getBusinessDate();
  return withIdempotency(
    {
      scope: "reporting.reconciliation.run",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({ ...params, businessDate }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const issues = await detectIssues(tx, params.propertyId);
      const ids = await persistDetectedIssues(tx, {
        propertyId: params.propertyId,
        businessDate,
        actorUserId: params.session.user.id,
        issues,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "RECONCILIATION_RUN",
          targetType: "property",
          targetId: params.propertyId,
          after: { businessDate, detected: issues.length, exceptionIds: ids },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "reconciliation_run",
        response: {
          businessDate,
          checkedAt: new Date().toISOString(),
          detected: issues.length,
          critical: issues.filter((issue) => issue.severity === "CRITICAL")
            .length,
          exceptionIds: ids,
          attendanceReadiness: {
            status: "DEFERRED_PHASE_1B",
            blockingDailyClose: false,
          },
        },
      };
    },
  );
}

export async function runDailyRollover(params: {
  propertyId: string;
  businessDate?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "daily_operations.manage",
  );
  const businessDate = params.businessDate ?? getBusinessDate();
  return withIdempotency(
    {
      scope: "reporting.daily-rollover",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({ ...params, businessDate }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const existing = await tx
        .select({
          id: businessDayRuns.id,
          status: businessDayRuns.status,
          summary: businessDayRuns.summary,
        })
        .from(businessDayRuns)
        .where(
          and(
            eq(businessDayRuns.propertyId, params.propertyId),
            eq(businessDayRuns.businessDate, businessDate),
            eq(businessDayRuns.runType, "ROLLOVER"),
          ),
        )
        .limit(1)
        .for("update");
      if (
        existing[0]?.status === "COMPLETED" ||
        existing[0]?.status === "NEEDS_ATTENTION"
      )
        return {
          resultType: "business_day_run",
          resultId: existing[0].id,
          response: {
            businessDayRunId: existing[0].id,
            businessDate,
            status: existing[0].status,
            summary: existing[0].summary ?? {},
            replayed: true,
          },
        };
      const [run] = existing[0]
        ? existing
        : await tx
            .insert(businessDayRuns)
            .values({
              propertyId: params.propertyId,
              businessDate,
              runType: "ROLLOVER",
              status: "RUNNING",
              startedAt: new Date(),
              idempotencyKey: params.idempotencyKey,
              createdByUserId: params.session.user.id,
            })
            .returning({
              id: businessDayRuns.id,
              status: businessDayRuns.status,
              summary: businessDayRuns.summary,
            });
      if (!run) throw new Error("Failed to create business day run");
      const generated = await tx.execute<{ id: string; taskType: string }>(sql`
        with candidates as (
          select distinct on (st.id) ${params.propertyId}::uuid property_id, ra.room_unit_id, st.id room_stay_id,
            'STAYOVER'::text task_type,
            'NORMAL'::text priority
          from room_stays st join reservation_rooms rr on rr.id=st.reservation_room_id
          join reservations r on r.id=rr.reservation_id
          join room_assignments ra on ra.room_stay_id=st.id and ra.status='ACTIVE'
          where r.property_id=${params.propertyId} and st.status='IN_HOUSE'
            and st.actual_check_in_at is not null
            and (st.actual_check_in_at at time zone 'Asia/Jakarta')::date<${businessDate}::date
            and rr.checkout_date>${businessDate}::date
        ) insert into cleaning_tasks
          (property_id,room_unit_id,room_stay_id,task_type,priority,status,target_at,requested_entry_permission,notes,created_by_user_id,updated_by_user_id)
        select property_id,room_unit_id,room_stay_id,task_type,priority,'REQUESTED',
          (${businessDate}::date+time '09:00') at time zone 'Asia/Jakarta',
          'ASK_FRONT_OFFICE',
          'Generated by automatic daily rollover',${params.session.user.id},${params.session.user.id}
        from candidates c where not exists (
          select 1 from cleaning_tasks ct where ct.room_stay_id=c.room_stay_id and ct.task_type=c.task_type
            and ct.target_at::date=${businessDate}::date and ct.status<>'CANCELLED')
        returning id,task_type "taskType"
      `);
      const issues = await detectIssues(tx, params.propertyId);
      const exceptionIds = await persistDetectedIssues(tx, {
        propertyId: params.propertyId,
        businessDate,
        actorUserId: params.session.user.id,
        issues,
      });
      const critical = issues.filter(
        (issue) => issue.severity === "CRITICAL",
      ).length;
      const status = critical > 0 ? "NEEDS_ATTENTION" : "COMPLETED";
      const summary = {
        cleaningTasksCreated: generated.rows.length,
        reconciliationExceptionsDetected: issues.length,
        criticalExceptions: critical,
        exceptionIds,
        authoritativeDataMutated: false,
      };
      await tx
        .update(businessDayRuns)
        .set({ status, finishedAt: new Date(), summary })
        .where(eq(businessDayRuns.id, run.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "BUSINESS_DAY_ROLLOVER_COMPLETED",
          targetType: "business_day_run",
          targetId: run.id,
          after: { businessDate, status, ...summary },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "business_day_run",
        resultId: run.id,
        response: {
          businessDayRunId: run.id,
          businessDate,
          status,
          summary,
          replayed: false,
        },
      };
    },
  );
}

export async function updateReconciliationException(params: {
  propertyId: string;
  exceptionId: string;
  action: ReconciliationAction;
  reason?: string;
  resolutionReference?: string;
  assignedToUserId?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "reconciliation.manage",
  );
  if (
    ["RESOLVE", "ACCEPT_WITH_REASON"].includes(params.action) &&
    !params.reason?.trim()
  )
    throw new AppError("VALIDATION_ERROR", "Resolution reason is required");
  const nextStatus = statusForReconciliationAction(params.action);
  return withIdempotency(
    {
      scope: "reporting.reconciliation.update",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [current] = await tx
        .select()
        .from(reconciliationExceptions)
        .where(
          and(
            eq(reconciliationExceptions.id, params.exceptionId),
            eq(reconciliationExceptions.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current)
        throw new AppError("NOT_FOUND", "Reconciliation exception not found");
      if (["RESOLVED", "ACCEPTED_WITH_REASON"].includes(current.status))
        throw new AppError(
          "CONFLICT",
          "Reconciliation exception is already closed",
        );
      const isClosed = ["RESOLVED", "ACCEPTED_WITH_REASON"].includes(
        nextStatus,
      );
      await tx
        .update(reconciliationExceptions)
        .set({
          status: nextStatus,
          assignedToUserId: params.assignedToUserId ?? current.assignedToUserId,
          acknowledgedAt:
            params.action === "ACKNOWLEDGE"
              ? new Date()
              : current.acknowledgedAt,
          acknowledgedByUserId:
            params.action === "ACKNOWLEDGE"
              ? params.session.user.id
              : current.acknowledgedByUserId,
          resolvedAt: isClosed ? new Date() : null,
          resolvedByUserId: isClosed ? params.session.user.id : null,
          resolutionReason: isClosed ? params.reason : null,
          resolutionReference: isClosed ? params.resolutionReference : null,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
          version: sql`${reconciliationExceptions.version} + 1`,
        })
        .where(eq(reconciliationExceptions.id, current.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: `RECONCILIATION_${params.action}`,
          targetType: "reconciliation_exception",
          targetId: current.id,
          before: { status: current.status },
          after: {
            status: nextStatus,
            resolutionReference: params.resolutionReference,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "reconciliation_exception",
        resultId: current.id,
        response: { exceptionId: current.id, status: nextStatus },
      };
    },
  );
}

async function loadExportRows(
  tx: IdempotencyTransaction,
  params: {
    propertyId: string;
    reportCode: ReportCode;
    rangeStart: string;
    rangeEnd: string;
  },
): Promise<Array<Record<string, unknown>>> {
  if (
    params.reportCode === "BOOKINGS" ||
    params.reportCode === "DAILY_OPERATIONS"
  ) {
    const result = await tx.execute<Record<string, unknown>>(sql`
      select r.booking_code "bookingCode", r.status "reservationStatus", rr.line_number "roomLine",
        rr.check_in_date "checkInDate", rr.checkout_date "checkoutDate", rr.line_status "lineStatus",
        r.booker_name "guestName", st.status "stayStatus", ru.room_number "roomNumber"
      from reservations r join reservation_rooms rr on rr.reservation_id=r.id
      left join room_stays st on st.reservation_room_id=rr.id
      left join room_assignments ra on ra.room_stay_id=st.id and ra.status in ('PLANNED','ACTIVE')
      left join room_units ru on ru.id=ra.room_unit_id
      where r.property_id=${params.propertyId} and rr.check_in_date<=${params.rangeEnd}::date
        and rr.checkout_date>${params.rangeStart}::date order by rr.check_in_date,r.booking_code,rr.line_number
      limit ${EXPORT_MAX_ROWS + 1}
    `);
    return result.rows.map((row) => ({
      ...row,
      guestName: maskNameForExport(String(row.guestName ?? "")),
    }));
  }
  if (params.reportCode === "FINANCIAL_LEDGER") {
    const result = await tx.execute<Record<string, unknown>>(sql`
      select r.booking_code "bookingCode", fe.service_date "serviceDate", fe.entry_type "entryType",
        fe.category, fe.description, fe.total_amount_idr "amountIdr", fe.currency, fe.source_type "sourceType"
      from folio_entries fe join folios f on f.id=fe.folio_id join reservations r on r.id=f.reservation_id
      where r.property_id=${params.propertyId} and fe.service_date between ${params.rangeStart}::date and ${params.rangeEnd}::date
      order by fe.service_date,fe.posted_at limit ${EXPORT_MAX_ROWS + 1}
    `);
    return result.rows;
  }
  if (params.reportCode === "CLEANING") {
    const result = await tx.execute<Record<string, unknown>>(sql`
      select ct.task_type "taskType",ct.priority,ct.status,ru.room_number "roomNumber",
        ct.target_at "targetAt",ct.completed_at "completedAt",ct.inspected_at "inspectedAt"
      from cleaning_tasks ct left join room_units ru on ru.id=ct.room_unit_id
      where ct.property_id=${params.propertyId} and ct.target_at::date between ${params.rangeStart}::date and ${params.rangeEnd}::date
      order by ct.target_at limit ${EXPORT_MAX_ROWS + 1}
    `);
    return result.rows;
  }
  const result = await tx.execute<Record<string, unknown>>(sql`
    select check_code "checkCode",severity,status,entity_type "entityType",business_date "businessDate",
      detected_at "detectedAt",last_detected_at "lastDetectedAt",occurrence_count "occurrenceCount",
      resolution_reason "resolutionReason",resolution_reference "resolutionReference"
    from reconciliation_exceptions where property_id=${params.propertyId}
      and coalesce(business_date,${params.rangeStart}::date) between ${params.rangeStart}::date and ${params.rangeEnd}::date
    order by last_detected_at desc limit ${EXPORT_MAX_ROWS + 1}
  `);
  return result.rows;
}

export async function createExcelReportExport(params: {
  propertyId: string;
  reportCode: ReportCode;
  rangeStart: string;
  rangeEnd: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "report.export");
  validateDateRange(params.rangeStart, params.rangeEnd, EXPORT_MAX_DAYS);
  return withIdempotency(
    {
      scope: "reporting.excel.export",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
      ttlMs: 15 * 60 * 1000,
    },
    async (tx) => {
      const rows = await loadExportRows(tx, params);
      if (rows.length > EXPORT_MAX_ROWS)
        throw new AppError(
          "VALIDATION_ERROR",
          `Export exceeds ${EXPORT_MAX_ROWS} rows; use a smaller range`,
        );
      const columns = EXCEL_REPORT_COLUMNS[params.reportCode];
      const excelRows = rows.map((row) =>
        columns.map((column) => {
          const value = row[column.key];
          if (column.numeric && value !== null && value !== undefined) {
            const number = Number(value);
            return Number.isFinite(number) ? number : String(value);
          }
          if (value instanceof Date) return value.toISOString();
          return value === null || value === undefined ? "" : String(value);
        }),
      );
      const generatedAt = new Date();
      const expiresAt = new Date(generatedAt.getTime() + 15 * 60 * 1000);
      const [reportExport] = await tx
        .insert(reportExports)
        .values({
          propertyId: params.propertyId,
          reportCode: params.reportCode,
          format: "XLSX",
          filters: {
            rangeStart: params.rangeStart,
            rangeEnd: params.rangeEnd,
            privacy: "MASKED",
          },
          metricVersion: REPORT_METRIC_VERSION,
          dataAsOf: generatedAt,
          generatedAt,
          expiresAt,
          rowCount: rows.length,
          generatedByUserId: params.session.user.id,
          idempotencyKey: params.idempotencyKey,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: reportExports.id });
      if (!reportExport) throw new Error("Failed to record report export");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "REPORT_EXPORTED",
          targetType: "report_export",
          targetId: reportExport.id,
          after: {
            reportCode: params.reportCode,
            rangeStart: params.rangeStart,
            rangeEnd: params.rangeEnd,
            rowCount: rows.length,
            privacy: "MASKED",
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "report_export",
        resultId: reportExport.id,
        response: {
          reportExportId: reportExport.id,
          filename: `kooka-${params.reportCode.toLowerCase().replaceAll("_", "-")}-${params.rangeStart}-${params.rangeEnd}.xlsx`,
          sheetName: EXCEL_REPORT_TITLES[params.reportCode].slice(0, 31),
          title: EXCEL_REPORT_TITLES[params.reportCode],
          subtitle: `Periode ${params.rangeStart} sampai ${params.rangeEnd} · Asia/Jakarta · data sensitif disamarkan`,
          headers: columns.map((column) => column.label),
          columnWidths: columns.map((column) => column.width),
          rows: excelRows,
          rowCount: rows.length,
          expiresAt: expiresAt.toISOString(),
        },
      };
    },
  );
}
