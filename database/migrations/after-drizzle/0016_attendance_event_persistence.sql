CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session_employee_business_date_active
  ON attendance_sessions (employee_id, business_date)
  WHERE status <> 'VOIDED';

CREATE INDEX IF NOT EXISTS ix_attendance_events_employee_time
  ON attendance_events (employee_id, server_time DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_attendance_event_status'
      AND conrelid = 'attendance_events'::regclass
  ) THEN
    ALTER TABLE attendance_events
      ADD CONSTRAINT ck_attendance_event_status
      CHECK (event_status IN ('ACCEPTED', 'NEEDS_REVIEW', 'REJECTED', 'VOIDED'));
  END IF;
END $$;
