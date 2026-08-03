ALTER TABLE attendance_locations
  ADD COLUMN IF NOT EXISTS effective_from timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to timestamptz;

CREATE INDEX IF NOT EXISTS ix_attendance_locations_effective
  ON attendance_locations (property_id, status, effective_from);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_attendance_location_status'
      AND conrelid = 'attendance_locations'::regclass
  ) THEN
    ALTER TABLE attendance_locations
      ADD CONSTRAINT ck_attendance_location_status
      CHECK (status IN ('ACTIVE', 'INACTIVE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_attendance_location_effective_period'
      AND conrelid = 'attendance_locations'::regclass
  ) THEN
    ALTER TABLE attendance_locations
      ADD CONSTRAINT ck_attendance_location_effective_period
      CHECK (effective_to IS NULL OR effective_to > effective_from);
  END IF;
END $$;

INSERT INTO permissions (code, module, description, sensitive)
VALUES
  ('attendance.location.view', 'attendance', 'View attendance location configuration', false),
  ('attendance.location.manage', 'attendance', 'Create, update, activate, and deactivate attendance locations', false),
  ('attendance.report.view', 'attendance', 'View employee attendance reports', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('OWNER', 'attendance.location.view'),
  ('OWNER', 'attendance.location.manage'),
  ('OWNER', 'attendance.report.view'),
  ('FRONT_OFFICE', 'attendance.location.view'),
  ('FRONT_OFFICE', 'attendance.location.manage'),
  ('FRONT_OFFICE', 'attendance.report.view')
) AS attendance_grant(role_code, permission_code)
JOIN roles r ON r.code = attendance_grant.role_code
JOIN permissions p ON p.code = attendance_grant.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
