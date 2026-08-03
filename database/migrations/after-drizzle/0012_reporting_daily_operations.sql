-- Technical Batch 6 / Roadmap Langkah 21: operational reporting, daily
-- rollover, reconciliation exception workflow, and privacy-safe CSV export.
-- Reporting remains a read model over authoritative operational tables.

CREATE TABLE reconciliation_exceptions (
  id uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  business_date date,
  check_code varchar(80) NOT NULL,
  fingerprint varchar(200) NOT NULL,
  severity varchar(48) NOT NULL,
  status varchar(48) NOT NULL DEFAULT 'OPEN',
  entity_type varchar(64) NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL,
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  last_detected_at timestamp with time zone NOT NULL DEFAULT now(),
  occurrence_count integer NOT NULL DEFAULT 1,
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  acknowledged_at timestamp with time zone,
  acknowledged_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at timestamp with time zone,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  resolution_reason text,
  resolution_reference varchar(200),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT ck_reconciliation_exception_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT ck_reconciliation_exception_status CHECK (status IN ('OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED','ACCEPTED_WITH_REASON')),
  CONSTRAINT ck_reconciliation_exception_occurrence CHECK (occurrence_count > 0),
  CONSTRAINT ck_reconciliation_exception_resolution CHECK (
    status NOT IN ('RESOLVED','ACCEPTED_WITH_REASON') OR
    (resolved_at IS NOT NULL AND resolved_by_user_id IS NOT NULL AND btrim(resolution_reason) <> '')
  )
);

CREATE UNIQUE INDEX uq_reconciliation_exception_fingerprint
  ON reconciliation_exceptions(property_id, fingerprint);
CREATE INDEX ix_reconciliation_exception_queue
  ON reconciliation_exceptions(property_id, status, severity, last_detected_at);
CREATE INDEX ix_reconciliation_exception_check
  ON reconciliation_exceptions(property_id, check_code, business_date);

CREATE TABLE report_exports (
  id uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  report_code varchar(80) NOT NULL,
  format varchar(16) NOT NULL DEFAULT 'CSV',
  status varchar(48) NOT NULL DEFAULT 'GENERATED',
  filters jsonb NOT NULL,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Jakarta',
  metric_version varchar(32) NOT NULL,
  data_as_of timestamp with time zone NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  row_count integer NOT NULL,
  generated_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key varchar(160) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT ck_report_export_format CHECK (format = 'CSV'),
  CONSTRAINT ck_report_export_status CHECK (status IN ('GENERATED','DOWNLOADED','EXPIRED')),
  CONSTRAINT ck_report_export_rows CHECK (row_count >= 0),
  CONSTRAINT ck_report_export_expiry CHECK (expires_at > generated_at)
);

CREATE UNIQUE INDEX uq_report_export_idempotency
  ON report_exports(property_id, idempotency_key);
CREATE INDEX ix_report_export_history
  ON report_exports(property_id, generated_at, report_code);

CREATE UNIQUE INDEX uq_business_day_run_once
  ON business_day_runs(property_id, business_date, run_type);
ALTER TABLE business_day_runs
  ADD CONSTRAINT ck_business_day_run_type CHECK (run_type IN ('ROLLOVER','RECONCILIATION')),
  ADD CONSTRAINT ck_business_day_run_status CHECK (status IN ('RUNNING','COMPLETED','NEEDS_ATTENTION','FAILED'));

INSERT INTO permissions (code, module, description, sensitive)
VALUES
  ('report.view', 'reporting', 'View operational and financial reporting dashboard', false),
  ('report.export', 'reporting', 'Download privacy-masked CSV reports', true),
  ('daily_operations.manage', 'reporting', 'Run automatic business-day rollover and daily exception close', false),
  ('reconciliation.manage', 'reporting', 'Run reconciliation and manage detected exceptions', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('OWNER', 'report.view'),
  ('OWNER', 'report.export'),
  ('OWNER', 'daily_operations.manage'),
  ('OWNER', 'reconciliation.manage'),
  ('FRONT_OFFICE', 'report.view'),
  ('FRONT_OFFICE', 'report.export'),
  ('FRONT_OFFICE', 'daily_operations.manage'),
  ('FRONT_OFFICE', 'reconciliation.manage')
) AS reporting(role_code, permission_code)
JOIN roles r ON r.code = reporting.role_code
JOIN permissions p ON p.code = reporting.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
