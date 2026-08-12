import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Technical Batch 2 database and worker contracts", () => {
  it("registers the booking migration and whole-rupiah payment requirement", async () => {
    const [manifest, migration] = await Promise.all([
      readFile(`${root}/database/migrations/manifest.mjs`, "utf8"),
      readFile(
        `${root}/database/migrations/after-drizzle/0008_booking_transaction_flow.sql`,
        "utf8",
      ),
    ]);
    expect(manifest).toContain("0008_booking_transaction_flow");
    expect(migration).toContain("ck_reservation_required_payment_whole_rupiah");
    expect(migration).toContain("fk_booking_quote_nights_rate_rule");
  });

  it("registers durable quote/reservation expiry and email handlers", async () => {
    const [worker, expiry] = await Promise.all([
      readFile(`${root}/scripts/lib/outbox-handlers.mjs`, "utf8"),
      readFile(`${root}/scripts/lib/reservation-expiry.mjs`, "utf8"),
    ]);
    expect(worker).toContain('"booking.quote-expire"');
    expect(worker).toContain('"booking.reservation-expire"');
    expect(worker).toContain('"notification.email"');
    expect(expiry).toContain("payment-review-hold");
    expect(expiry).toContain("booking.reservation.expire.reconciled");
  });
});
