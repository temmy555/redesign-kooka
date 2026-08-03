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
    returning: () => link,
    onConflictDoUpdate: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  hasPermission: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  withIdempotency: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({ execute: mocks.execute }),
}));
vi.mock("../../src/platform/authorization", () => ({
  hasPermission: mocks.hasPermission,
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/idempotency", () => ({
  withIdempotency: mocks.withIdempotency,
}));

import {
  assignRoom,
  blockRoom,
  getRoomBoard,
  moveRoom,
} from "../../src/modules/operations/room-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const U4 = "44444444-4444-4444-a444-444444444444";
const session = { user: { id: U1 } };

describe("room service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.update.mockReturnValue(chain());
    mocks.insert.mockReturnValue(chain());
    mocks.withIdempotency.mockImplementation(
      async (_options: unknown, run: (tx: unknown) => Promise<unknown>) => {
        const result = (await run({
          select: mocks.select,
          insert: mocks.insert,
          update: mocks.update,
        })) as { response: unknown };
        return result.response;
      },
    );
  });

  it("returns every room and masks shared-display guest data", async () => {
    mocks.execute.mockResolvedValue({
      rows: [
        {
          roomUnitId: U1,
          roomNumber: "1",
          roomTypeId: U2,
          occupancyStatus: "OCCUPIED",
          housekeepingStatus: "INSPECTED",
          serviceabilityStatus: "IN_SERVICE",
          assignmentId: U3,
          roomStayId: U4,
          stayStatus: "IN_HOUSE",
          bookingCode: "KR-260802-ABCDEFGH",
          guestName: "Budi Santoso",
          nextArrivalAt: null,
          updatedAt: new Date(),
        },
      ],
    });

    const board = await getRoomBoard({
      propertyId: U1,
      session,
      sharedDisplay: true,
    });
    expect(board.rooms[0]).toMatchObject({
      guestName: "B*** S***",
      bookingCode: "EFGH",
    });
  });

  it("forces privacy masking when a room-board viewer cannot manage stays", async () => {
    mocks.hasPermission.mockResolvedValue(false);
    mocks.execute.mockResolvedValue({
      rows: [
        {
          roomUnitId: U1,
          roomNumber: "1",
          roomTypeId: U2,
          occupancyStatus: "OCCUPIED",
          housekeepingStatus: "INSPECTED",
          serviceabilityStatus: "IN_SERVICE",
          assignmentId: U3,
          roomStayId: U4,
          stayStatus: "IN_HOUSE",
          bookingCode: "KR-260802-ABCDEFGH",
          guestName: "Budi Santoso",
          nextArrivalAt: null,
          updatedAt: new Date(),
        },
      ],
    });

    const board = await getRoomBoard({
      propertyId: U1,
      session,
      sharedDisplay: false,
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      session,
      U1,
      "room.board.view",
    );
    expect(board).toMatchObject({
      sharedDisplay: true,
      rooms: [{ guestName: "B*** S***", bookingCode: "EFGH" }],
    });
  });

  it("assigns a compatible physical room and claims every stay night", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            checkInDate: "2026-08-03",
            checkoutDate: "2026-08-04",
            reservationId: U2,
            status: "CONFIRMED",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            reservationRoomId: U1,
            status: "DUE_IN",
            plannedArrivalAt: new Date("2026-08-03T07:00:00.000Z"),
            plannedDepartureAt: new Date("2026-08-04T05:00:00.000Z"),
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U4, serviceability: "IN_SERVICE" }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U2 }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U2 }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain());

    const result = await assignRoom({
      propertyId: U1,
      reservationRoomId: U1,
      roomUnitId: U4,
      reason: "Arrival allocation",
      idempotencyKey: "assign-1",
      session,
    });
    expect(result).toMatchObject({ assignmentId: U4, roomStayId: U3 });
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("rejects assignment when the physical room type is incompatible", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            checkInDate: "2026-08-03",
            checkoutDate: "2026-08-04",
            reservationId: U2,
            status: "CONFIRMED",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            reservationRoomId: U1,
            status: "DUE_IN",
            plannedArrivalAt: new Date(),
            plannedDepartureAt: new Date(Date.now() + 86_400_000),
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U4, serviceability: "IN_SERVICE" }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U3 }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U2 }]));

    await expect(
      assignRoom({
        propertyId: U1,
        reservationRoomId: U1,
        roomUnitId: U4,
        reason: "Arrival allocation",
        idempotencyKey: "assign-wrong-type",
        session,
      }),
    ).rejects.toThrow("does not match");
  });

  it("blocks a room for maintenance and creates physical night claims", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain());

    const result = await blockRoom({
      propertyId: U1,
      roomUnitId: U2,
      blockType: "MAINTENANCE",
      startsOn: "2026-08-03",
      endsOn: "2026-08-04",
      reason: "Air conditioner repair",
      idempotencyKey: "block-1",
      session,
    });
    expect(result).toMatchObject({
      roomBlockId: U3,
      status: "ACTIVE",
      nights: 1,
    });
  });

  it("moves a room without charge and dirties the vacated room", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            assignmentId: U1,
            fromUnitId: U2,
            reservationRoomId: U3,
            status: "IN_HOUSE",
            effectiveFrom: new Date("2026-08-02T14:00:00+07:00"),
            checkoutDate: "2026-08-04",
            reservationId: U4,
            roomTypeId: U3,
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U4, serviceability: "IN_SERVICE" }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U3 }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: U1, claimId: U2 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain());

    const result = await moveRoom({
      propertyId: U1,
      roomStayId: U3,
      toRoomUnitId: U4,
      effectiveOn: "2026-08-03",
      reason: "Guest requested quieter room",
      priceTreatment: "NO_CHANGE",
      priceAdjustmentIdr: 0,
      incidentalNoCharge: true,
      idempotencyKey: "move-1",
      session,
    });
    expect(result).toMatchObject({ roomMoveId: U2, toAssignmentId: U4 });
    expect(mocks.update).toHaveBeenCalled();
  });

  it("returns an unmasked operational room board", async () => {
    mocks.execute.mockResolvedValue({
      rows: [
        {
          roomUnitId: U1,
          roomNumber: "2",
          roomTypeId: U2,
          occupancyStatus: "VACANT",
          housekeepingStatus: "CLEANED",
          serviceabilityStatus: null,
          assignmentId: null,
          roomStayId: null,
          stayStatus: null,
          bookingCode: null,
          guestName: null,
          nextArrivalAt: null,
          updatedAt: new Date(),
        },
      ],
    });
    const board = await getRoomBoard({
      propertyId: U1,
      session,
      sharedDisplay: false,
    });
    expect(board.rooms[0]).toMatchObject({
      roomNumber: "2",
      serviceabilityStatus: null,
      guestName: null,
    });
  });

  it("marks an out-of-order physical room distinctly", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain());
    const result = await blockRoom({
      propertyId: U1,
      roomUnitId: U2,
      blockType: "OUT_OF_ORDER",
      startsOn: "2026-08-03",
      endsOn: "2026-08-04",
      reason: "Major plumbing repair",
      sourceType: "MAINTENANCE_ISSUE",
      sourceId: U4,
      idempotencyKey: "block-out-of-order",
      session,
    });
    expect(result.nights).toBe(1);
  });

  it("moves a due-in stay with a charge adjustment", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            assignmentId: U1,
            fromUnitId: U2,
            reservationRoomId: U3,
            status: "DUE_IN",
            effectiveFrom: new Date("2026-08-03T14:00:00+07:00"),
            checkoutDate: "2026-08-04",
            reservationId: U4,
            roomTypeId: U3,
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ id: U4, serviceability: null }]))
      .mockReturnValueOnce(chain([{ roomTypeId: U3 }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: U1 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U4 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain());
    const result = await moveRoom({
      propertyId: U1,
      roomStayId: U3,
      toRoomUnitId: U4,
      effectiveOn: "2026-08-03",
      reason: "Paid pre-arrival room preference",
      priceTreatment: "CHARGE",
      priceAdjustmentIdr: 100000,
      incidentalNoCharge: false,
      idempotencyKey: "move-charge",
      session,
    });
    expect(result.roomMoveId).toBe(U2);
    expect(mocks.insert).toHaveBeenCalledTimes(7);
  });
});
