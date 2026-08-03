-- Run after the hard-constraint batch.
-- Whole-rupiah guard for KOOKA Residence official IDR amounts.
--
-- Storage stays numeric(18,2) so PostgreSQL keeps exact decimal arithmetic and
-- never uses floating point. The business rule is that every official IDR value
-- is a whole rupiah, so the database rejects fractional amounts outright instead
-- of trusting the application layer to round.
--
-- booking_quotes.display_total is intentionally excluded: it holds the USD/AUD
-- display estimate, which is not an IDR ledger value and may carry decimals.

ALTER TABLE rate_rule_dates
  ADD CONSTRAINT ck_rate_rule_dates_nightly_rate_idr_whole_rupiah
  CHECK (nightly_rate_idr = trunc(nightly_rate_idr));

ALTER TABLE rate_rules
  ADD CONSTRAINT ck_rate_rules_nightly_rate_idr_whole_rupiah
  CHECK (nightly_rate_idr = trunc(nightly_rate_idr));

ALTER TABLE booking_quote_nights
  ADD CONSTRAINT ck_booking_quote_nights_room_rate_idr_whole_rupiah
  CHECK (room_rate_idr = trunc(room_rate_idr));

ALTER TABLE booking_quote_nights
  ADD CONSTRAINT ck_booking_quote_nights_discount_idr_whole_rupiah
  CHECK (discount_idr = trunc(discount_idr));

ALTER TABLE booking_quote_nights
  ADD CONSTRAINT ck_booking_quote_nights_tax_idr_whole_rupiah
  CHECK (tax_idr = trunc(tax_idr));

ALTER TABLE booking_quote_nights
  ADD CONSTRAINT ck_booking_quote_nights_service_charge_idr_whole_rupiah
  CHECK (service_charge_idr = trunc(service_charge_idr));

ALTER TABLE booking_quote_nights
  ADD CONSTRAINT ck_booking_quote_nights_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE booking_quote_rooms
  ADD CONSTRAINT ck_booking_quote_rooms_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE booking_quotes
  ADD CONSTRAINT ck_booking_quotes_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE reservation_addons
  ADD CONSTRAINT ck_reservation_addons_unit_price_idr_whole_rupiah
  CHECK (unit_price_idr = trunc(unit_price_idr));

ALTER TABLE reservation_addons
  ADD CONSTRAINT ck_reservation_addons_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE reservation_room_nights
  ADD CONSTRAINT ck_reservation_room_nights_room_rate_idr_whole_rupiah
  CHECK (room_rate_idr = trunc(room_rate_idr));

ALTER TABLE reservation_room_nights
  ADD CONSTRAINT ck_reservation_room_nights_discount_idr_whole_rupiah
  CHECK (discount_idr = trunc(discount_idr));

ALTER TABLE reservation_room_nights
  ADD CONSTRAINT ck_reservation_room_nights_tax_idr_whole_rupiah
  CHECK (tax_idr = trunc(tax_idr));

ALTER TABLE reservation_room_nights
  ADD CONSTRAINT ck_reservation_room_nights_service_charge_idr_whole_rupiah
  CHECK (service_charge_idr = trunc(service_charge_idr));

ALTER TABLE reservation_room_nights
  ADD CONSTRAINT ck_reservation_room_nights_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE room_moves
  ADD CONSTRAINT ck_room_moves_price_adjustment_idr_whole_rupiah
  CHECK (price_adjustment_idr = trunc(price_adjustment_idr));

ALTER TABLE document_entry_coverage
  ADD CONSTRAINT ck_document_entry_coverage_covered_amount_idr_whole_rupiah
  CHECK (covered_amount_idr = trunc(covered_amount_idr));

ALTER TABLE financial_document_versions
  ADD CONSTRAINT ck_financial_document_versions_subtotal_idr_whole_rupiah
  CHECK (subtotal_idr = trunc(subtotal_idr));

ALTER TABLE financial_document_versions
  ADD CONSTRAINT ck_financial_document_versions_discount_idr_whole_rupiah
  CHECK (discount_idr = trunc(discount_idr));

ALTER TABLE financial_document_versions
  ADD CONSTRAINT ck_financial_document_versions_service_charge_idr_whole_rupiah
  CHECK (service_charge_idr = trunc(service_charge_idr));

ALTER TABLE financial_document_versions
  ADD CONSTRAINT ck_financial_document_versions_tax_idr_whole_rupiah
  CHECK (tax_idr = trunc(tax_idr));

ALTER TABLE financial_document_versions
  ADD CONSTRAINT ck_financial_document_versions_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE folio_entries
  ADD CONSTRAINT ck_folio_entries_unit_amount_idr_whole_rupiah
  CHECK (unit_amount_idr = trunc(unit_amount_idr));

ALTER TABLE folio_entries
  ADD CONSTRAINT ck_folio_entries_net_amount_idr_whole_rupiah
  CHECK (net_amount_idr = trunc(net_amount_idr));

ALTER TABLE folio_entries
  ADD CONSTRAINT ck_folio_entries_discount_amount_idr_whole_rupiah
  CHECK (discount_amount_idr = trunc(discount_amount_idr));

ALTER TABLE folio_entries
  ADD CONSTRAINT ck_folio_entries_service_charge_amount_idr_whole_rupiah
  CHECK (service_charge_amount_idr = trunc(service_charge_amount_idr));

ALTER TABLE folio_entries
  ADD CONSTRAINT ck_folio_entries_tax_amount_idr_whole_rupiah
  CHECK (tax_amount_idr = trunc(tax_amount_idr));

ALTER TABLE folio_entries
  ADD CONSTRAINT ck_folio_entries_total_amount_idr_whole_rupiah
  CHECK (total_amount_idr = trunc(total_amount_idr));

ALTER TABLE payment_allocations
  ADD CONSTRAINT ck_payment_allocations_amount_idr_whole_rupiah
  CHECK (amount_idr = trunc(amount_idr));

ALTER TABLE payments
  ADD CONSTRAINT ck_payments_amount_idr_whole_rupiah
  CHECK (amount_idr = trunc(amount_idr));

ALTER TABLE refunds
  ADD CONSTRAINT ck_refunds_amount_idr_whole_rupiah
  CHECK (amount_idr = trunc(amount_idr));

ALTER TABLE booking_amendments
  ADD CONSTRAINT ck_booking_amendments_delta_idr_whole_rupiah
  CHECK (delta_idr = trunc(delta_idr));

ALTER TABLE damage_assessments
  ADD CONSTRAINT ck_damage_assessments_amount_idr_whole_rupiah
  CHECK (amount_idr = trunc(amount_idr));

ALTER TABLE damage_catalog_versions
  ADD CONSTRAINT ck_damage_catalog_versions_reference_price_idr_whole_rupiah
  CHECK (reference_price_idr = trunc(reference_price_idr));

ALTER TABLE food_order_items
  ADD CONSTRAINT ck_food_order_items_unit_price_idr_whole_rupiah
  CHECK (unit_price_idr = trunc(unit_price_idr));

ALTER TABLE food_order_items
  ADD CONSTRAINT ck_food_order_items_tax_amount_idr_whole_rupiah
  CHECK (tax_amount_idr = trunc(tax_amount_idr));

ALTER TABLE food_order_items
  ADD CONSTRAINT ck_food_order_items_total_idr_whole_rupiah
  CHECK (total_idr = trunc(total_idr));

ALTER TABLE menu_item_versions
  ADD CONSTRAINT ck_menu_item_versions_price_idr_whole_rupiah
  CHECK (price_idr = trunc(price_idr));
