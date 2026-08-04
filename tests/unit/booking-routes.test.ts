import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActivePropertyId: vi.fn(),
  requireCurrentSession: vi.fn(),
  cookies: vi.fn(),
  searchAvailability: vi.fn(),
  createBookingQuote: vi.fn(),
  getPublicCheckoutPolicies: vi.fn(),
  createReservation: vi.fn(),
  cancelReservation: vi.fn(),
  createCustomerLookupSession: vi.fn(),
  getCustomerBooking: vi.fn(),
  recordPaymentForReview: vi.fn(),
  reviewPayment: vi.fn(),
  voidPayment: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/logger", () => ({
  getLogger: () => ({ error: mocks.logError }),
}));
vi.mock("../../src/modules/booking/availability", () => ({
  searchAvailability: mocks.searchAvailability,
}));
vi.mock("../../src/modules/booking/quote-service", () => ({
  createBookingQuote: mocks.createBookingQuote,
}));
vi.mock("../../src/modules/booking/public-checkout", () => ({
  getPublicCheckoutPolicies: mocks.getPublicCheckoutPolicies,
}));
vi.mock("../../src/modules/booking/reservation-service", () => ({
  createReservation: mocks.createReservation,
  cancelReservation: mocks.cancelReservation,
}));
vi.mock("../../src/modules/booking/customer-lookup", () => ({
  createCustomerLookupSession: mocks.createCustomerLookupSession,
  getCustomerBooking: mocks.getCustomerBooking,
}));
vi.mock("../../src/modules/booking/payment-service", () => ({
  recordPaymentForReview: mocks.recordPaymentForReview,
  reviewPayment: mocks.reviewPayment,
  voidPayment: mocks.voidPayment,
}));

import { GET as availabilityGet } from "../../app/api/booking/availability/route";
import { POST as quotePost } from "../../app/api/booking/quote/route";
import { POST as reservationPost } from "../../app/api/booking/reservations/route";
import {
  GET as lookupGet,
  POST as lookupPost,
} from "../../app/api/booking/lookup/route";
import { POST as staffBookingPost } from "../../app/api/staff/bookings/route";
import { POST as paymentPost } from "../../app/api/staff/payments/route";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";

function request(
  path: string,
  body: unknown,
  key?: string,
  headers?: Record<string, string>,
) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "idempotency-key": key } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const room = {
  roomTypeId: U1,
  adults: 2,
  children: 0,
  infants: 0,
  extraBedQuantity: 0,
};

