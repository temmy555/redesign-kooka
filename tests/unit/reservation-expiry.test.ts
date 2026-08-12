import { describe, expect, it, vi } from "vitest";

import {
  expireReservationPaymentHold,
  reconcileExpiredReservationHolds,
} from "../../scripts/lib/reservation-expiry.mjs";

const overdueReservation = {
  id: "reservation-1",
  property_id: "property-1",
  folio_id: "folio-1",
  source: "ONLINE",
  status: "ON_HOLD",
  payment_deadline_at: "2026-08-12T02:00:00.000Z",
};

describe("reservation payment-hold expiry", () => {
  it("moves an overdue hold to EXPIRED and releases its inventory atomically", async () => {
    const client = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("select r.*, f.id as folio_id"))
          return { rows: [overdueReservation], rowCount: 1 };
        if (statement.includes("select 1 from payments"))
          return { rows: [], rowCount: 0 };
        if (statement.includes("update reservations"))
          return { rows: [{ id: overdueReservation.id }], rowCount: 1 };
        if (statement.includes("update inventory_claims"))
          return { rows: [{ id: "claim-1" }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(
      reconcileExpiredReservationHolds(
        pool,
        new Date("2026-08-12T03:00:00.000Z"),
      ),
    ).resolves.toEqual({
      inspectedReservations: 1,
      expiredReservations: 1,
      releasedClaims: 1,
    });
    expect(
      client.query.mock.calls.some(([statement]) =>
        String(statement).includes("set status = 'EXPIRED'"),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(([statement]) =>
        String(statement).includes("update folios"),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(([statement]) =>
        String(statement).includes("CLOSE_AFTER_RESERVATION_EXPIRY"),
      ),
    ).toBe(true);
    expect(
      client.query.mock.calls.some(
        ([statement, parameters]) =>
          String(statement).includes("insert into audit_events") &&
          Array.isArray(parameters) &&
          parameters.includes("booking.reservation.expire.reconciled"),
      ),
    ).toBe(true);
    expect(client.query).toHaveBeenLastCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("keeps the reservation and inventory held while payment evidence is under review", async () => {
    const client = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("select 1 from payments"))
          return { rows: [{ exists: 1 }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
    };

    await expect(
      expireReservationPaymentHold(
        client,
        overdueReservation,
        new Date("2026-08-12T03:00:00.000Z"),
      ),
    ).resolves.toEqual({ skipped: "payment-review-hold" });
    expect(
      client.query.mock.calls.some(([statement]) =>
        String(statement).includes("update reservations"),
      ),
    ).toBe(false);
  });

  it("rolls back reconciliation failures", async () => {
    const client = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes("select r.*, f.id as folio_id"))
          throw new Error("database unavailable");
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(reconcileExpiredReservationHolds(pool)).rejects.toThrow(
      "database unavailable",
    );
    expect(client.query).toHaveBeenCalledWith("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
