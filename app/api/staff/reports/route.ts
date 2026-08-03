import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCsvReportExport,
  getOperationalDashboard,
  runDailyRollover,
  runReconciliation,
  updateReconciliationException,
} from "../../../../src/modules/reporting/reporting-service";
import { AuthorizationError } from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("RUN_DAILY_ROLLOVER"),
    businessDate: z.iso.date().optional(),
  }),
  z.object({
    action: z.literal("RUN_RECONCILIATION"),
    businessDate: z.iso.date().optional(),
  }),
  z.object({
    action: z.literal("UPDATE_EXCEPTION"),
    exceptionId: z.string().uuid(),
    transition: z.enum([
      "ACKNOWLEDGE",
      "INVESTIGATE",
      "RESOLVE",
      "ACCEPT_WITH_REASON",
    ]),
    reason: z.string().trim().min(3).max(2000).optional(),
    resolutionReference: z.string().trim().max(200).optional(),
    assignedToUserId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("EXPORT_CSV"),
    reportCode: z.enum([
      "DAILY_OPERATIONS",
      "BOOKINGS",
      "FINANCIAL_LEDGER",
      "CLEANING",
      "RECONCILIATION",
    ]),
    rangeStart: z.iso.date(),
    rangeEnd: z.iso.date(),
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
      ? new AppError("VALIDATION_ERROR", "Invalid reporting request")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const query = new URL(request.url).searchParams;
    return NextResponse.json(
      await getOperationalDashboard({
        propertyId,
        session,
        businessDate: query.get("businessDate") ?? undefined,
        rangeStart: query.get("rangeStart") ?? undefined,
        rangeEnd: query.get("rangeEnd") ?? undefined,
      }),
    );
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
    const body = mutationSchema.parse(await request.json());
    if (body.action === "RUN_DAILY_ROLLOVER")
      return NextResponse.json(
        await runDailyRollover({
          propertyId,
          session,
          idempotencyKey,
          businessDate: body.businessDate,
        }),
      );
    if (body.action === "RUN_RECONCILIATION")
      return NextResponse.json(
        await runReconciliation({
          propertyId,
          session,
          idempotencyKey,
          businessDate: body.businessDate,
        }),
      );
    if (body.action === "UPDATE_EXCEPTION")
      return NextResponse.json(
        await updateReconciliationException({
          propertyId,
          session,
          idempotencyKey,
          exceptionId: body.exceptionId,
          action: body.transition,
          reason: body.reason,
          resolutionReference: body.resolutionReference,
          assignedToUserId: body.assignedToUserId,
        }),
      );
    const result = await createCsvReportExport({
      propertyId,
      session,
      idempotencyKey,
      reportCode: body.reportCode,
      rangeStart: body.rangeStart,
      rangeEnd: body.rangeEnd,
    });
    return new Response(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Report-Export-Id": result.reportExportId,
        "X-Report-Row-Count": String(result.rowCount),
      },
    });
  } catch (error) {
    return responseFor(error);
  }
}
