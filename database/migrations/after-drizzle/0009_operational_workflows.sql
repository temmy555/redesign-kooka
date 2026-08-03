-- Technical Batch 3: operational workflow hardening.
-- Application actions own transitions; these constraints remain the final
-- concurrency/integrity guard when two staff requests race.

CREATE INDEX IF NOT EXISTS ix_room_board_live_assignments
  ON room_assignments (room_unit_id, status, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS ix_room_board_unassigned_arrivals
  ON room_stays (status, planned_arrival_at)
  WHERE status IN ('NOT_STARTED', 'DUE_IN');

CREATE INDEX IF NOT EXISTS ix_cleaning_daily_source
  ON cleaning_tasks (room_stay_id, task_type, target_at, status)
  WHERE room_stay_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_financial_document_render_queue
  ON financial_document_versions (document_id, rendered_file_id)
  WHERE rendered_file_id IS NULL;

ALTER TABLE room_moves
  DROP CONSTRAINT IF EXISTS ck_room_move_price_amount,
  ADD CONSTRAINT ck_room_move_price_amount CHECK (
    (price_treatment = 'NO_CHANGE' AND price_adjustment_idr = 0)
    OR (price_treatment IN ('CHARGE', 'CREDIT') AND price_adjustment_idr > 0)
  );

ALTER TABLE room_blocks
  DROP CONSTRAINT IF EXISTS ck_room_block_type,
  ADD CONSTRAINT ck_room_block_type CHECK (
    block_type IN ('MAINTENANCE', 'OUT_OF_ORDER', 'OWNER', 'OTHER')
  );

ALTER TABLE damage_incidents
  DROP CONSTRAINT IF EXISTS ck_damage_incident_status,
  ADD CONSTRAINT ck_damage_incident_status CHECK (
    status IN ('REPORTED', 'APPROVED', 'WAIVED', 'DISPUTED', 'CLOSED')
  );

-- A payment can have several positive allocations, but only one reversal
-- may point to a given original allocation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_allocation_single_reversal
  ON payment_allocations (reversal_of_allocation_id)
  WHERE reversal_of_allocation_id IS NOT NULL;

-- Front Office remains authorized by the already-approved stay.manage and
-- payment.manage permissions. Cleaning receives only operational queues;
-- financial, identity, and refund evidence remain excluded.
INSERT INTO permissions (code, module, description, sensitive)
VALUES
  ('room.board.view', 'stay', 'View the live room monitor and room board', false),
  ('financial.document.manage', 'payment', 'Issue, void, and deliver folio financial documents', false),
  ('lost_found.manage', 'operations', 'Manage lost-and-found custody and claims', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('FRONT_OFFICE', 'room.board.view'),
  ('FRONT_OFFICE', 'financial.document.manage'),
  ('FRONT_OFFICE', 'lost_found.manage'),
  ('CLEANING', 'room.board.view'),
  ('CLEANING', 'lost_found.manage')
) AS batch3(role_code, permission_code)
JOIN roles r ON r.code = batch3.role_code
JOIN permissions p ON p.code = batch3.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

