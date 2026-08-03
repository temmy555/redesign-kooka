import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  requirePermission: vi.fn(),
  getDatabase: vi.fn(),
  saveStoredFile: vi.fn(),
  AuthorizationError: class extends Error {},
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/platform/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/db", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("../../src/platform/file-storage", () => ({
  saveStoredFile: mocks.saveStoredFile,
}));

import { GET as adminOverviewGet } from "../../app/api/staff/admin/overview/route";
import { GET as staffBookingsGet } from "../../app/api/staff/bookings/route";
import { POST as checkinFilePost } from "../../app/api/staff/checkin-files/route";
import { GET as roomGuestsGet } from "../../app/api/staff/fnb/room-guests/route";
import { GET as staffPaymentsGet } from "../../app/api/staff/payments/route";

const U1 = "11111111-1111-4111-a111-111111111111";

function selection(result: unknown[], withLimit = false) {
  const promise = Promise.resolve(result);
  const chain = {
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(withLimit ? chain : promise);
  chain.limit.mockReturnValue(promise);
  return chain;
}

describe("Batch 7 staff support routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks))
      if (vi.isMockFunction(mock)) mock.mockReset();
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.getActivePropertyId.mockResolvedValue(U1);
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.saveStoredFile.mockResolvedValue({ id: U1, scanStatus: "PENDING" });
  });

  it("lists booking and payment queues with server-side permission checks", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({ rows: [{ bookingCode: "KR-01" }] })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({ rows: [{ paymentCode: "PAY-01" }] });
    mocks.getDatabase.mockReturnValue({ execute });

    const bookings = await staffBookingsGet();
    const payments = await staffPaymentsGet();

    expect(bookings.status).toBe(200);
    expect(await bookings.json()).toEqual({
      bookings: [{ bookingCode: "KR-01" }],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        from: 1,
        to: 1,
      },
    });
    expect(payments.status).toBe(200);
    expect(await payments.json()).toEqual({
      payments: [{ paymentCode: "PAY-01" }],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        from: 1,
        to: 1,
      },
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      expect.anything(),
      U1,
      "booking.manage",
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      expect.anything(),
      U1,
      "payment.manage",
    );
  });

  it("uses safe 401 and 403 responses for queue endpoints", async () => {
    mocks.requireCurrentSession.mockRejectedValueOnce(
      new Error("No authenticated staff session"),
    );
    expect((await staffBookingsGet()).status).toBe(401);

    mocks.requirePermission.mockRejectedValueOnce(
      new mocks.AuthorizationError("denied"),
    );
    expect((await staffPaymentsGet()).status).toBe(403);

    mocks.requirePermission.mockRejectedValueOnce(
      new mocks.AuthorizationError("denied"),
    );
    expect((await staffBookingsGet()).status).toBe(403);

    mocks.requireCurrentSession.mockRejectedValueOnce(
      new Error("No authenticated staff session"),
    );
    expect((await staffPaymentsGet()).status).toBe(401);
  });

  it("uploads a private optional check-in capture", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File([Buffer.from([0xff, 0xd8, 0xff])], "ktp.jpg", {
        type: "image/jpeg",
      }),
    );
    form.set("purpose", "IDENTITY_DOCUMENT");
    const response = await checkinFilePost(
      new Request("http://localhost/api/staff/checkin-files", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      fileId: U1,
      scanStatus: "PENDING",
    });
    expect(mocks.saveStoredFile).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "SENSITIVE_GUEST_DATA",
        purpose: "CHECKIN_IDENTITY_DOCUMENT",
      }),
    );
  });

  it("rejects missing, non-image, forbidden, and unauthenticated captures", async () => {
    const missing = new FormData();
    missing.set("purpose", "SIGNATURE");
    expect(
      (
        await checkinFilePost(
          new Request("http://localhost/api/staff/checkin-files", {
            method: "POST",
            body: missing,
          }),
        )
      ).status,
    ).toBe(400);

    const invalid = new FormData();
    invalid.set("file", new File(["text"], "note.txt", { type: "text/plain" }));
    invalid.set("purpose", "GUEST_PHOTO");
    expect(
      (
        await checkinFilePost(
          new Request("http://localhost/api/staff/checkin-files", {
            method: "POST",
            body: invalid,
          }),
        )
      ).status,
    ).toBe(400);

    mocks.requirePermission.mockRejectedValueOnce(
      new mocks.AuthorizationError("denied"),
    );
    expect(
      (
        await checkinFilePost(
          new Request("http://localhost/api/staff/checkin-files", {
            method: "POST",
            body: missing,
          }),
        )
      ).status,
    ).toBe(403);

    mocks.requireCurrentSession.mockRejectedValueOnce(
      new Error("No authenticated staff session"),
    );
    expect(
      (
        await checkinFilePost(
          new Request("http://localhost/api/staff/checkin-files", {
            method: "POST",
            body: missing,
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("returns only current in-house room identifiers for F&B", async () => {
    mocks.getDatabase.mockReturnValue({
      execute: vi.fn().mockResolvedValue({
        rows: [{ roomStayId: U1, roomNumber: "1", leadGuestName: "Budi" }],
      }),
    });
    const response = await roomGuestsGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rooms: [{ roomStayId: U1, roomNumber: "1", leadGuestName: "Budi" }],
    });

    mocks.requirePermission.mockRejectedValueOnce(
      new mocks.AuthorizationError("denied"),
    );
    expect((await roomGuestsGet()).status).toBe(403);

    mocks.requireCurrentSession.mockRejectedValueOnce(
      new Error("No authenticated staff session"),
    );
    expect((await roomGuestsGet()).status).toBe(401);
  });

  it("returns property-scoped team, active grants, and immutable audit rows", async () => {
    const team = selection([{ userId: U1, displayName: "Owner" }]);
    const grants = selection([{ userId: U1, roleCode: "OWNER" }]);
    const select = vi
      .fn()
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(team) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(grants) });
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [{ id: U1, action: "booking.create" }],
      });
    mocks.getDatabase.mockReturnValue({ select, execute });

    const response = await adminOverviewGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      team: [{ userId: U1, displayName: "Owner" }],
      grants: [{ userId: U1, roleCode: "OWNER" }],
      audit: [{ id: U1, action: "booking.create" }],
      auditPagination: {
        page: 1,
        pageSize: 50,
        totalItems: 1,
        totalPages: 1,
        from: 1,
        to: 1,
      },
    });
    expect(mocks.requirePermission).toHaveBeenCalledTimes(2);
  });

  it("guards the Owner overview with both authentication and permissions", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new mocks.AuthorizationError("denied"),
    );
    expect((await adminOverviewGet()).status).toBe(403);

    mocks.requireCurrentSession.mockRejectedValueOnce(
      new Error("No authenticated staff session"),
    );
    expect((await adminOverviewGet()).status).toBe(401);
  });
});
