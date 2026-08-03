-- Run after Drizzle creates the baseline tables.
-- PostgreSQL 18 baseline for KOOKA Residence.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE room_unit_type_periods
  ADD CONSTRAINT ex_room_unit_type_periods_no_overlap
  EXCLUDE USING gist (
    room_unit_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  );

ALTER TABLE property_setting_versions
  ADD CONSTRAINT ex_property_setting_versions_no_overlap
  EXCLUDE USING gist (
    setting_set_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE policy_versions
  ADD CONSTRAINT ex_policy_versions_no_overlap
  EXCLUDE USING gist (
    policy_set_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE tax_profile_versions
  ADD CONSTRAINT ex_tax_profile_versions_no_overlap
  EXCLUDE USING gist (
    tax_profile_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE payment_instruction_versions
  ADD CONSTRAINT ex_payment_instruction_versions_no_overlap
  EXCLUDE USING gist (
    instruction_set_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE document_profile_versions
  ADD CONSTRAINT ex_document_profile_versions_no_overlap
  EXCLUDE USING gist (
    document_profile_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE folio_entries
  ADD CONSTRAINT fk_folio_entries_reversal
  FOREIGN KEY (reversal_of_entry_id) REFERENCES folio_entries(id) ON DELETE RESTRICT;

ALTER TABLE payment_allocations
  ADD CONSTRAINT fk_payment_allocations_reversal
  FOREIGN KEY (reversal_of_allocation_id) REFERENCES payment_allocations(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION kooka_reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_immutable_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '% is append-only; use a reversal/correction/event workflow', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_folio_entries_immutable
  BEFORE UPDATE OR DELETE ON folio_entries
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_financial_document_versions_immutable
  BEFORE UPDATE OR DELETE ON financial_document_versions
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_attendance_events_immutable
  BEFORE UPDATE OR DELETE ON attendance_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_attendance_corrections_immutable
  BEFORE UPDATE OR DELETE ON attendance_corrections
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_reservation_status_events_immutable
  BEFORE UPDATE OR DELETE ON reservation_status_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_stay_status_events_immutable
  BEFORE UPDATE OR DELETE ON stay_status_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_payment_status_events_immutable
  BEFORE UPDATE OR DELETE ON payment_status_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_refund_status_events_immutable
  BEFORE UPDATE OR DELETE ON refund_status_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_inventory_claim_events_immutable
  BEFORE UPDATE OR DELETE ON inventory_claim_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_cleaning_task_events_immutable
  BEFORE UPDATE OR DELETE ON cleaning_task_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

CREATE TRIGGER trg_lost_found_custody_events_immutable
  BEFORE UPDATE OR DELETE ON lost_found_custody_events
  FOR EACH ROW EXECUTE FUNCTION kooka_reject_immutable_mutation();

COMMENT ON FUNCTION kooka_reject_immutable_mutation() IS
  'Protects business history. app.allow_immutable_mutation=on is reserved for controlled repair migrations.';
