import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    leftJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    set: () => link,
    values: () => link,
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
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    execute: mocks.execute,
    transaction: mocks.transaction,
  }),
}));
vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

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
  type RoomTypeDraftInput,
} from "../../src/modules/configuration/room-master";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const session = { user: { id: U1 } };

const draft: RoomTypeDraftInput = {
  code: "deluxe",
  nameId: "Deluxe",
  nameEn: "Deluxe",
  standardAdults: 2,
  maximumAdults: 2,
  maximumChildren: 1,
  maximumTotalGuests: 3,
  extraBedAllowed: true,
  maximumExtraBeds: 1,
  extraBedCapacityIncrement: 1,
  amenityIds: [U3],
  effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
  reason: "Create deluxe room type",
};

describe("room master service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.insert.mockReturnValue(chain());
    mocks.update.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.transaction.mockImplementation(
      async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          select: mocks.select,
          insert: mocks.insert,
          update: mocks.update,
          execute: mocks.execute,
        }),
    );
  });

  it("returns amenities, room types, physical units, and resource pools", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1, code: "WIFI" }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U2, code: "DELUXE" }]))
      .mockReturnValueOnce(chain([{ id: U3, roomNumber: "1" }]))
      .mockReturnValueOnce(chain([{ id: U1, code: "EXTRA_BED" }]));
    const result = await getRoomMasterOverview({ session, propertyId: U1 });
    expect(result.amenities).toHaveLength(1);
    expect(result.roomUnits[0]).toMatchObject({ roomNumber: "1" });
  });

  it("creates a bilingual amenity", async () => {
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain());
    const result = await createAmenity({
      session,
      propertyId: U1,
      code: " hot water ",
      nameId: "Air panas",
      nameEn: "Hot water",
      reason: "Add verified amenity",
    });
    expect(result.id).toBe(U3);
  });

  it("previews new room types and blocks unsafe capacity reductions", async () => {
    const fresh = await previewRoomTypeDraft({
      session,
      propertyId: U1,
      input: draft,
    });
    expect(fresh.severity).toBe("LOW");

    mocks.select.mockReturnValueOnce(
      chain([{ id: U1, adults: 3, children: 1, extraBedQuantity: 2 }]),
    );
    const impacted = await previewRoomTypeDraft({
      session,
      propertyId: U1,
      input: { ...draft, roomTypeId: U2 },
    });
    expect(impacted.severity).toBe("HIGH");
    expect(impacted.blockers).toHaveLength(1);
  });

  it("validates capacity combinations", async () => {
    await expect(
      previewRoomTypeDraft({
        session,
        propertyId: U1,
        input: { ...draft, extraBedAllowed: false, maximumExtraBeds: 1 },
      }),
    ).rejects.toThrow("Invalid room capacity values");
  });

  it("creates a versioned room type with owned amenities", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ versionNumber: 1 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain());
    const result = await createRoomTypeDraft({
      session,
      propertyId: U1,
      input: draft,
    });
    expect(result).toMatchObject({
      id: U1,
      versionNumber: 2,
      approvalStatus: "NOT_REQUIRED",
    });
  });

  it("reviews and publishes an approved room-type version", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          roomTypeId: U2,
          lifecycleStatus: "DRAFT",
          approvalStatus: "PENDING",
          effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
          effectiveTo: null,
          maximumAdults: 2,
          maximumTotalGuests: 3,
          maximumExtraBeds: 1,
        },
      ]),
    );
    const reviewed = await reviewRoomTypeVersion({
      session,
      propertyId: U1,
      versionId: U3,
      decision: "APPROVE",
      reason: "Capacity reviewed",
    });
    expect(reviewed.approvalStatus).toBe("APPROVED");

    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            roomTypeId: U2,
            lifecycleStatus: "DRAFT",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
            effectiveTo: null,
            maximumAdults: 2,
            maximumTotalGuests: 3,
            maximumExtraBeds: 1,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    const published = await publishRoomTypeVersion({
      session,
      propertyId: U1,
      versionId: U3,
      reason: "Publish reviewed type",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(published.lifecycleStatus).toBe("SCHEDULED");
  });

  it("creates a single-digit physical room and its initial state", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain());
    const result = await createRoomUnit({
      session,
      propertyId: U1,
      roomNumber: " 1 ",
      sortOrder: 1,
      roomTypeId: U2,
      effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
      reason: "Add physical room one",
    });
    expect(result.id).toBe(U3);
  });

  it("changes the effective room type while closing the prior period", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(
        chain([{ id: U3, effectiveFrom: new Date("2026-01-01") }]),
      );
    mocks.insert.mockReturnValueOnce(chain([{ id: U1 }]));
    const result = await changeRoomUnitType({
      session,
      propertyId: U1,
      roomUnitId: U1,
      roomTypeId: U2,
      effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
      reason: "Reclassify physical room",
    });
    expect(result.id).toBe(U1);
  });

  it("creates inventory-tracked extra-bed resources and validates capacity", async () => {
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createResourcePool({
      session,
      propertyId: U1,
      code: "extra bed",
      nameId: "Extra bed",
      nameEn: "Extra bed",
      physicalCapacity: 5,
      reason: "Configure extra bed stock",
    });
    expect(result.id).toBe(U3);
    await expect(
      createResourcePool({
        session,
        propertyId: U1,
        code: "invalid",
        nameId: "Invalid",
        nameEn: "Invalid",
        physicalCapacity: -1,
        reason: "Invalid capacity check",
      }),
    ).rejects.toThrow("non-negative integer");
  });

  it.each([
    ["AMENITY", U1],
    ["ROOM_TYPE", U2],
    ["ROOM_UNIT", U3],
    ["RESOURCE_POOL", U1],
  ] as const)(
    "archives an unused %s master safely",
    async (target, targetId) => {
      if (target === "ROOM_TYPE" || target === "ROOM_UNIT") {
        mocks.select
          .mockReturnValueOnce(
            chain([{ id: targetId, occupancyStatus: "VACANT" }]),
          )
          .mockReturnValueOnce(chain([]));
      } else {
        mocks.select.mockReturnValueOnce(chain([{ id: targetId }]));
      }
      const result = await archiveRoomMaster({
        session,
        propertyId: U1,
        target,
        targetId,
        reason: "Archive unused master",
      });
      expect(result.id).toBe(targetId);
    },
  );

  it("appends a lean version to an existing room type", async () => {
    mocks.select
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createRoomTypeDraft({
      session,
      propertyId: U1,
      input: {
        ...draft,
        roomTypeId: U2,
        amenityIds: [],
        extraBedAllowed: false,
        maximumExtraBeds: 0,
        extraBedCapacityIncrement: 0,
      },
    });
    expect(result).toMatchObject({ versionNumber: 1, id: U3 });
  });

  it("rejects a room-type version and publishes an immediate replacement", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          roomTypeId: U2,
          lifecycleStatus: "DRAFT",
          approvalStatus: "PENDING",
          effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
          effectiveTo: null,
        },
      ]),
    );
    const rejected = await reviewRoomTypeVersion({
      session,
      propertyId: U1,
      versionId: U3,
      decision: "REJECT",
      reason: "Capacity snapshot needs revision",
    });
    expect(rejected.approvalStatus).toBe("REJECTED");

    mocks.select.mockReset();
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            roomTypeId: U2,
            lifecycleStatus: "DRAFT",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      );
    const published = await publishRoomTypeVersion({
      session,
      propertyId: U1,
      versionId: U3,
      reason: "Replace active capacity",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(published.lifecycleStatus).toBe("ACTIVE");
  });

  it("creates an untracked resource and validates physical room numbers", async () => {
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const pool = await createResourcePool({
      session,
      propertyId: U1,
      code: "welcome drink",
      nameId: "Welcome drink",
      nameEn: "Welcome drink",
      physicalCapacity: 0,
      inventoryTracked: false,
      reason: "Add non-stock resource",
    });
    expect(pool.id).toBe(U3);
    await expect(
      createRoomUnit({
        session,
        propertyId: U1,
        roomNumber: "",
        sortOrder: 1,
        roomTypeId: U2,
        effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
        reason: "Validate empty room number",
      }),
    ).rejects.toThrow("1-32 characters");
  });

  it("creates the first room-type period without closing an earlier one", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await changeRoomUnitType({
      session,
      propertyId: U1,
      roomUnitId: U1,
      roomTypeId: U2,
      effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
      reason: "Create initial type period",
    });
    expect(result.id).toBe(U3);
  });

  it("prevents archiving occupied rooms and assigned room types", async () => {
    mocks.select.mockReturnValueOnce(
      chain([{ id: U3, occupancyStatus: "OCCUPIED" }]),
    );
    await expect(
      archiveRoomMaster({
        session,
        propertyId: U1,
        target: "ROOM_UNIT",
        targetId: U3,
        reason: "Archive occupied room check",
      }),
    ).rejects.toThrow("occupied room");

    mocks.select.mockReset();
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U1 }]));
    await expect(
      archiveRoomMaster({
        session,
        propertyId: U1,
        target: "ROOM_TYPE",
        targetId: U2,
        reason: "Archive assigned type check",
      }),
    ).rejects.toThrow("active or future reservation");
  });
});