describe("booking and payment routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
      mock.mockResolvedValue({ ok: true });
    }
    mocks.getActivePropertyId.mockResolvedValue(U2);
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.cookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
  });

  it("searches public availability from validated query parameters", async () => {
    const response = await availabilityGet(
      new Request(
        "http://localhost/api/booking/availability?checkInDate=2026-08-03&checkoutDate=2026-08-04&rooms=1&adults=2&children=0&infants=0",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.searchAvailability).toHaveBeenCalledWith(
      U2,
      expect.objectContaining({ rooms: 1, adults: 2 }),
    );
  });

  it("rejects invalid public availability", async () => {
    const response = await availabilityGet(
      new Request("http://localhost/api/booking/availability?rooms=0"),
    );
    expect(response.status).toBe(400);
  });

  it("maps unexpected availability failures to a safe error", async () => {
    mocks.searchAvailability.mockRejectedValue(new Error("database detail"));
    const response = await availabilityGet(
      new Request(
        "http://localhost/api/booking/availability?checkInDate=2026-08-03&checkoutDate=2026-08-04&rooms=1&adults=2",
      ),
    );
    expect(response.status).toBe(500);
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "database detail" }),
      "Public availability search failed",
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
    );
  });

  it("creates an idempotent public quote", async () => {
    const response = await quotePost(
      request(
        "/api/booking/quote",
        {
          checkInDate: "2026-08-03",
          checkoutDate: "2026-08-04",
          ratePlanCode: "BAR",
          language: "id",
          displayCurrency: "IDR",
          rooms: [room],
        },
        "quote-1",
      ),
    );
    expect(response.status).toBe(201);
    expect(mocks.createBookingQuote).toHaveBeenCalledOnce();
  });

  it("requires idempotency for public quote and reservation", async () => {
    const [quote, reservation] = await Promise.all([
      quotePost(request("/api/booking/quote", {}, undefined)),
      reservationPost(request("/api/booking/reservations", {}, undefined)),
    ]);
    expect([quote.status, reservation.status]).toEqual([400, 400]);
  });

  it("creates an online reservation without customer login", async () => {
    const response = await reservationPost(
      request(
        "/api/booking/reservations",
        {
          quoteId: U1,
          booker: {
            name: "Budi Santoso",
            email: "budi@example.com",
            phone: "+628123456789",
          },
          acknowledgedPolicyVersionIds: [U2],
        },
        "reservation-1",
      ),
    );
    expect(response.status).toBe(201);
    expect(mocks.createReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ source: "ONLINE" }),
      }),
    );
  });

  it("logs unexpected reservation failures and returns a safe response", async () => {
    mocks.createReservation.mockRejectedValue(new Error("missing UAT table"));
    const response = await reservationPost(
      request(
        "/api/booking/reservations",
        {
          quoteId: U1,
          booker: {
            name: "Budi Santoso",
            email: "budi@example.com",
          },
          acknowledgedPolicyVersionIds: [],
        },
        "reservation-error",
      ),
    );

    expect(response.status).toBe(500);
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "missing UAT table" }),
      "Public reservation creation failed",
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
    );
  });

  it("creates a code-and-email lookup session and reads it with bearer token", async () => {
    mocks.createCustomerLookupSession.mockResolvedValue({
      token: "lookup-token",
      expiresAt: "2026-08-03T06:00:00.000Z",
    });
    const login = await lookupPost(
      request(
        "/api/booking/lookup",
        { bookingCode: "KR-260802-ABC", email: "budi@example.com" },
        undefined,
        { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
      ),
    );
    expect(login.status).toBe(200);
    expect(mocks.createCustomerLookupSession).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "203.0.113.5" }),
    );

    const lookup = await lookupGet(
      new Request("http://localhost/api/booking/lookup", {
        headers: { authorization: "Bearer lookup-token" },
      }),
    );
    expect(lookup.status).toBe(200);
    expect(mocks.getCustomerBooking).toHaveBeenCalledWith({
      propertyId: U2,
      token: "lookup-token",
    });
  });

  it("allows a booking-code-only lookup session", async () => {
    mocks.createCustomerLookupSession.mockResolvedValue({
      token: "lookup-token",
      expiresAt: "2026-08-03T06:00:00.000Z",
    });
    const response = await lookupPost(
      request("/api/booking/lookup", { bookingCode: "KR-260802-ABC" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.createCustomerLookupSession).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingCode: "KR-260802-ABC",
      }),
    );
    expect(
      mocks.createCustomerLookupSession.mock.calls[0]?.[0],
    ).not.toHaveProperty("email");
  });

  it("returns a generic unauthorized response when lookup details are malformed", async () => {
    const response = await lookupPost(
      request("/api/booking/lookup", { bookingCode: "x", email: "bad" }),
    );
    expect(response.status).toBe(401);
  });

  it.each([
    [
      "QUOTE",
      {
        action: "QUOTE",
        checkInDate: "2026-08-03",
        checkoutDate: "2026-08-04",
        ratePlanCode: "BAR",
        language: "id",
        displayCurrency: "IDR",
        rooms: [room],
      },
      "createBookingQuote",
      201,
    ],
    [
      "RESERVE",
      {
        action: "RESERVE",
        quoteId: U1,
        booker: { name: "Budi Santoso", email: "budi@example.com" },
        paymentMode: "FULL",
        acknowledgedPolicyVersionIds: [U2],
      },
      "createReservation",
      201,
    ],
    [
      "CANCEL",
      {
        action: "CANCEL",
        reservationId: U1,
        reason: "Guest cancellation request",
      },
      "cancelReservation",
      200,
    ],
  ])(
    "dispatches staff booking action %s",
    async (_action, body, service, status) => {
      const response = await staffBookingPost(
        request("/api/staff/bookings", body, `staff-${_action}`),
      );
      expect(response.status).toBe(status);
      expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [
      "RECORD_FOR_REVIEW",
      {
        action: "RECORD_FOR_REVIEW",
        reservationId: U1,
        amountIdr: 500000,
        method: "BANK_TRANSFER",
        receivedAt: "2026-08-03T05:00:00.000Z",
        reference: "TRX-1",
        proofFileId: U2,
      },
      "recordPaymentForReview",
      201,
    ],
    [
      "REVIEW",
      {
        action: "REVIEW",
        paymentId: U1,
        decision: "VERIFY",
        reason: "Transfer matches bank statement",
      },
      "reviewPayment",
      200,
    ],
    [
      "VOID",
      { action: "VOID", paymentId: U1, reason: "Duplicate payment record" },
      "voidPayment",
      200,
    ],
  ])("dispatches payment action %s", async (_action, body, service, status) => {
    const response = await paymentPost(
      request("/api/staff/payments", body, `payment-${_action}`),
    );
    expect(response.status).toBe(status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("default-denies unauthenticated staff booking and payment requests", async () => {
    mocks.requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );
    const [booking, payment] = await Promise.all([
      staffBookingPost(
        request(
          "/api/staff/bookings",
          {
            action: "CANCEL",
            reservationId: U1,
            reason: "Cancellation request",
          },
          "staff-unauth",
        ),
      ),
      paymentPost(
        request(
          "/api/staff/payments",
          { action: "VOID", paymentId: U1, reason: "Duplicate payment" },
          "payment-unauth",
        ),
      ),
    ]);
    expect([booking.status, payment.status]).toEqual([401, 401]);
  });
});
