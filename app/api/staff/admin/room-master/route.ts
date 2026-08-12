import { NextResponse } from "next/server";
import { z } from "zod";

import {
  archiveRoomMaster,
  changeRoomUnitType,
  createAmenity,
  createResourcePool,
  createRoomTypeDraft,
  createRoomUnit,
  getRoomMasterOverview,
  previewRoomTypeDraft,
  publishRoomTypeVersion,
  reviewRoomTypeVersion,
} from "../../../../../src/modules/configuration/room-master";
import { AuthorizationError } from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(500);
const roomTypeInput = z.object({
  roomTypeId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  nameId: z.string().trim().min(1).max(160),
  nameEn: z.string().trim().min(1).max(160),
  descriptionId: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  bedConfiguration: z.string().max(160).nullable().optional(),
  standardAdults: z.number().int().min(0),
  maximumAdults: z.number().int().min(0),
  maximumChildren: z.number().int().min(0),
  maximumTotalGuests: z.number().int().min(1),
  extraBedAllowed: z.boolean(),
  maximumExtraBeds: z.number().int().min(0),
  extraBedCapacityIncrement: z.number().int().min(0),
  amenityIds: z.array(z.string().uuid()).optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  reason,
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ARCHIVE_MASTER"),
    target: z.enum(["AMENITY", "ROOM_TYPE", "ROOM_UNIT", "RESOURCE_POOL"]),
    targetId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("CREATE_AMENITY"),
    code: z.string().trim().min(1).max(80),
    iconKey: z.string().max(80).nullable().optional(),
    nameId: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    descriptionId: z.string().nullable().optional(),
    descriptionEn: z.string().nullable().optional(),
    reason,
  }),
  z.object({ action: z.literal("PREVIEW_ROOM_TYPE"), input: roomTypeInput }),
  z.object({
    action: z.literal("CREATE_ROOM_TYPE_DRAFT"),
    input: roomTypeInput,
  }),
  z.object({
    action: z.literal("REVIEW_ROOM_TYPE"),
    versionId: z.string().uuid(),
    decision: z.enum(["APPROVE", "REJECT"]),
    reason,
  }),
  z.object({
    action: z.literal("PUBLISH_ROOM_TYPE"),
    versionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("CREATE_ROOM_UNIT"),
    roomNumber: z.string().trim().min(1).max(32),
    sortOrder: z.number().int(),
    floorOrArea: z.string().max(80).nullable().optional(),
    roomTypeId: z.string().uuid(),
    effectiveFrom: z.coerce.date(),
    reason,
  }),
  z.object({
    action: z.literal("CHANGE_ROOM_UNIT_TYPE"),
    roomUnitId: z.string().uuid(),
    roomTypeId: z.string().uuid(),
    effectiveFrom: z.coerce.date(),
    reason,
  }),
  z.object({
    action: z.literal("CREATE_RESOURCE_POOL"),
    code: z.string().trim().min(1).max(64),
    nameId: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    physicalCapacity: z.number().int().min(0),
    inventoryTracked: z.boolean().optional(),
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
  const normalized =
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid request")
      : error;
  const response = toErrorResponse(normalized);
  return NextResponse.json(response.body, { status: response.status });
}

async function context() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  return { session, propertyId };
}

export async function GET() {
  try {
    return NextResponse.json(await getRoomMasterOverview(await context()));
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
      case "ARCHIVE_MASTER":
        return NextResponse.json(
          await archiveRoomMaster({ ...requestContext, ...body }),
        );
      case "CREATE_AMENITY":
        return NextResponse.json(
          await createAmenity({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "PREVIEW_ROOM_TYPE":
        return NextResponse.json(
          await previewRoomTypeDraft({ ...requestContext, input: body.input }),
        );
      case "CREATE_ROOM_TYPE_DRAFT":
        return NextResponse.json(
          await createRoomTypeDraft({ ...requestContext, input: body.input }),
          { status: 201 },
        );
      case "REVIEW_ROOM_TYPE":
        return NextResponse.json(
          await reviewRoomTypeVersion({ ...requestContext, ...body }),
        );
      case "PUBLISH_ROOM_TYPE":
        return NextResponse.json(
          await publishRoomTypeVersion({ ...requestContext, ...body }),
        );
      case "CREATE_ROOM_UNIT":
        return NextResponse.json(
          await createRoomUnit({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CHANGE_ROOM_UNIT_TYPE":
        return NextResponse.json(
          await changeRoomUnitType({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_RESOURCE_POOL":
        return NextResponse.json(
          await createResourcePool({ ...requestContext, ...body }),
          { status: 201 },
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
