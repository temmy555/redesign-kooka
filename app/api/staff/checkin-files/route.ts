import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthorizationError,
  requirePermission,
} from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { saveStoredFile } from "../../../../src/platform/file-storage";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const purposeSchema = z.enum(["IDENTITY_DOCUMENT", "GUEST_PHOTO", "SIGNATURE"]);

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    await requirePermission(session, propertyId, "stay.manage");
    const form = await request.formData();
    const file = form.get("file");
    const purpose = purposeSchema.parse(form.get("purpose"));
    if (!(file instanceof File))
      throw new AppError("VALIDATION_ERROR", "Capture file is required");
    if (!file.type.startsWith("image/"))
      throw new AppError(
        "VALIDATION_ERROR",
        "Check-in capture accepts JPEG or PNG images only",
      );
    const stored = await saveStoredFile({
      propertyId,
      originalName: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      classification: "SENSITIVE_GUEST_DATA",
      purpose: `CHECKIN_${purpose}`,
      retentionCategory: "GUEST_REGISTRATION",
      actorUserId: session.user.id,
    });
    return NextResponse.json(
      { fileId: stored.id, scanStatus: stored.scanStatus },
      { status: 201 },
    );
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
    const response = toErrorResponse(
      error instanceof z.ZodError
        ? new AppError("VALIDATION_ERROR", "Invalid check-in capture")
        : error,
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
