import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assessDamage,
  claimLostFoundItem,
  createCleaningTask,
  createMaintenanceIssue,
  generateDailyCleaningTasks,
  getOperationsQueues,
  recordLostFoundItem,
  transitionCleaningTask,
  transitionMaintenanceIssue,
  updateRoomReadiness,
} from "../../../../src/modules/operations/property-service";
import { AuthorizationError } from "../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../src/platform/property";
import { requireCurrentSession } from "../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("QUICK_ROOM_STATUS"),
    roomUnitId: z.string().uuid(),
    operation: z.enum(["START_CLEANING", "MARK_READY", "RETURN_TO_SERVICE"]),
    reason: z.string().trim().min(3).max(1000).optional(),
  }),
  z.object({
    action: z.literal("CREATE_CLEANING"),
    roomUnitId: z.string().uuid().optional(),
    roomStayId: z.string().uuid().optional(),
    publicArea: z.string().trim().max(120).optional(),
    taskType: z.enum([
      "CHECKOUT",
      "STAYOVER",
      "ROOM_MOVE",
      "DEEP_CLEAN",
      "PUBLIC_AREA",
      "GUEST_REQUEST",
    ]),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
    entryPermission: z
      .enum(["GRANTED", "NOT_GRANTED", "ASK_FRONT_OFFICE"])
      .optional(),
    targetAt: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("TRANSITION_CLEANING"),
    cleaningTaskId: z.string().uuid(),
    toStatus: z.enum([
      "REQUESTED",
      "ASSIGNED",
      "IN_PROGRESS",
      "CLEANED",
      "INSPECTED",
      "DEFERRED",
      "UNABLE_TO_ACCESS",
      "CANCELLED",
    ]),
    assigneeEmployeeId: z.string().uuid().optional(),
    reasonCode: z
      .enum([
        "GUEST_DND",
        "GUEST_AWAY_REQUEST",
        "ACCESS_DENIED",
        "OPERATIONAL",
        "OTHER",
      ])
      .optional(),
    reason: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("GENERATE_DAILY_CLEANING"),
    businessDate: z.iso.date(),
  }),
  z.object({
    action: z.literal("CREATE_MAINTENANCE"),
    roomUnitId: z.string().uuid().optional(),
    publicArea: z.string().trim().max(120).optional(),
    category: z.string().trim().min(2).max(64),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(3000),
    serviceabilityImpact: z.enum(["NONE", "BLOCKED", "OUT_OF_ORDER"]),
  }),
  z.object({
    action: z.literal("TRANSITION_MAINTENANCE"),
    maintenanceIssueId: z.string().uuid(),
    toStatus: z.enum([
      "TRIAGED",
      "IN_PROGRESS",
      "RESOLVED",
      "VERIFIED",
      "REOPENED",
      "CANCELLED",
    ]),
    notes: z.string().trim().min(3).max(2000),
    returnToService: z.boolean(),
  }),
  z.object({
    action: z.literal("ASSESS_DAMAGE"),
    reservationId: z.string().uuid(),
    roomStayId: z.string().uuid().optional(),
    roomUnitId: z.string().uuid().optional(),
    catalogVersionId: z.string().uuid().optional(),
    description: z.string().trim().min(3).max(2000),
    decision: z.enum(["APPROVED", "WAIVED", "DISPUTED"]),
    amountIdr: z.number().int().nonnegative(),
    reason: z.string().trim().min(3).max(1000),
    serviceDate: z.iso.date(),
  }),
  z.object({
    action: z.literal("RECORD_LOST_FOUND"),
    category: z.string().trim().min(2).max(64),
    description: z.string().trim().min(3).max(2000),
    foundAt: z.coerce.date(),
    foundLocation: z.string().trim().min(2).max(160),
    roomUnitId: z.string().uuid().optional(),
    roomStayId: z.string().uuid().optional(),
    reservationId: z.string().uuid().optional(),
    storageLocation: z.string().trim().max(160).optional(),
    sealReference: z.string().trim().max(80).optional(),
    highValue: z.boolean(),
    retentionDueAt: z.coerce.date().optional(),
  }),
  z.object({
    action: z.literal("CLAIM_LOST_FOUND"),
    itemId: z.string().uuid(),
    claimantName: z.string().trim().min(2).max(200),
    claimantContact: z.string().trim().min(3).max(500),
    verificationDetails: z.record(z.string(), z.unknown()),
    decision: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
    decisionReason: z.string().trim().max(1000).optional(),
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
      ? new AppError("VALIDATION_ERROR", "Invalid property operation")
      : error,
  );
  return NextResponse.json(response.body, { status: response.status });
}

