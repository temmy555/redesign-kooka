import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    leftJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
    set: () => link,
    values: () => link,
    onConflictDoUpdate: () => link,
    returning: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  encryptSensitiveValue: vi.fn(),
  withIdempotency: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ select: mocks.select }),
}));
vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/encryption", () => ({
  encryptSensitiveValue: mocks.encryptSensitiveValue,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

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
} from "../../src/modules/operations/property-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const session = { user: { id: U1 } };

describe("property operations service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.encryptSensitiveValue.mockReturnValue("encrypted-contact");
    mocks.update.mockReturnValue(chain());
    mocks.insert.mockReturnValue(chain());
    mocks.withIdempotency.mockImplementation(
      async (_options: unknown, run: (tx: unknown) => Promise<unknown>) => {
        const result = (await run({
          select: mocks.select,
          insert: mocks.insert,
          update: mocks.update,
          execute: mocks.execute,
        })) as { response: unknown };
        return result.response;
      },
    );
  });

  it("returns cleaning, maintenance, and lost-found queues", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1, status: "REQUESTED" }]))
      .mockReturnValueOnce(chain([{ id: U2, status: "REPORTED" }]))
      .mockReturnValueOnce(chain([{ id: U3, status: "STORED" }]))
      .mockReturnValueOnce(chain([{ id: U4, roomNumber: "4" }]));
    const queues = await getOperationsQueues({ propertyId: U1, session });
    expect(queues.cleaning).toHaveLength(1);
    expect(queues.maintenance).toHaveLength(1);
    expect(queues.lostFound).toHaveLength(1);
    expect(queues.rooms).toEqual([{ id: U4, roomNumber: "4" }]);
  });

  it("creates a guest-away cleaning request and dirties readiness", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());
    const result = await createCleaningTask({
      propertyId: U1,
      roomUnitId: U2,
      roomStayId: U4,
      taskType: "GUEST_REQUEST",
      priority: "NORMAL",
      entryPermission: "GRANTED",
      notes: "Guest is away and requested room cleaning",
      idempotencyKey: "cleaning-create-1",
      session,
    });
    expect(result).toMatchObject({ cleaningTaskId: U3, status: "REQUESTED" });
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it("moves cleaning from requested to in-progress and updates room state", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U2,
          propertyId: U1,
          roomUnitId: U3,
          status: "REQUESTED",
          assigneeEmployeeId: null,
          completedAt: null,
          inspectedAt: null,
        },
      ]),
    );
    const result = await transitionCleaningTask({
      propertyId: U1,
      cleaningTaskId: U2,
      toStatus: "IN_PROGRESS",
      reasonCode: "GUEST_AWAY_REQUEST",
      reason: "Guest gave entry permission",
      idempotencyKey: "cleaning-transition-1",
      session,
    });
    expect(result.status).toBe("IN_PROGRESS");
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("starts room cleaning with one simple action", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            occupancyStatus: "VACANT",
            housekeepingStatus: "DIRTY",
            serviceabilityStatus: "IN_SERVICE",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            status: "REQUESTED",
            completedAt: null,
          },
        ]),
      );

    const result = await updateRoomReadiness({
      propertyId: U1,
      roomUnitId: U2,
      action: "START_CLEANING",
      idempotencyKey: "room-cleaning-start-1",
      session,
    });

    expect(result).toMatchObject({
      roomUnitId: U2,
      cleaningTaskId: U3,
      housekeepingStatus: "CLEANING",
      serviceabilityStatus: "IN_SERVICE",
    });
  });

  it("finishes cleaning and marks a vacant room ready", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            occupancyStatus: "VACANT",
            housekeepingStatus: "CLEANING",
            serviceabilityStatus: "IN_SERVICE",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            status: "IN_PROGRESS",
            completedAt: null,
          },
        ]),
      );

    const result = await updateRoomReadiness({
      propertyId: U1,
      roomUnitId: U2,
      action: "MARK_READY",
      idempotencyKey: "room-ready-1",
      session,
    });

    expect(result).toMatchObject({
      roomUnitId: U2,
      cleaningTaskId: U3,
      housekeepingStatus: "INSPECTED",
      serviceabilityStatus: "IN_SERVICE",
    });
  });

  it("returns an unblocked room to service with a recorded reason", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            occupancyStatus: "VACANT",
            housekeepingStatus: "INSPECTED",
            serviceabilityStatus: "BLOCKED",
          },
        ]),
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));

    const result = await updateRoomReadiness({
      propertyId: U1,
      roomUnitId: U2,
      action: "RETURN_TO_SERVICE",
      reason: "Maintenance lama sudah selesai",
      idempotencyKey: "room-return-service-1",
      session,
    });

    expect(result).toMatchObject({
      roomUnitId: U2,
      cleaningTaskId: null,
      housekeepingStatus: "INSPECTED",
      serviceabilityStatus: "IN_SERVICE",
    });
  });

  it("generates idempotent stayover tasks only after a completed night", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ id: U2, taskType: "STAYOVER" }],
    });
    const result = await generateDailyCleaningTasks({
      propertyId: U1,
      businessDate: "2026-08-03",
      idempotencyKey: "daily-cleaning-1",
      session,
    });
    expect(result.created).toBe(1);
  });

  it("reports maintenance and immediately blocks serviceability", async () => {
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());
    const result = await createMaintenanceIssue({
      propertyId: U1,
      roomUnitId: U3,
      category: "AIR_CONDITIONING",
      severity: "HIGH",
      title: "AC not cooling",
      description: "Inspection required before next arrival",
      serviceabilityImpact: "BLOCKED",
      idempotencyKey: "maintenance-create-1",
      session,
    });
    expect(result.status).toBe("REPORTED");
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it("returns a verified room to service only when no blocker remains", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U2,
            propertyId: U1,
            roomUnitId: U3,
            status: "RESOLVED",
            resolvedAt: new Date(),
            verifiedAt: null,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    const result = await transitionMaintenanceIssue({
      propertyId: U1,
      maintenanceIssueId: U2,
      toStatus: "VERIFIED",
      notes: "Repair inspected successfully",
      returnToService: true,
      idempotencyKey: "maintenance-verify-1",
      session,
    });
    expect(result.returnedToService).toBe(true);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("assesses approved damage and posts the manual amount to the folio", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(
        chain([{ taxProfileVersionId: null, referencePriceIdr: "150000" }]),
      )
      .mockReturnValueOnce(chain([{ id: U2 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain([{ id: U1 }]));
    const result = await assessDamage({
      propertyId: U1,
      reservationId: U1,
      roomStayId: U2,
      roomUnitId: U3,
      catalogVersionId: U4,
      description: "Broken bedside lamp",
      decision: "APPROVED",
      amountIdr: 150000,
      reason: "Damage verified during departure clearance",
      serviceDate: "2026-08-03",
      idempotencyKey: "damage-1",
      session,
    });
    expect(result).toMatchObject({
      damageIncidentId: U3,
      folioEntryId: U4,
      decision: "APPROVED",
    });
  });

  it("records a stored lost item with initial custody", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ code: "LF-260802-ABC" }] });
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());
    const result = await recordLostFoundItem({
      propertyId: U1,
      category: "ELECTRONICS",
      description: "Black phone charger",
      foundAt: new Date("2026-08-03T05:00:00.000Z"),
      foundLocation: "Room 1",
      roomUnitId: U3,
      storageLocation: "Front Office Locker A",
      highValue: false,
      idempotencyKey: "lost-found-1",
      session,
    });
    expect(result).toMatchObject({
      lostFoundItemId: U2,
      itemCode: "LF-260802-ABC",
      status: "STORED",
    });
  });

  it("verifies a lost-found claimant while encrypting contact details", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2, status: "STORED" }]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await claimLostFoundItem({
      propertyId: U1,
      itemId: U2,
      claimantName: "Budi Santoso",
      claimantContact: "+628123456789",
      verificationDetails: { bookingCodeLast4: "ABCD" },
      decision: "VERIFIED",
      decisionReason: "Booking and description matched",
      idempotencyKey: "lost-found-claim-1",
      session,
    });
    expect(result.itemStatus).toBe("CLAIMED");
    expect(mocks.encryptSensitiveValue).toHaveBeenCalledWith("+628123456789");
  });

  it("creates public-area cleaning without changing a room state", async () => {
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());
    const result = await createCleaningTask({
      propertyId: U1,
      publicArea: "Tropical courtyard",
      taskType: "PUBLIC_AREA",
      priority: "LOW",
      idempotencyKey: "cleaning-public-area",
      session,
    });
    expect(result.status).toBe("REQUESTED");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    ["REQUESTED", "ASSIGNED", U4],
    ["REQUESTED", "DEFERRED", undefined],
    ["IN_PROGRESS", "CLEANED", undefined],
    ["CLEANED", "INSPECTED", undefined],
  ] as const)(
    "transitions cleaning from %s to %s",
    async (from, to, assignee) => {
      mocks.select.mockReturnValueOnce(
        chain([
          {
            id: U2,
            propertyId: U1,
            roomUnitId: U3,
            status: from,
            assigneeEmployeeId: null,
            completedAt: null,
            inspectedAt: null,
          },
        ]),
      );
      const result = await transitionCleaningTask({
        propertyId: U1,
        cleaningTaskId: U2,
        toStatus: to,
        assigneeEmployeeId: assignee,
        reasonCode: to === "DEFERRED" ? "GUEST_DND" : undefined,
        reason: to === "DEFERRED" ? "Do not disturb sign present" : undefined,
        idempotencyKey: `cleaning-${to}`,
        session,
      });
      expect(result.status).toBe(to);
    },
  );

  it("requires an assignee or deferral reason when applicable", async () => {
    mocks.select.mockReturnValueOnce(
      chain([{ id: U2, status: "REQUESTED", roomUnitId: U3 }]),
    );
    await expect(
      transitionCleaningTask({
        propertyId: U1,
        cleaningTaskId: U2,
        toStatus: "ASSIGNED",
        idempotencyKey: "cleaning-no-assignee",
        session,
      }),
    ).rejects.toThrow("require an assignee");

    mocks.select.mockReturnValueOnce(
      chain([{ id: U2, status: "REQUESTED", roomUnitId: U3 }]),
    );
    await expect(
      transitionCleaningTask({
        propertyId: U1,
        cleaningTaskId: U2,
        toStatus: "UNABLE_TO_ACCESS",
        idempotencyKey: "cleaning-no-reason",
        session,
      }),
    ).rejects.toThrow("require a reason");
  });

  it("records public-area maintenance with no serviceability impact", async () => {
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());
    const result = await createMaintenanceIssue({
      propertyId: U1,
      publicArea: "Lobby",
      category: "LIGHTING",
      severity: "LOW",
      title: "Lamp replacement",
      description: "One decorative lamp is out",
      serviceabilityImpact: "NONE",
      idempotencyKey: "maintenance-public",
      session,
    });
    expect(result.status).toBe("REPORTED");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("transitions maintenance without returning a room to service", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U2,
          propertyId: U1,
          roomUnitId: null,
          status: "IN_PROGRESS",
          resolvedAt: null,
          verifiedAt: null,
        },
      ]),
    );
    const result = await transitionMaintenanceIssue({
      propertyId: U1,
      maintenanceIssueId: U2,
      toStatus: "RESOLVED",
      notes: "Public area repair completed",
      returnToService: false,
      idempotencyKey: "maintenance-resolve",
      session,
    });
    expect(result.returnedToService).toBe(false);
  });

  it("records waived damage without posting a folio charge", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U1 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]));
    const result = await assessDamage({
      propertyId: U1,
      reservationId: U1,
      description: "Minor glass scratch",
      decision: "WAIVED",
      amountIdr: 0,
      reason: "Normal wear and tear",
      serviceDate: "2026-08-03",
      idempotencyKey: "damage-waived",
      session,
    });
    expect(result).toMatchObject({ decision: "WAIVED", folioEntryId: null });
  });

  it("records a high-value found item before storage", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ code: "LF-260802-HIGH" }] });
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());
    const result = await recordLostFoundItem({
      propertyId: U1,
      category: "JEWELRY",
      description: "Silver ring",
      foundAt: new Date("2026-08-03T05:00:00.000Z"),
      foundLocation: "Courtyard",
      highValue: true,
      idempotencyKey: "lost-found-high",
      session,
    });
    expect(result.status).toBe("FOUND");
  });

  it.each(["PENDING", "REJECTED"] as const)(
    "records a %s lost-found claim without marking the item claimed",
    async (decision) => {
      mocks.select.mockReturnValueOnce(chain([{ id: U2, status: "STORED" }]));
      mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
      const result = await claimLostFoundItem({
        propertyId: U1,
        itemId: U2,
        claimantName: "Claimant",
        claimantContact: "+62812",
        verificationDetails: {},
        decision,
        decisionReason:
          decision === "REJECTED" ? "Details mismatch" : undefined,
        idempotencyKey: `lost-found-${decision}`,
        session,
      });
      expect(result.itemStatus).toBe("CLAIM_PENDING");
    },
  );
});
