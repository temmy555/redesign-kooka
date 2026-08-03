-- Technical Batch 5: public menu and manual paper F&B order entry.
-- Front Office records an order as standalone or posts immutable charges to
-- an open in-house folio. Payment state remains separate from kitchen/order
-- state; cancellation reverses folio debits instead of deleting history.

ALTER TABLE room_stays
  ADD COLUMN charge_privilege varchar(48) NOT NULL DEFAULT 'APPROVAL_REQUIRED',
  ADD CONSTRAINT ck_room_stay_charge_privilege CHECK (
    charge_privilege IN ('ALLOWED', 'NOT_ALLOWED', 'APPROVAL_REQUIRED')
  );

ALTER TABLE food_orders
  ADD COLUMN billing_bucket_id uuid,
  ADD CONSTRAINT food_orders_billing_bucket_id_folio_billing_buckets_id_fk
    FOREIGN KEY (billing_bucket_id) REFERENCES folio_billing_buckets(id) ON DELETE RESTRICT,
  DROP CONSTRAINT ck_food_order_room_charge,
  ADD CONSTRAINT ck_food_order_room_charge CHECK (
    settlement_route <> 'ROOM_CHARGE'
    OR (
      folio_id IS NOT NULL
      AND room_stay_id IS NOT NULL
      AND billing_bucket_id IS NOT NULL
      AND reservation_id IS NOT NULL
      AND reservation_room_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT ck_food_order_status CHECK (
    status IN ('ENTERED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED')
  ),
  ADD CONSTRAINT ck_food_order_paper_reference CHECK (btrim(paper_reference) <> '');

ALTER TABLE food_order_items
  ADD COLUMN service_charge_amount_idr numeric(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN discount_amount_idr numeric(18, 2) NOT NULL DEFAULT 0,
  DROP CONSTRAINT ck_food_order_item_amount,
  ADD CONSTRAINT ck_food_order_item_amount CHECK (
    quantity > 0
    AND unit_price_idr >= 0
    AND tax_amount_idr >= 0
    AND service_charge_amount_idr >= 0
    AND discount_amount_idr >= 0
    AND total_idr >= 0
  ),
  ADD CONSTRAINT ck_food_order_items_service_charge_whole_rupiah CHECK (
    service_charge_amount_idr = trunc(service_charge_amount_idr)
  ),
  ADD CONSTRAINT ck_food_order_items_discount_whole_rupiah CHECK (
    discount_amount_idr = trunc(discount_amount_idr)
  );

CREATE TABLE food_order_payments (
  id uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  food_order_id uuid NOT NULL REFERENCES food_orders(id) ON DELETE RESTRICT,
  payment_code varchar(32) NOT NULL,
  method varchar(40) NOT NULL,
  amount_idr numeric(18, 2) NOT NULL,
  status varchar(48) NOT NULL DEFAULT 'PAID',
  reference varchar(160),
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  voided_at timestamp with time zone,
  void_reason text,
  received_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  voided_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key varchar(160) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT ck_food_order_payment_amount CHECK (
    amount_idr > 0 AND amount_idr = trunc(amount_idr)
  ),
  CONSTRAINT ck_food_order_payment_status CHECK (status IN ('PAID', 'VOIDED')),
  CONSTRAINT ck_food_order_payment_method CHECK (
    method IN ('CASH', 'BANK_TRANSFER', 'OTHER')
  ),
  CONSTRAINT ck_food_order_payment_void CHECK (
    status <> 'VOIDED'
    OR (voided_at IS NOT NULL AND voided_by_user_id IS NOT NULL AND btrim(void_reason) <> '')
  )
);

CREATE UNIQUE INDEX uq_food_order_payment_code
  ON food_order_payments(payment_code);
CREATE UNIQUE INDEX uq_food_order_payment_idempotency
  ON food_order_payments(idempotency_key);
CREATE UNIQUE INDEX uq_food_order_single_paid_payment
  ON food_order_payments(food_order_id) WHERE status = 'PAID';
CREATE INDEX ix_food_order_payments_order
  ON food_order_payments(food_order_id, status);

CREATE TABLE food_order_receipts (
  id uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  food_order_id uuid NOT NULL REFERENCES food_orders(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES food_order_payments(id) ON DELETE RESTRICT,
  receipt_code varchar(40) NOT NULL,
  status varchar(48) NOT NULL DEFAULT 'ISSUED',
  recipient_name varchar(160) NOT NULL,
  totals_snapshot jsonb NOT NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  issued_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT ck_food_order_receipt_status CHECK (status IN ('ISSUED', 'VOIDED')),
  CONSTRAINT ck_food_order_receipt_recipient CHECK (btrim(recipient_name) <> '')
);

CREATE UNIQUE INDEX uq_food_order_receipt_order
  ON food_order_receipts(food_order_id);
CREATE UNIQUE INDEX uq_food_order_receipt_payment
  ON food_order_receipts(payment_id);
CREATE UNIQUE INDEX uq_food_order_receipt_code
  ON food_order_receipts(receipt_code);

ALTER TABLE menu_categories
  ADD CONSTRAINT ck_menu_category_status CHECK (status IN ('ACTIVE', 'ARCHIVED'));

ALTER TABLE menu_items
  ADD CONSTRAINT ck_menu_item_status CHECK (status IN ('ACTIVE', 'ARCHIVED'));

ALTER TABLE menu_item_versions
  ADD CONSTRAINT ck_menu_item_lifecycle CHECK (
    lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')
  );

CREATE UNIQUE INDEX uq_menu_item_single_active_version
  ON menu_item_versions(menu_item_id) WHERE lifecycle_status = 'ACTIVE';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('FRONT_OFFICE', 'fnb.order.manage'),
  ('FRONT_OFFICE', 'fnb.charge.manage'),
  ('FRONT_OFFICE', 'fnb.guest_lookup.view')
) AS batch5(role_code, permission_code)
JOIN roles r ON r.code = batch5.role_code
JOIN permissions p ON p.code = batch5.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
