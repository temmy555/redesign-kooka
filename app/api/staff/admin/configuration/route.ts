import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPropertySettingDraft,
  getPropertyConfigurationOverview,
  previewPropertySettingChange,
  publishPropertySettingVersion,
  retirePropertySettingVersion,
  reviewPropertySettingVersion,
  updatePropertyProfile,
} from "../../../../../src/modules/configuration/property-settings";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(500);
const effectiveTo = z.coerce.date().nullable().optional();
const settingInput = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  values: z.record(z.string(), z.unknown()),
  effectiveFrom: z.coerce.date(),
  effectiveTo,
  reason,
  requiresApproval: z.boolean().optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_PROPERTY_PROFILE"),
    name: z.string().trim().min(1).max(160),
    address: z.string().nullable().optional(),
    timezone: z.string().trim().min(1).max(64),
    defaultLocale: z.enum(["id", "en"]),
    reason,
  }),
  z.object({ action: z.literal("PREVIEW_SETTING"), input: settingInput }),
  z.object({ action: z.literal("CREATE_SETTING_DRAFT"), input: settingInput }),
  z.object({
    action: z.literal("REVIEW_SETTING"),
    versionId: z.string().uuid(),
    decision: z.enum(["APPROVE", "REJECT"]),
    reason,
  }),
  z.object({
    action: z.literal("PUBLISH_SETTING"),
    versionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("RETIRE_SETTING"),
    versionId: z.string().uuid(),
    reason,
  }),
]);

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  }
  if (error instanceof z.ZodError) {
    const response = toErrorResponse(
      new AppError("VALIDATION_ERROR", "Invalid request"),
    );
    return NextResponse.json(response.body, { status: response.status });
  }
  const response = toErrorResponse(error);
  return NextResponse.json(response.body, { status: response.status });
}

async function context() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  return { session, propertyId };
}

export async function GET() {
  try {
    const requestContext = await context();
    return NextResponse.json(
      await getPropertyConfigurationOverview(requestContext),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    ) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestContext = await context();
    const body = actionSchema.parse(await request.json());
    switch (body.action) {
      case "UPDATE_PROPERTY_PROFILE":
        return NextResponse.json(
          await updatePropertyProfile({ ...requestContext, ...body }),
        );
      case "PREVIEW_SETTING":
        return NextResponse.json(
          await previewPropertySettingChange({
            ...requestContext,
            input: body.input,
          }),
        );
      case "CREATE_SETTING_DRAFT":
        return NextResponse.json(
          await createPropertySettingDraft({
            ...requestContext,
            input: body.input,
          }),
          { status: 201 },
        );
      case "REVIEW_SETTING":
        return NextResponse.json(
          await reviewPropertySettingVersion({
            ...requestContext,
            versionId: body.versionId,
            decision: body.decision,
            reason: body.reason,
          }),
        );
      case "PUBLISH_SETTING":
        return NextResponse.json(
          await publishPropertySettingVersion({
            ...requestContext,
            versionId: body.versionId,
            reason: body.reason,
          }),
        );
      case "RETIRE_SETTING":
        return NextResponse.json(
          await retirePropertySettingVersion({
            ...requestContext,
            versionId: body.versionId,
            reason: body.reason,
          }),
        );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    ) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    }
    return errorResponse(error);
  }
}
