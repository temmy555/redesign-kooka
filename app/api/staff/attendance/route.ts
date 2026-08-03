import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAttendanceReport,
  getSelfAttendance,
  recordAttendance,
} from "../../../../src/modules/attendance/attendance-service";
import { AuthorizationError } from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import {
  noopMalwareScanner,
  purgeStoredFile,
  runMalwareScan,
  saveStoredFile,
} from "../../../../src/platform/file-storage";
import {
  IdempotencyConflictError,
  IdempotencyInProgressError,
} from "../../../../src/platform/idempotency";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const clockSchema = z.object({
  action: z.enum(["CHECK_IN", "CHECK_OUT"]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().nonnegative().max(10_000),
  deviceTime: z.coerce.date().optional(),
});

const reportQuerySchema = z
  .object({
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    page: z.coerce.number().int().positive().max(100_000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => [25, 50, 100].includes(value))
      .default(25),
    search: z.string().trim().max(120).default(""),
    exportAll: z.coerce.boolean().default(false),
  })
  .refine(
    (value) => Boolean(value.startDate) === Boolean(value.endDate),
    "Tanggal awal dan akhir harus diisi bersama",
  );

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
  if (
    error instanceof IdempotencyConflictError ||
    error instanceof IdempotencyInProgressError
  )
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Permintaan absensi yang sama sedang atau sudah diproses",
        },
      },
      { status: 409 },
    );
  const response = toErrorResponse(
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Data absensi tidak valid")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    const url = new URL(request.url);
    if (url.searchParams.get("view") === "report") {
      const dates = reportQuerySchema.parse({
        startDate: url.searchParams.get("startDate") ?? undefined,
        endDate: url.searchParams.get("endDate") ?? undefined,
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        exportAll: url.searchParams.get("export") === "1",
      });
      return NextResponse.json(
        await getAttendanceReport({
          session,
          propertyId,
          startDate: dates.startDate,
          endDate: dates.endDate,
          page: dates.page,
          pageSize: dates.pageSize,
          search: dates.search,
          exportAll: dates.exportAll,
        }),
      );
    }
    return NextResponse.json(await getSelfAttendance({ session, propertyId }));
  } catch (error) {
    return responseFor(error);
  }
}

export async function POST(request: Request) {
  let uploadedFileId: string | null = null;
  let actorUserId: string | null = null;
  try {
    const session = await requireCurrentSession();
    actorUserId = session.user.id;
    const propertyId = await getActivePropertyId();
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 160)
      throw new AppError(
        "VALIDATION_ERROR",
        "Idempotency-Key absensi tidak valid",
      );
    const form = await request.formData();
    const file = form.get("selfie");
    if (!(file instanceof File))
      throw new AppError("VALIDATION_ERROR", "Selfie absensi wajib diambil");
    if (!new Set(["image/jpeg", "image/png"]).has(file.type))
      throw new AppError(
        "VALIDATION_ERROR",
        "Selfie harus berupa gambar JPEG atau PNG",
      );
    const input = clockSchema.parse({
      action: form.get("action"),
      latitude: form.get("latitude"),
      longitude: form.get("longitude"),
      accuracyMeters: form.get("accuracyMeters"),
      deviceTime: form.get("deviceTime") || undefined,
    });
    const stored = await saveStoredFile({
      propertyId,
      originalName: "attendance-selfie.jpg",
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      classification: "SENSITIVE_EMPLOYEE_DATA",
      purpose: "ATTENDANCE_SELFIE",
      retentionCategory: "ATTENDANCE_EVIDENCE",
      actorUserId: session.user.id,
    });
    uploadedFileId = stored.id;
    const scanStatus = await runMalwareScan(stored.id, noopMalwareScanner);
    if (scanStatus !== "CLEAN")
      throw new AppError(
        "VALIDATION_ERROR",
        "Selfie tidak lolos pemeriksaan file",
      );
    const result = await recordAttendance({
      session,
      propertyId,
      input: {
        action: input.action,
        selfieFileId: stored.id,
        position: {
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
        },
        deviceTime: input.deviceTime ?? null,
        deviceMetadata: {
          userAgent: (request.headers.get("user-agent") ?? "").slice(0, 500),
        },
        idempotencyKey,
      },
    });
    if (result.selfieFileId !== stored.id) {
      await purgeStoredFile(stored.id, session.user.id);
      uploadedFileId = null;
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (uploadedFileId)
      await purgeStoredFile(uploadedFileId, actorUserId).catch(() => undefined);
    return responseFor(error);
  }
}
