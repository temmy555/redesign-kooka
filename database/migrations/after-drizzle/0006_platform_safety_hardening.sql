-- Roadmap steps 6-8 safety hardening after concurrency/security review.

ALTER TABLE outbox_events
  ADD CONSTRAINT ck_outbox_status
  CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD_LETTER'));

CREATE INDEX ix_outbox_lease
  ON outbox_events (status, locked_at);

-- A user-role assignment may be scheduled/effective-dated, but overlapping
-- windows for the same user, role, and property are never valid.
ALTER TABLE user_roles
  ADD CONSTRAINT ex_user_roles_non_overlapping
  EXCLUDE USING gist (
    user_id WITH =,
    role_id WITH =,
    property_id WITH =,
    tstzrange(effective_from, effective_to, '[)') WITH &&
  );
