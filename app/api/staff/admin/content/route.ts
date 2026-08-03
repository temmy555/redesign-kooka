import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createContentPageDraft,
  createContentPreviewToken,
  getContentOverview,
  publishContentVersion,
  restoreContentVersion,
  submitContentForReview,
} from "../../../../../src/modules/content/cms-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(500);
const contentRecord = z.record(z.string(), z.unknown());
const section = z.object({
  key: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(64),
  sortOrder: z.number().int().min(0).max(1_000),
  settings: contentRecord.optional(),
  translations: z.object({ id: contentRecord, en: contentRecord }),
  mediaAssetIds: z.array(z.string().uuid()).max(40).optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_DRAFT"),
    routeKey: z.string().trim().min(1).max(160),
    reason,
    sections: z.array(section).min(1).max(40),
  }),
  z.object({
    action: z.literal("SUBMIT_REVIEW"),
    versionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("PUBLISH"),
    versionId: z.string().uuid(),
    effectiveFrom: z.coerce.date().optional(),
    reason,
  }),
  z.object({
    action: z.literal("RESTORE"),
    sourceVersionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("CREATE_PREVIEW"),
    versionId: z.string().uuid(),
    ttlMinutes: z.number().int().min(1).max(60).optional(),
  }),
]);

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  }
  const response = toErrorResponse(
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid CMS request")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

async function context() {
  return {
    session: await requireCurrentSession(),
    propertyId: await getActivePropertyId(),
  };
}

export async function GET() {
  try {
    return NextResponse.json(await getContentOverview(await context()));
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
      case "CREATE_DRAFT":
        return NextResponse.json(
          await createContentPageDraft({
            ...requestContext,
            input: {
              routeKey: body.routeKey,
              reason: body.reason,
              sections: body.sections,
            },
          }),
          { status: 201 },
        );
      case "SUBMIT_REVIEW":
        return NextResponse.json(
          await submitContentForReview({ ...requestContext, ...body }),
        );
      case "PUBLISH":
        return NextResponse.json(
          await publishContentVersion({ ...requestContext, ...body }),
        );
      case "RESTORE":
        return NextResponse.json(
          await restoreContentVersion({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_PREVIEW": {
        const preview = await createContentPreviewToken({
          ...requestContext,
          ...body,
        });
        return NextResponse.json({
          ...preview,
          url: `/preview?token=${encodeURIComponent(preview.token)}`,
        });
      }
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
