import { describe, expect, it } from "vitest";

import { buildBookingStatusEmail } from "../../src/modules/booking/customer-email";

describe("customer booking email templates", () => {
  it("renders the Indonesian payment-review email as branded HTML", () => {
    const email = buildBookingStatusEmail({
      kind: "PAYMENT_RECORDED",
      language: "id",
      bookingCode: "KR-260803-3F5632B2A6",
    });

    expect(email.text).toBe(
      "Bukti pembayaran untuk booking KR-260803-3F5632B2A6 telah dicatat. Inventori kamar tetap ditahan selama Front Office melakukan verifikasi.",
    );
    expect(email.html).toContain("KOOKA Residence");
    expect(email.html).toContain("BUKTI PEMBAYARAN DITERIMA");
    expect(email.html).toContain("KR-260803-3F5632B2A6");
    expect(email.html).toContain("/booking/lookup?code=KR-260803-3F5632B2A6");
  });

  it("renders the English confirmed email as branded HTML", () => {
    const email = buildBookingStatusEmail({
      kind: "BOOKING_CONFIRMED",
      language: "en",
      bookingCode: "KR-260803-3F5632B2A6",
    });

    expect(email.text).toBe(
      "Payment has been verified and booking KR-260803-3F5632B2A6 is confirmed.",
    );
    expect(email.html).toContain("BOOKING CONFIRMED");
    expect(email.html).toContain("Your stay is confirmed.");
  });
});