export async function GET() {
  try {
    const session = await requireCurrentSession();
    const propertyId = await getActivePropertyId();
    return NextResponse.json(
      await getOperationsQueues({ propertyId, session }),
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
    const body = schema.parse(await request.json());
    if (body.action === "CREATE_CLEANING")
      return NextResponse.json(
        await createCleaningTask({
          propertyId,
          session,
          idempotencyKey,
          roomUnitId: body.roomUnitId,
          roomStayId: body.roomStayId,
          publicArea: body.publicArea,
          taskType: body.taskType,
          priority: body.priority,
          entryPermission: body.entryPermission,
          targetAt: body.targetAt,
          notes: body.notes,
        }),
        { status: 201 },
      );
    if (body.action === "TRANSITION_CLEANING")
      return NextResponse.json(
        await transitionCleaningTask({
          propertyId,
          session,
          idempotencyKey,
          cleaningTaskId: body.cleaningTaskId,
          toStatus: body.toStatus,
          assigneeEmployeeId: body.assigneeEmployeeId,
          reasonCode: body.reasonCode,
          reason: body.reason,
        }),
      );
    if (body.action === "GENERATE_DAILY_CLEANING")
      return NextResponse.json(
        await generateDailyCleaningTasks({
          propertyId,
          session,
          idempotencyKey,
          businessDate: body.businessDate,
        }),
        { status: 201 },
      );
    if (body.action === "QUICK_ROOM_STATUS")
      return NextResponse.json(
        await updateRoomReadiness({
          propertyId,
          session,
          idempotencyKey,
          roomUnitId: body.roomUnitId,
          action: body.operation,
          reason: body.reason,
        }),
      );
    if (body.action === "CREATE_MAINTENANCE")
      return NextResponse.json(
        await createMaintenanceIssue({
          propertyId,
          session,
          idempotencyKey,
          roomUnitId: body.roomUnitId,
          publicArea: body.publicArea,
          category: body.category,
          severity: body.severity,
          title: body.title,
          description: body.description,
          serviceabilityImpact: body.serviceabilityImpact,
        }),
        { status: 201 },
      );
    if (body.action === "TRANSITION_MAINTENANCE")
      return NextResponse.json(
        await transitionMaintenanceIssue({
          propertyId,
          session,
          idempotencyKey,
          maintenanceIssueId: body.maintenanceIssueId,
          toStatus: body.toStatus,
          notes: body.notes,
          returnToService: body.returnToService,
        }),
      );
    if (body.action === "ASSESS_DAMAGE")
      return NextResponse.json(
        await assessDamage({
          propertyId,
          session,
          idempotencyKey,
          reservationId: body.reservationId,
          roomStayId: body.roomStayId,
          roomUnitId: body.roomUnitId,
          catalogVersionId: body.catalogVersionId,
          description: body.description,
          decision: body.decision,
          amountIdr: body.amountIdr,
          reason: body.reason,
          serviceDate: body.serviceDate,
        }),
        { status: 201 },
      );
    if (body.action === "RECORD_LOST_FOUND")
      return NextResponse.json(
        await recordLostFoundItem({
          propertyId,
          session,
          idempotencyKey,
          category: body.category,
          description: body.description,
          foundAt: body.foundAt,
          foundLocation: body.foundLocation,
          roomUnitId: body.roomUnitId,
          roomStayId: body.roomStayId,
          reservationId: body.reservationId,
          storageLocation: body.storageLocation,
          sealReference: body.sealReference,
          highValue: body.highValue,
          retentionDueAt: body.retentionDueAt,
        }),
        { status: 201 },
      );
    return NextResponse.json(
      await claimLostFoundItem({
        propertyId,
        session,
        idempotencyKey,
        itemId: body.itemId,
        claimantName: body.claimantName,
        claimantContact: body.claimantContact,
        verificationDetails: body.verificationDetails,
        decision: body.decision,
        decisionReason: body.decisionReason,
      }),
      { status: 201 },
    );
  } catch (error) {
    return responseFor(error);
  }
}
