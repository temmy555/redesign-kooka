-- Technical Batch 2 (Roadmap Langkah 12-14): authoritative quote,
-- reservation payment terms, inventory expiry lookup, and snapshot guards.

ALTER TABLE reservations
  ADD COLUMN payment_mode varchar(40) NOT NULL DEFAULT 'FULL',
  ADD COLUMN required_payment_idr numeric(18,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT ck_reservation_payment_mode
    CHECK (payment_mode IN (
      'FULL', 'FIXED_DEPOSIT', 'PERCENTAGE_DEPOSIT',
      'PAY_AT_CHECKIN', 'PAY_AT_CHECKOUT'
    )),
  ADD CONSTRAINT ck_reservation_required_payment
    CHECK (required_payment_idr >= 0),
  ADD CONSTRAINT ck_reservation_required_payment_whole_rupiah
    CHECK (required_payment_idr = trunc(required_payment_idr));

ALTER TABLE booking_quotes
  ADD CONSTRAINT ck_booking_quote_status
    CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED'));

ALTER TABLE booking_quote_nights
  ADD CONSTRAINT fk_booking_quote_nights_rate_rule
    FOREIGN KEY (rate_rule_id) REFERENCES rate_rules(id) ON DELETE RESTRICT;

CREATE INDEX ix_inventory_claims_expiry
  ON inventory_claims (claim_status, expires_at)
  WHERE claim_status = 'ACTIVE' AND expires_at IS NOT NULL;

CREATE INDEX ix_booking_lookup_token_expiry
  ON booking_lookup_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX ix_payments_folio_status
  ON payments (folio_id, status, received_at);

ALTER TABLE resource_claims
  ALTER COLUMN reservation_room_id DROP NOT NULL,
  ADD COLUMN booking_quote_room_id uuid
    REFERENCES booking_quote_rooms(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ck_resource_claim_status
    CHECK (claim_status IN ('ACTIVE', 'RELEASED', 'EXPIRED')),
  ADD CONSTRAINT ck_resource_claim_source
    CHECK (num_nonnulls(booking_quote_room_id, reservation_room_id) = 1);

CREATE INDEX ix_resource_claim_quote_room
  ON resource_claims (booking_quote_room_id, claim_status)
  WHERE booking_quote_room_id IS NOT NULL;
