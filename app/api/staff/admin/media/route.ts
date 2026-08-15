import { NextResponse } from "next/server";
import { z } from "zod";

import {
  archiveCmsMedia,
  deleteCmsMedia,
  getMediaOverview,
  linkCmsMedia,
  publishCmsMedia,
  setLandingHeroVideo,
  setLandingSectionMedia,
  setRoomTypeGallery,
  updateCmsMediaMetadata,
  uploadCmsMedia,
} from "../../../../../src/modules/content/media-service";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mediaActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PUBLISH"),
    assetId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("ARCHIVE"),
    assetId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("DELETE"),
    assetId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("LINK"),
    assetId: z.string().uuid(),
    usageType: z.enum([
      "CONTENT_SECTION",
      "ROOM_TYPE_HERO",
      "ROOM_TYPE_GALLERY",
    ]),
    targetId: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(10_000),
  }),
  z.object({
    action: z.literal("SET_ROOM_GALLERY"),
    roomTypeId: z.string().uuid(),
    assetIds: z.array(z.string().uuid()).min(1).max(20),
  }),
  z.object({
    action: z.literal("SET_LANDING_HERO_VIDEO"),
    assetId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("SET_LANDING_SECTION_MEDIA"),
    section: z.enum(["experience", "gallery"]),
    assetIds: z.array(z.string().uuid()).max(3),
  }),
  z.object({
    action: z.literal("UPDATE_METADATA"),
    assetId: z.string().uuid(),
    title: z.string().trim().max(200).optional(),
    altId: z.string().trim().min(1).max(1_000),
    altEn: z.string().trim().min(1).max(1_000),
    captionId: z.string().trim().max(1_000).optional(),
    captionEn: z.string().trim().max(1_000).optional(),
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
      ? new AppError("VALIDATION_ERROR", "Invalid media request")
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
    return NextResponse.json(await getMediaOverview(await context()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestContext = await context();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Media file is required");
    }
    const authentic = form.get("authenticPropertyMedia") === "true";
    const result = await uploadCmsMedia({
      ...requestContext,
      originalName: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
      metadata: {
        title: String(form.get("title") ?? ""),
        altId: String(form.get("altId") ?? ""),
        altEn: String(form.get("altEn") ?? ""),
        captionId: String(form.get("captionId") ?? ""),
        captionEn: String(form.get("captionEn") ?? ""),
        rightsSource: String(form.get("rightsSource") ?? ""),
        authenticPropertyMedia: authentic,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const requestContext = await context();
    const body = mediaActionSchema.parse(await request.json());
    if (body.action === "PUBLISH") {
      return NextResponse.json(
        await publishCmsMedia({ ...requestContext, ...body }),
      );
    }
    if (body.action === "ARCHIVE") {
      return NextResponse.json(
        await archiveCmsMedia({ ...requestContext, ...body }),
      );
    }
    if (body.action === "DELETE") {
      return NextResponse.json(
        await deleteCmsMedia({ ...requestContext, ...body }),
      );
    }
    if (body.action === "SET_ROOM_GALLERY") {
      return NextResponse.json(
        await setRoomTypeGallery({ ...requestContext, ...body }),
      );
    }
    if (body.action === "SET_LANDING_HERO_VIDEO") {
      return NextResponse.json(
        await setLandingHeroVideo({ ...requestContext, ...body }),
      );
    }
    if (body.action === "SET_LANDING_SECTION_MEDIA") {
      return NextResponse.json(
        await setLandingSectionMedia({ ...requestContext, ...body }),
      );
    }
    if (body.action === "UPDATE_METADATA") {
      return NextResponse.json(
        await updateCmsMediaMetadata({ ...requestContext, ...body }),
      );
    }
    return NextResponse.json(
      await linkCmsMedia({ ...requestContext, ...body }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
