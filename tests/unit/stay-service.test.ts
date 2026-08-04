import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    leftJoin: () => link,
    where: () => link,
    limit: () => link,
    for: () => link,
    set: () => link,
    values: () => link,
    returning: () => link,
    onConflictDoNothing: () => link,
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
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  encryptSensitiveValue: vi.fn(),
  withIdempotency: vi.fn(),
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
  decideStayTiming,
  recordCheckinCapture,
  transitionStay,
} from "../../src/modules/operations/stay-service";
import { folios, reservations } from "../../src/db/schema";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const session = { user: { id: U1 } };

function current(status: string) {
  return {
    status,
    reservationRoomId: U2,
    reservationId: U3,
    reservationStatus: "CONFIRMED",
  };
}

const assignment = {
  id: U2,
  roomUnitId: U3,
  effectiveFrom: new Date("2026-08-04T14:00:00+07:00"),
  housekeepingStatus: "INSPECTED",
  serviceabilityStatus: "IN_SERVICE",
};

describe("stay service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.encryptSensitiveValue.mockImplementation(
      (value: string) => `encrypted:${value}`,
    );
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
    mocks.update.mockReturnValue(chain());
    mocks.insert.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [{ count: "0" }] });
  });

  it("checks in without an early or late arrival cutoff and activates occupancy", async () => {
    const setStay = vi.fn(() => chain());
    const setAssignment = vi.fn(() => chain());
    mocks.update
      .mockReturnValueOnce({ ...chain(), set: setStay })
      .mockReturnValueOnce({ ...chain(), set: setAssignment })
      .mockReturnValue(chain());
    mocks.select
      .mockReturnValueOnce(chain([current("DUE_IN")]))
      .mockReturnValueOnce(chain([assignment]));

    const result = await transitionStay({
      propertyId: U1,
      roomStayId: U2,
      action: "CHECK_IN",
      reason: "Guest arrived at front office",
      idempotencyKey: "check-in-1",
      session,
    });

    expect(result.status).toBe("IN_HOUSE");
    expect(setStay).toHaveBeenCalledWith(
      expect.objectContaining({ chargePrivilege: "ALLOWED" }),
    );
    expect(setAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        effectiveFrom: expect.any(Date),
      }),
    );
    expect(mocks.update).toHaveBeenCalledTimes(3);
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          arrivalPolicy: "FLEXIBLE_FRONT_OFFICE",
          arrivalTimeCutoffEnforced: false,
        }),
      }),
      expect.anything(),
    );
  });

  it("requires an explicit reason for a readiness override", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("DUE_IN")]))
      .mockReturnValueOnce(
        chain([
          {
            ...assignment,
            housekeepingStatus: "DIRTY",
            serviceabilityStatus: "BLOCKED",
          },
        ]),
      );

    await expect(
      transitionStay({
        propertyId: U1,
        roomStayId: U2,
        action: "CHECK_IN",
        reason: "no",
        overrideReadiness: true,
        idempotencyKey: "check-in-override",
        session,
      }),
    ).rejects.toThrow("requires a reason");
  });

  it("checks out a settled folio, creates turnover cleaning, and completes reservation", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("IN_HOUSE")]))
      .mockReturnValueOnce(chain([assignment]))
      .mockReturnValueOnce(chain([{ id: U1, claimId: U2 }]));
    mocks.execute
      .mockResolvedValueOnce({
        rows: [{ folioId: U1, folioStatus: "OPEN", balanceIdr: "0" }],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const result = await transitionStay({
      propertyId: U1,
      roomStayId: U2,
      action: "CHECK_OUT",
      reason: "Guest departed; outstanding folio will be followed up",
      departureOutcome: "SKIPPED",
      idempotencyKey: "checkout-1",
      session,
    });

    expect(result.status).toBe("CHECKED_OUT");
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it("keeps the booking and tagihan open after only one multi-room line checks out", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("IN_HOUSE")]))
      .mockReturnValueOnce(chain([assignment]))
      .mockReturnValueOnce(chain([{ id: U1, claimId: U2 }]));
    mocks.execute
      .mockResolvedValueOnce({
        rows: [{ folioId: U1, folioStatus: "OPEN", balanceIdr: "0" }],
      })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] });

    const result = await transitionStay({
      propertyId: U1,
      roomStayId: U2,
      action: "CHECK_OUT",
      reason: "One room departed; the second room remains in house",
      departureOutcome: "CLEARED",
      idempotencyKey: "checkout-multi-room-partial",
      session,
    });

    expect(result.status).toBe("CHECKED_OUT");
    expect(mocks.update).not.toHaveBeenCalledWith(reservations);
    expect(mocks.update).not.toHaveBeenCalledWith(folios);
  });

  it("blocks checkout while room charges remain unpaid", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("IN_HOUSE")]))
      .mockReturnValueOnce(chain([assignment]));
    mocks.execute.mockResolvedValueOnce({
      rows: [{ folioId: U1, folioStatus: "OPEN", balanceIdr: "120000.00" }],
    });

    await expect(
      transitionStay({
        propertyId: U1,
        roomStayId: U2,
        action: "CHECK_OUT",
        reason: "Guest wants to leave",
        departureOutcome: "CLEARED",
        idempotencyKey: "checkout-unpaid",
        session,
      }),
    ).rejects.toThrow("120.000");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("retains a guaranteed no-show room until explicit release", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("DUE_IN")]))
      .mockReturnValueOnce(chain([assignment]));

    const noShow = await transitionStay({
      propertyId: U1,
      roomStayId: U2,
      action: "MARK_NO_SHOW",
      reason: "Front Office recorded no-show after contacting the guest",
      idempotencyKey: "no-show-1",
      session,
    });
    expect(noShow).toMatchObject({ status: "NO_SHOW", roomRetained: true });

    mocks.select
      .mockReturnValueOnce(chain([current("NO_SHOW")]))
      .mockReturnValueOnce(chain([assignment]))
      .mockReturnValueOnce(chain([{ id: U1, claimId: U3 }]));
    const released = await transitionStay({
      propertyId: U1,
      roomStayId: U2,
      action: "RELEASE_NO_SHOW",
      reason: "Front Office approved room release",
      idempotencyKey: "no-show-release-1",
      session,
    });
    expect(released.roomRetained).toBe(false);
  });

  it("records optional identity capture with encrypted identity values", async () => {
    mocks.select.mockReturnValueOnce(
      chain([{ roomStayId: U2, bookerGuestId: U3 }]),
    );
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());

    const result = await recordCheckinCapture({
      propertyId: U1,
      roomStayId: U2,
      guestId: U3,
      captureType: "IDENTITY_DOCUMENT",
      outcome: "CAPTURED",
      fileId: U1,
      reason: "Guest consented",
      identity: {
        type: "KTP",
        number: "3578000012345678",
        nameOnIdentity: "Budi Santoso",
      },
      idempotencyKey: "capture-1",
      session,
    });

    expect(result.outcome).toBe("CAPTURED");
    expect(mocks.encryptSensitiveValue).toHaveBeenCalled();
  });

  it("creates a stay and saves registration before room allocation", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          roomStayId: null,
          reservationRoomId: U2,
          reservationId: U3,
          reservationStatus: "CONFIRMED",
          checkInDate: "2026-08-03",
          checkoutDate: "2026-08-04",
          bookerGuestId: U3,
        },
      ]),
    );
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());

    const result = await recordCheckinCapture({
      propertyId: U1,
      reservationRoomId: U2,
      captureType: "IDENTITY_DOCUMENT",
      outcome: "CAPTURED",
      fileId: U1,
      identity: { type: "KTP", number: "3578000012345678" },
      idempotencyKey: "capture-before-allocation",
      session,
    });

    expect(result).toMatchObject({ roomStayId: U2, outcome: "CAPTURED" });
    expect(mocks.encryptSensitiveValue).toHaveBeenCalled();
  });

  it("rejects captured evidence without a private stored file", async () => {
    await expect(
      recordCheckinCapture({
        propertyId: U1,
        roomStayId: U2,
        captureType: "SIGNATURE",
        outcome: "CAPTURED",
        idempotencyKey: "capture-missing-file",
        session,
      }),
    ).rejects.toThrow("require a stored file");
  });

  it("records early and late timing decisions", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2, status: "DUE_IN" }]));
    const early = await decideStayTiming({
      propertyId: U1,
      roomStayId: U2,
      decision: "APPROVE_EARLY_CHECKIN",
      reason: "Room already inspected",
      idempotencyKey: "early-1",
      session,
    });
    expect(early.decision).toBe("APPROVE_EARLY_CHECKIN");

    mocks.select.mockReturnValueOnce(chain([{ id: U2, status: "IN_HOUSE" }]));
    const late = await decideStayTiming({
      propertyId: U1,
      roomStayId: U2,
      decision: "APPROVE_LATE_CHECKOUT",
      approvedUntil: new Date("2026-08-03T08:00:00.000Z"),
      reason: "No incoming assignment",
      idempotencyKey: "late-1",
      session,
    });
    expect(late.decision).toBe("APPROVE_LATE_CHECKOUT");
  });

  it("requires assignment and readiness before ordinary check-in", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("DUE_IN")]))
      .mockReturnValueOnce(chain([]));
    await expect(
      transitionStay({
        propertyId: U1,
        roomStayId: U2,
        action: "CHECK_IN",
        reason: "Guest arrived",
        idempotencyKey: "checkin-no-room",
        session,
      }),
    ).rejects.toThrow("Assign a physical room");

    mocks.select
      .mockReturnValueOnce(chain([current("DUE_IN")]))
      .mockReturnValueOnce(
        chain([{ ...assignment, housekeepingStatus: "DIRTY" }]),
      );
    await expect(
      transitionStay({
        propertyId: U1,
        roomStayId: U2,
        action: "CHECK_IN",
        reason: "Guest arrived",
        idempotencyKey: "checkin-not-ready",
        session,
      }),
    ).rejects.toThrow("in service and inspected");
  });

  it("releases an unassigned no-show without room-night updates", async () => {
    mocks.select
      .mockReturnValueOnce(chain([current("NO_SHOW")]))
      .mockReturnValueOnce(chain([]));
    const result = await transitionStay({
      propertyId: U1,
      roomStayId: U2,
      action: "RELEASE_NO_SHOW",
      reason: "No assignment had been made",
      idempotencyKey: "release-unassigned-no-show",
      session,
    });
    expect(result.roomRetained).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("records an optional skipped signature without file or identity", async () => {
    mocks.select.mockReturnValueOnce(
      chain([{ roomStayId: U2, bookerGuestId: U3 }]),
    );
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]));
    const result = await recordCheckinCapture({
      propertyId: U1,
      roomStayId: U2,
      captureType: "SIGNATURE",
      outcome: "SKIPPED",
      reason: "Optional capture postponed",
      idempotencyKey: "capture-skipped",
      session,
    });
    expect(result.outcome).toBe("SKIPPED");
    expect(mocks.encryptSensitiveValue).not.toHaveBeenCalled();
  });

  it("supports a decline and validates late-checkout approval time", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2, status: "IN_HOUSE" }]));
    const declined = await decideStayTiming({
      propertyId: U1,
      roomStayId: U2,
      decision: "DECLINE",
      reason: "Incoming booking prevents extension",
      idempotencyKey: "late-declined",
      session,
    });
    expect(declined.decision).toBe("DECLINE");

    mocks.select.mockReturnValueOnce(chain([{ id: U2, status: "IN_HOUSE" }]));
    await expect(
      decideStayTiming({
        propertyId: U1,
        roomStayId: U2,
        decision: "APPROVE_LATE_CHECKOUT",
        reason: "Missing approved time",
        idempotencyKey: "late-missing-time",
        session,
      }),
    ).rejects.toThrow("requires approvedUntil");
  });
});
