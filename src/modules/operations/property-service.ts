import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import {
  cleaningTaskEvents,
  cleaningTasks,
  damageAssessments,
  damageCatalogVersions,
  damageIncidents,
  folioEntries,
  folios,
  lostFoundClaims,
  lostFoundCustodyEvents,
  lostFoundItems,
  maintenanceIssueEvents,
  maintenanceIssues,
  reservations,
  roomBlocks,
  roomUnitStates,
  roomUnits,
} from "../../db/schema";
import { getDatabase } from "../../db";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { encryptSensitiveValue } from "../../platform/encryption";
import { AppError } from "../../platform/errors";
import { withIdempotency } from "../../platform/idempotency";
import { stableRequestHash } from "../booking/domain";
import type { CleaningStatus, StaffSessionLike } from "./contracts";
import { assertCleaningTransition } from "./contracts";

export async function getOperationsQueues(params: {
  propertyId: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  const db = getDatabase();
  const [cleaning, maintenance, lostFound, rooms] = await Promise.all([
    db
      .select()
      .from(cleaningTasks)
      .where(
        and(
          eq(cleaningTasks.propertyId, params.propertyId),
          ne(cleaningTasks.status, "CANCELLED"),
        ),
      ),
    db
      .select()
      .from(maintenanceIssues)
      .where(
        and(
          eq(maintenanceIssues.propertyId, params.propertyId),
          ne(maintenanceIssues.status, "CANCELLED"),
        ),
      ),
    db
      .select()
      .from(lostFoundItems)
      .where(
        and(
          eq(lostFoundItems.propertyId, params.propertyId),
          inArray(lostFoundItems.status, [
            "FOUND",
            "STORED",
            "CLAIM_PENDING",
            "CLAIMED",
          ]),
        ),
      ),
    db
      .select({ id: roomUnits.id, roomNumber: roomUnits.roomNumber })
      .from(roomUnits)
      .where(eq(roomUnits.propertyId, params.propertyId)),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    cleaning,
    maintenance,
    lostFound,
    rooms,
  };
}

export async function createCleaningTask(params: {
  propertyId: string;
  roomUnitId?: string;
  roomStayId?: string;
  publicArea?: string;
  taskType:
    | "CHECKOUT"
    | "STAYOVER"
    | "ROOM_MOVE"
    | "DEEP_CLEAN"
    | "PUBLIC_AREA"
    | "GUEST_REQUEST";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  entryPermission?: "GRANTED" | "NOT_GRANTED" | "ASK_FRONT_OFFICE";
  targetAt?: Date;
  notes?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  if (!params.roomUnitId && !params.publicArea)
    throw new AppError("VALIDATION_ERROR", "Cleaning target is required");
  return withIdempotency(
    {
      scope: "operations.cleaning.create",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      if (params.roomUnitId) {
        const [unit] = await tx
          .select({ id: roomUnits.id })
          .from(roomUnits)
          .where(
            and(
              eq(roomUnits.id, params.roomUnitId),
              eq(roomUnits.propertyId, params.propertyId),
            ),
          )
          .limit(1);
        if (!unit) throw new AppError("NOT_FOUND", "Room unit not found");
      }
      const [task] = await tx
        .insert(cleaningTasks)
        .values({
          propertyId: params.propertyId,
          roomUnitId: params.roomUnitId,
          roomStayId: params.roomStayId,
          publicArea: params.publicArea,
          taskType: params.taskType,
          priority: params.priority,
          status: "REQUESTED",
          targetAt: params.targetAt,
          requestedEntryPermission: params.entryPermission,
          notes: params.notes,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: cleaningTasks.id });
      if (!task) throw new Error("Failed to create cleaning task");
      await tx.insert(cleaningTaskEvents).values({
        cleaningTaskId: task.id,
        action: "CREATE",
        toStatus: "REQUESTED",
        reason: params.notes,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      if (params.roomUnitId)
        await tx
          .update(roomUnitStates)
          .set({
            housekeepingStatus: "DIRTY",
            changedAt: new Date(),
            updatedByUserId: params.session.user.id,
          })
          .where(eq(roomUnitStates.roomUnitId, params.roomUnitId));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "CLEANING_TASK_CREATED",
          targetType: "cleaning_task",
          targetId: task.id,
          after: {
            taskType: params.taskType,
            roomUnitId: params.roomUnitId,
            entryPermission: params.entryPermission,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "cleaning_task",
        resultId: task.id,
        response: { cleaningTaskId: task.id, status: "REQUESTED" },
      };
    },
  );
}

export async function transitionCleaningTask(params: {
  propertyId: string;
  cleaningTaskId: string;
  toStatus: CleaningStatus;
  assigneeEmployeeId?: string;
  reasonCode?:
    | "GUEST_DND"
    | "GUEST_AWAY_REQUEST"
    | "ACCESS_DENIED"
    | "OPERATIONAL"
    | "OTHER";
  reason?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  return withIdempotency(
    {
      scope: "operations.cleaning.transition",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [task] = await tx
        .select()
        .from(cleaningTasks)
        .where(
          and(
            eq(cleaningTasks.id, params.cleaningTaskId),
            eq(cleaningTasks.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!task) throw new AppError("NOT_FOUND", "Cleaning task not found");
      assertCleaningTransition(task.status as CleaningStatus, params.toStatus);
      if (
        ["DEFERRED", "UNABLE_TO_ACCESS"].includes(params.toStatus) &&
        (!params.reasonCode || !params.reason)
      )
        throw new AppError(
          "VALIDATION_ERROR",
          "Deferred or inaccessible tasks require a reason",
        );
      if (params.toStatus === "ASSIGNED" && !params.assigneeEmployeeId)
        throw new AppError(
          "VALIDATION_ERROR",
          "Assigned tasks require an assignee",
        );
      const now = new Date();
      await tx
        .update(cleaningTasks)
        .set({
          status: params.toStatus,
          assigneeEmployeeId:
            params.assigneeEmployeeId ?? task.assigneeEmployeeId,
          completedAt: params.toStatus === "CLEANED" ? now : task.completedAt,
          inspectedAt: params.toStatus === "INSPECTED" ? now : task.inspectedAt,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(cleaningTasks.id, task.id));
      await tx.insert(cleaningTaskEvents).values({
        cleaningTaskId: task.id,
        action: "TRANSITION",
        fromStatus: task.status,
        toStatus: params.toStatus,
        reasonCode: params.reasonCode,
        reason: params.reason,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      if (task.roomUnitId) {
        const mapped =
          params.toStatus === "IN_PROGRESS"
            ? "CLEANING"
            : params.toStatus === "CLEANED"
              ? "CLEANED"
              : params.toStatus === "INSPECTED"
                ? "INSPECTED"
                : null;
        if (mapped)
          await tx
            .update(roomUnitStates)
            .set({
              housekeepingStatus: mapped,
              changedAt: now,
              updatedByUserId: params.session.user.id,
            })
            .where(eq(roomUnitStates.roomUnitId, task.roomUnitId));
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "CLEANING_TASK_TRANSITIONED",
          targetType: "cleaning_task",
          targetId: task.id,
          before: { status: task.status },
          after: { status: params.toStatus, reasonCode: params.reasonCode },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "cleaning_task",
        resultId: task.id,
        response: { cleaningTaskId: task.id, status: params.toStatus },
      };
    },
  );
}

export async function updateRoomReadiness(params: {
  propertyId: string;
  roomUnitId: string;
  action: "START_CLEANING" | "MARK_READY" | "RETURN_TO_SERVICE";
  reason?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  if (
    params.action === "RETURN_TO_SERVICE" &&
    (params.reason?.trim().length ?? 0) < 3
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Alasan mengaktifkan kembali kamar wajib diisi",
    );
  return withIdempotency<{
    roomUnitId: string;
    cleaningTaskId: string | null;
    housekeepingStatus: string;
    serviceabilityStatus: string;
  }>(
    {
      scope: "operations.room.readiness",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [room] = await tx
        .select({
          id: roomUnits.id,
          occupancyStatus: roomUnitStates.occupancyStatus,
          housekeepingStatus: roomUnitStates.housekeepingStatus,
          serviceabilityStatus: roomUnitStates.serviceabilityStatus,
        })
        .from(roomUnits)
        .leftJoin(roomUnitStates, eq(roomUnitStates.roomUnitId, roomUnits.id))
        .where(
          and(
            eq(roomUnits.id, params.roomUnitId),
            eq(roomUnits.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update", { of: roomUnits });
      if (!room) throw new AppError("NOT_FOUND", "Kamar tidak ditemukan");
      const now = new Date();

      if (params.action === "RETURN_TO_SERVICE") {
        const [activeIssue] = await tx
          .select({ id: maintenanceIssues.id })
          .from(maintenanceIssues)
          .where(
            and(
              eq(maintenanceIssues.roomUnitId, room.id),
              inArray(maintenanceIssues.status, [
                "REPORTED",
                "TRIAGED",
                "IN_PROGRESS",
                "REOPENED",
              ]),
              ne(maintenanceIssues.serviceabilityImpact, "NONE"),
            ),
          )
          .limit(1);
        const [activeBlock] = await tx
          .select({ id: roomBlocks.id })
          .from(roomBlocks)
          .where(
            and(
              eq(roomBlocks.roomUnitId, room.id),
              eq(roomBlocks.status, "ACTIVE"),
            ),
          )
          .limit(1);
        if (activeIssue || activeBlock)
          throw new AppError(
            "CONFLICT",
            "Kamar masih memiliki maintenance atau blok aktif. Selesaikan terlebih dahulu.",
          );
        await tx
          .insert(roomUnitStates)
          .values({
            roomUnitId: room.id,
            occupancyStatus: room.occupancyStatus ?? "VACANT",
            housekeepingStatus: room.housekeepingStatus ?? "DIRTY",
            serviceabilityStatus: "IN_SERVICE",
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .onConflictDoUpdate({
            target: roomUnitStates.roomUnitId,
            set: {
              serviceabilityStatus: "IN_SERVICE",
              changedAt: now,
              updatedByUserId: params.session.user.id,
            },
          });
        await recordAuditEvent(
          {
            propertyId: params.propertyId,
            actorUserId: params.session.user.id,
            actorType: "user",
            action: "ROOM_RETURNED_TO_SERVICE",
            targetType: "room_unit",
            targetId: room.id,
            before: { serviceabilityStatus: room.serviceabilityStatus },
            after: { serviceabilityStatus: "IN_SERVICE" },
            reason: params.reason,
            result: "SUCCESS",
          },
          tx,
        );
        return {
          resultType: "room_unit",
          resultId: room.id,
          response: {
            roomUnitId: room.id,
            cleaningTaskId: null,
            serviceabilityStatus: "IN_SERVICE",
            housekeepingStatus: room.housekeepingStatus ?? "DIRTY",
          },
        };
      }

      if ((room.occupancyStatus ?? "VACANT") !== "VACANT")
        throw new AppError(
          "CONFLICT",
          "Kamar yang sedang ditempati tidak dapat diubah melalui aksi cepat",
        );
      if ((room.serviceabilityStatus ?? "IN_SERVICE") !== "IN_SERVICE")
        throw new AppError(
          "CONFLICT",
          "Aktifkan kembali kamar sebelum mengubah status kebersihan",
        );

      const [task] = await tx
        .select()
        .from(cleaningTasks)
        .where(
          and(
            eq(cleaningTasks.propertyId, params.propertyId),
            eq(cleaningTasks.roomUnitId, room.id),
            inArray(cleaningTasks.status, [
              "REQUESTED",
              "ASSIGNED",
              "IN_PROGRESS",
              "CLEANED",
              "DEFERRED",
              "UNABLE_TO_ACCESS",
            ]),
          ),
        )
        .orderBy(desc(cleaningTasks.createdAt))
        .limit(1)
        .for("update");
      const targetStatus =
        params.action === "START_CLEANING" ? "IN_PROGRESS" : "INSPECTED";
      let taskId = task?.id;
      if (task) {
        await tx
          .update(cleaningTasks)
          .set({
            status: targetStatus,
            completedAt:
              targetStatus === "INSPECTED" ? (task.completedAt ?? now) : null,
            inspectedAt: targetStatus === "INSPECTED" ? now : null,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(cleaningTasks.id, task.id));
        await tx.insert(cleaningTaskEvents).values({
          cleaningTaskId: task.id,
          action: targetStatus === "INSPECTED" ? "QUICK_READY" : "QUICK_START",
          fromStatus: task.status,
          toStatus: targetStatus,
          reason: params.reason,
          actorUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        });
      } else {
        const [created] = await tx
          .insert(cleaningTasks)
          .values({
            propertyId: params.propertyId,
            roomUnitId: room.id,
            taskType: "DEEP_CLEAN",
            priority: "NORMAL",
            status: targetStatus,
            requestedEntryPermission: "GRANTED",
            notes: "Aksi cepat kesiapan kamar",
            completedAt: targetStatus === "INSPECTED" ? now : null,
            inspectedAt: targetStatus === "INSPECTED" ? now : null,
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })
          .returning({ id: cleaningTasks.id });
        if (!created) throw new Error("Failed to create quick cleaning task");
        taskId = created.id;
        await tx.insert(cleaningTaskEvents).values({
          cleaningTaskId: created.id,
          action: targetStatus === "INSPECTED" ? "QUICK_READY" : "QUICK_START",
          toStatus: targetStatus,
          reason: params.reason,
          actorUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
        });
      }
      const housekeepingStatus =
        targetStatus === "INSPECTED" ? "INSPECTED" : "CLEANING";
      await tx
        .insert(roomUnitStates)
        .values({
          roomUnitId: room.id,
          occupancyStatus: "VACANT",
          housekeepingStatus,
          serviceabilityStatus: "IN_SERVICE",
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .onConflictDoUpdate({
          target: roomUnitStates.roomUnitId,
          set: {
            housekeepingStatus,
            changedAt: now,
            updatedByUserId: params.session.user.id,
          },
        });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action:
            targetStatus === "INSPECTED"
              ? "ROOM_MARKED_READY"
              : "ROOM_CLEANING_STARTED",
          targetType: "room_unit",
          targetId: room.id,
          before: { housekeepingStatus: room.housekeepingStatus },
          after: { housekeepingStatus },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "room_unit",
        resultId: room.id,
        response: {
          roomUnitId: room.id,
          cleaningTaskId: taskId ?? null,
          housekeepingStatus,
          serviceabilityStatus: "IN_SERVICE",
        },
      };
    },
  );
}

export async function generateDailyCleaningTasks(params: {
  propertyId: string;
  businessDate: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  return withIdempotency(
    {
      scope: "operations.cleaning.daily",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const generated = await tx.execute<{ id: string; taskType: string }>(sql`
      with candidates as (
        select distinct on (st.id)
          ${params.propertyId}::uuid as property_id, a.room_unit_id, st.id as room_stay_id,
          'STAYOVER'::text as task_type,
          'NORMAL'::text as priority
        from room_stays st
        join reservation_rooms rr on rr.id = st.reservation_room_id
        join reservations r on r.id = rr.reservation_id
        join room_assignments a on a.room_stay_id = st.id and a.status = 'ACTIVE'
        where r.property_id = ${params.propertyId}
          and st.status = 'IN_HOUSE'
          and st.actual_check_in_at is not null
          and (st.actual_check_in_at at time zone 'Asia/Jakarta')::date < ${params.businessDate}::date
          and rr.checkout_date > ${params.businessDate}::date
      )
      insert into cleaning_tasks
        (property_id, room_unit_id, room_stay_id, task_type, priority, status,
         target_at, requested_entry_permission, notes, created_by_user_id, updated_by_user_id)
      select property_id, room_unit_id, room_stay_id, task_type, priority, 'REQUESTED',
             (${params.businessDate}::date + time '09:00') at time zone 'Asia/Jakarta',
             'ASK_FRONT_OFFICE',
             'Generated by daily housekeeping run', ${params.session.user.id}, ${params.session.user.id}
      from candidates c
      where not exists (
        select 1 from cleaning_tasks existing
        where existing.room_stay_id = c.room_stay_id and existing.task_type = c.task_type
          and existing.target_at::date = ${params.businessDate}::date
          and existing.status <> 'CANCELLED'
      )
      returning id, task_type as "taskType"
    `);
      return {
        resultType: "cleaning_daily_run",
        response: {
          businessDate: params.businessDate,
          created: generated.rows.length,
          tasks: generated.rows,
        },
      };
    },
  );
}

export async function createMaintenanceIssue(params: {
  propertyId: string;
  roomUnitId?: string;
  publicArea?: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  serviceabilityImpact: "NONE" | "BLOCKED" | "OUT_OF_ORDER";
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  if (!params.roomUnitId && !params.publicArea)
    throw new AppError("VALIDATION_ERROR", "Maintenance target is required");
  return withIdempotency(
    {
      scope: "operations.maintenance.create",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [issue] = await tx
        .insert(maintenanceIssues)
        .values({
          propertyId: params.propertyId,
          roomUnitId: params.roomUnitId,
          publicArea: params.publicArea,
          category: params.category,
          severity: params.severity,
          status: "REPORTED",
          title: params.title,
          description: params.description,
          serviceabilityImpact: params.serviceabilityImpact,
          reportedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: maintenanceIssues.id });
      if (!issue) throw new Error("Failed to create maintenance issue");
      await tx.insert(maintenanceIssueEvents).values({
        maintenanceIssueId: issue.id,
        action: "REPORT",
        toStatus: "REPORTED",
        notes: params.description,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      if (params.roomUnitId && params.serviceabilityImpact !== "NONE")
        await tx
          .update(roomUnitStates)
          .set({
            serviceabilityStatus: params.serviceabilityImpact,
            changedAt: new Date(),
            updatedByUserId: params.session.user.id,
          })
          .where(eq(roomUnitStates.roomUnitId, params.roomUnitId));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "MAINTENANCE_REPORTED",
          targetType: "maintenance_issue",
          targetId: issue.id,
          after: {
            severity: params.severity,
            serviceabilityImpact: params.serviceabilityImpact,
            roomUnitId: params.roomUnitId,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "maintenance_issue",
        resultId: issue.id,
        response: { maintenanceIssueId: issue.id, status: "REPORTED" },
      };
    },
  );
}

export async function transitionMaintenanceIssue(params: {
  propertyId: string;
  maintenanceIssueId: string;
  toStatus:
    | "TRIAGED"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "VERIFIED"
    | "REOPENED"
    | "CANCELLED";
  notes: string;
  returnToService: boolean;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  return withIdempotency(
    {
      scope: "operations.maintenance.transition",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [issue] = await tx
        .select()
        .from(maintenanceIssues)
        .where(
          and(
            eq(maintenanceIssues.id, params.maintenanceIssueId),
            eq(maintenanceIssues.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (!issue)
        throw new AppError("NOT_FOUND", "Maintenance issue not found");
      if (params.returnToService && params.toStatus !== "VERIFIED")
        throw new AppError(
          "CONFLICT",
          "A room can return to service only after verification",
        );
      const now = new Date();
      await tx
        .update(maintenanceIssues)
        .set({
          status: params.toStatus,
          resolvedAt: params.toStatus === "RESOLVED" ? now : issue.resolvedAt,
          verifiedAt: params.toStatus === "VERIFIED" ? now : issue.verifiedAt,
          updatedByUserId: params.session.user.id,
        })
        .where(eq(maintenanceIssues.id, issue.id));
      await tx.insert(maintenanceIssueEvents).values({
        maintenanceIssueId: issue.id,
        action: params.returnToService
          ? "VERIFY_AND_RETURN_TO_SERVICE"
          : "TRANSITION",
        fromStatus: issue.status,
        toStatus: params.toStatus,
        notes: params.notes,
        actorUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      if (params.returnToService && issue.roomUnitId) {
        const active = await tx
          .select({ id: maintenanceIssues.id })
          .from(maintenanceIssues)
          .where(
            and(
              eq(maintenanceIssues.roomUnitId, issue.roomUnitId),
              ne(maintenanceIssues.id, issue.id),
              inArray(maintenanceIssues.status, [
                "REPORTED",
                "TRIAGED",
                "IN_PROGRESS",
                "REOPENED",
              ]),
              ne(maintenanceIssues.serviceabilityImpact, "NONE"),
            ),
          );
        if (active.length)
          throw new AppError(
            "CONFLICT",
            "Another active maintenance issue still blocks this room",
          );
        await tx
          .update(roomUnitStates)
          .set({
            serviceabilityStatus: "IN_SERVICE",
            changedAt: now,
            updatedByUserId: params.session.user.id,
          })
          .where(eq(roomUnitStates.roomUnitId, issue.roomUnitId));
      }
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "MAINTENANCE_TRANSITIONED",
          targetType: "maintenance_issue",
          targetId: issue.id,
          before: { status: issue.status },
          after: {
            status: params.toStatus,
            returnToService: params.returnToService,
          },
          reason: params.notes,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "maintenance_issue",
        resultId: issue.id,
        response: {
          maintenanceIssueId: issue.id,
          status: params.toStatus,
          returnedToService: params.returnToService,
        },
      };
    },
  );
}

export async function assessDamage(params: {
  propertyId: string;
  reservationId: string;
  roomStayId?: string;
  roomUnitId?: string;
  catalogVersionId?: string;
  description: string;
  decision: "APPROVED" | "WAIVED" | "DISPUTED";
  amountIdr: number;
  reason: string;
  serviceDate: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "payment.manage");
  return withIdempotency(
    {
      scope: "operations.damage.assess",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [reservation] = await tx
        .select({ id: reservations.id })
        .from(reservations)
        .where(
          and(
            eq(reservations.id, params.reservationId),
            eq(reservations.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!reservation)
        throw new AppError("NOT_FOUND", "Reservation not found");
      let taxProfileVersionId: string | null = null;
      let referencePriceIdr: number | null = null;
      if (params.catalogVersionId) {
        const [catalog] = await tx
          .select({
            taxProfileVersionId: damageCatalogVersions.taxProfileVersionId,
            referencePriceIdr: damageCatalogVersions.referencePriceIdr,
          })
          .from(damageCatalogVersions)
          .where(eq(damageCatalogVersions.id, params.catalogVersionId))
          .limit(1);
        if (!catalog)
          throw new AppError("NOT_FOUND", "Damage catalog version not found");
        taxProfileVersionId = catalog.taxProfileVersionId;
        referencePriceIdr = Number(catalog.referencePriceIdr);
      }
      const [incident] = await tx
        .insert(damageIncidents)
        .values({
          reservationId: params.reservationId,
          roomStayId: params.roomStayId,
          roomUnitId: params.roomUnitId,
          damageCatalogVersionId: params.catalogVersionId,
          status: params.decision,
          description: params.description,
          reportedByUserId: params.session.user.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: damageIncidents.id });
      if (!incident) throw new Error("Failed to record damage incident");
      let folioEntryId: string | null = null;
      if (params.decision === "APPROVED" && params.amountIdr > 0) {
        const [folio] = await tx
          .select({ id: folios.id })
          .from(folios)
          .where(eq(folios.reservationId, params.reservationId))
          .limit(1);
        if (!folio)
          throw new AppError("CONFLICT", "Reservation folio is missing");
        const [entry] = await tx
          .insert(folioEntries)
          .values({
            folioId: folio.id,
            entryType: "DEBIT",
            category: "DAMAGE",
            description: params.description,
            sourceType: "DAMAGE_INCIDENT",
            sourceId: incident.id,
            roomUnitId: params.roomUnitId,
            serviceDate: params.serviceDate,
            quantity: "1",
            unitAmountIdr: String(params.amountIdr),
            netAmountIdr: String(params.amountIdr),
            totalAmountIdr: String(params.amountIdr),
            taxProfileVersionId,
            pricingSnapshot: {
              referencePriceIdr,
              assessedAmountIdr: params.amountIdr,
              taxApplied: false,
              manuallyAssessed: true,
            },
            postedByUserId: params.session.user.id,
            idempotencyKey: `${params.idempotencyKey}:folio`,
            createdByUserId: params.session.user.id,
          })
          .returning({ id: folioEntries.id });
        folioEntryId = entry?.id ?? null;
      }
      const [assessment] = await tx
        .insert(damageAssessments)
        .values({
          incidentId: incident.id,
          decision: params.decision,
          amountIdr: String(params.amountIdr),
          reason: params.reason,
          priceTaxSnapshot: {
            referencePriceIdr,
            taxApplied: false,
            taxProfileVersionId,
          },
          decidedByUserId: params.session.user.id,
          decidedAt: new Date(),
          folioEntryId,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: damageAssessments.id });
      if (!assessment) throw new Error("Failed to record damage assessment");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "DAMAGE_ASSESSED",
          targetType: "damage_assessment",
          targetId: assessment.id,
          after: {
            incidentId: incident.id,
            decision: params.decision,
            amountIdr: params.amountIdr,
            referencePriceIdr,
            folioEntryId,
          },
          reason: params.reason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "damage_assessment",
        resultId: assessment.id,
        response: {
          damageIncidentId: incident.id,
          damageAssessmentId: assessment.id,
          folioEntryId,
          decision: params.decision,
        },
      };
    },
  );
}

export async function recordLostFoundItem(params: {
  propertyId: string;
  category: string;
  description: string;
  foundAt: Date;
  foundLocation: string;
  roomUnitId?: string;
  roomStayId?: string;
  reservationId?: string;
  storageLocation?: string;
  sealReference?: string;
  highValue: boolean;
  retentionDueAt?: Date;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "housekeeping.task.manage",
  );
  return withIdempotency(
    {
      scope: "operations.lost_found.record",
      key: params.idempotencyKey,
      requestHash: stableRequestHash(params),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const code = await tx.execute<{ code: string }>(
        sql`select concat('LF-', to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD'), '-', upper(substr(replace(uuidv7()::text, '-', ''), 1, 8))) as code`,
      );
      const itemCode = code.rows[0]?.code;
      if (!itemCode) throw new Error("Failed to generate lost-and-found code");
      const [item] = await tx
        .insert(lostFoundItems)
        .values({
          propertyId: params.propertyId,
          itemCode,
          category: params.category,
          description: params.description,
          foundAt: params.foundAt,
          foundLocation: params.foundLocation,
          roomUnitId: params.roomUnitId,
          roomStayId: params.roomStayId,
          reservationId: params.reservationId,
          status: params.storageLocation ? "STORED" : "FOUND",
          storageLocation: params.storageLocation,
          sealReference: params.sealReference,
          highValue: params.highValue ? "YES" : "NO",
          retentionDueAt: params.retentionDueAt,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: lostFoundItems.id });
      if (!item) throw new Error("Failed to record lost-and-found item");
      await tx.insert(lostFoundCustodyEvents).values({
        itemId: item.id,
        action: params.storageLocation ? "FOUND_AND_STORED" : "FOUND",
        toLocation: params.storageLocation ?? params.foundLocation,
        handedByUserId: params.session.user.id,
        receivedByUserId: params.session.user.id,
        createdByUserId: params.session.user.id,
      });
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "LOST_FOUND_RECORDED",
          targetType: "lost_found_item",
          targetId: item.id,
          after: {
            itemCode,
            category: params.category,
            roomUnitId: params.roomUnitId,
            highValue: params.highValue,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "lost_found_item",
        resultId: item.id,
        response: {
          lostFoundItemId: item.id,
          itemCode,
          status: params.storageLocation ? "STORED" : "FOUND",
        },
      };
    },
  );
}

export async function claimLostFoundItem(params: {
  propertyId: string;
  itemId: string;
  claimantName: string;
  claimantContact: string;
  verificationDetails: Record<string, unknown>;
  decision: "PENDING" | "VERIFIED" | "REJECTED";
  decisionReason?: string;
  idempotencyKey: string;
  session: StaffSessionLike;
}) {
  await requirePermission(params.session, params.propertyId, "stay.manage");
  return withIdempotency(
    {
      scope: "operations.lost_found.claim",
      key: params.idempotencyKey,
      requestHash: stableRequestHash({
        ...params,
        claimantContact: "[redacted]",
      }),
      ownerUserId: params.session.user.id,
    },
    async (tx) => {
      const [item] = await tx
        .select({ id: lostFoundItems.id, status: lostFoundItems.status })
        .from(lostFoundItems)
        .where(
          and(
            eq(lostFoundItems.id, params.itemId),
            eq(lostFoundItems.propertyId, params.propertyId),
          ),
        )
        .limit(1)
        .for("update");
      if (
        !item ||
        [
          "RETURNED",
          "SHIPPED",
          "DISPOSED",
          "TRANSFERRED_TO_AUTHORITY",
        ].includes(item.status)
      )
        throw new AppError("CONFLICT", "Item is not claimable");
      const [claim] = await tx
        .insert(lostFoundClaims)
        .values({
          itemId: item.id,
          claimantName: params.claimantName,
          claimantContactCiphertext: encryptSensitiveValue(
            params.claimantContact,
          ),
          verificationDetails: params.verificationDetails,
          status: params.decision,
          decisionReason: params.decisionReason,
          decidedByUserId:
            params.decision === "PENDING" ? null : params.session.user.id,
          decidedAt: params.decision === "PENDING" ? null : new Date(),
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: lostFoundClaims.id });
      if (!claim) throw new Error("Failed to record lost-and-found claim");
      await tx
        .update(lostFoundItems)
        .set({
          status: params.decision === "VERIFIED" ? "CLAIMED" : "CLAIM_PENDING",
          updatedByUserId: params.session.user.id,
        })
        .where(eq(lostFoundItems.id, item.id));
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "LOST_FOUND_CLAIM_RECORDED",
          targetType: "lost_found_claim",
          targetId: claim.id,
          after: {
            itemId: item.id,
            decision: params.decision,
            claimantName: params.claimantName,
          },
          reason: params.decisionReason,
          result: "SUCCESS",
        },
        tx,
      );
      return {
        resultType: "lost_found_claim",
        resultId: claim.id,
        response: {
          lostFoundClaimId: claim.id,
          itemStatus:
            params.decision === "VERIFIED" ? "CLAIMED" : "CLAIM_PENDING",
        },
      };
    },
  );
}
