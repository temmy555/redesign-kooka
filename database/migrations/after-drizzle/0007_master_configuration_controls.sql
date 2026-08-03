-- Roadmap Batch 1 (Langkah 9-11): configuration, room master, and
-- commercial-master lifecycle controls. This batch deliberately creates no
-- production room, rate, tax, bank, or policy data.

ALTER TABLE tax_profile_versions
  ADD COLUMN approval_status varchar(48) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reason text;

ALTER TABLE policy_versions
  ADD COLUMN reason text;

ALTER TABLE payment_instruction_versions
  ADD COLUMN approval_status varchar(48) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reason text;

ALTER TABLE document_profile_versions
  ADD COLUMN approval_status varchar(48) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reason text;

ALTER TABLE room_type_versions
  ADD COLUMN approval_status varchar(48) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN approved_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reason text;

ALTER TABLE rate_plan_versions
  ADD COLUMN approval_status varchar(48) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN approved_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reason text;

ALTER TABLE property_setting_versions
  ADD CONSTRAINT ck_property_setting_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_property_setting_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE policy_versions
  ADD CONSTRAINT ck_policy_versions_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_policy_versions_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE rate_rules
  ADD COLUMN rule_type varchar(32) NOT NULL DEFAULT 'BASE',
  ADD CONSTRAINT ck_rate_rule_type
    CHECK (rule_type IN ('BASE', 'WEEK_PATTERN', 'SEASONAL', 'SPECIAL_DATE'));

ALTER TABLE tax_profile_versions
  ADD CONSTRAINT ck_tax_profile_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_tax_profile_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED')),
  ADD CONSTRAINT ck_tax_profile_no_tax
    CHECK (NOT no_tax OR (tax_rate = 0 AND service_charge_rate = 0));

ALTER TABLE payment_instruction_versions
  ADD CONSTRAINT ck_payment_instruction_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_payment_instruction_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE document_profile_versions
  ADD CONSTRAINT ck_document_profile_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_document_profile_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE room_type_versions
  ADD CONSTRAINT ck_room_type_version_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_room_type_version_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE rate_plan_versions
  ADD CONSTRAINT ck_rate_plan_version_lifecycle
    CHECK (lifecycle_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT ck_rate_plan_version_approval
    CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE room_type_versions
  ADD CONSTRAINT ex_room_type_versions_no_overlap
  EXCLUDE USING gist (
    room_type_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE rate_plan_versions
  ADD CONSTRAINT ex_rate_plan_versions_no_overlap
  EXCLUDE USING gist (
    rate_plan_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE (lifecycle_status IN ('SCHEDULED', 'ACTIVE'));

ALTER TABLE rate_rules DROP CONSTRAINT ck_rate_rule_amount;
ALTER TABLE rate_rules
  ADD CONSTRAINT ck_rate_rule_amount CHECK (nightly_rate_idr > 0);

ALTER TABLE rate_rule_dates DROP CONSTRAINT ck_rate_rule_date_amount;
ALTER TABLE rate_rule_dates
  ADD CONSTRAINT ck_rate_rule_date_amount CHECK (nightly_rate_idr > 0);

CREATE INDEX ix_payment_instruction_versions_effective
  ON payment_instruction_versions (instruction_set_id, lifecycle_status, effective_from);
CREATE INDEX ix_document_profile_versions_effective
  ON document_profile_versions (document_profile_id, lifecycle_status, effective_from);
CREATE INDEX ix_rate_plan_versions_effective
  ON rate_plan_versions (rate_plan_id, lifecycle_status, effective_from);
CREATE UNIQUE INDEX uq_exchange_rate_snapshot_source_time
  ON exchange_rate_snapshots (property_id, quote_currency, as_of_at);

INSERT INTO permissions (code, module, description, sensitive)
VALUES
  ('configuration.view', 'configuration', 'View resolved property configuration and version history', false),
  ('configuration.manage', 'configuration', 'Create and schedule property configuration versions', false),
  ('configuration.approve', 'configuration', 'Approve or reject high-risk property configuration changes', true),
  ('room_master.view', 'room_master', 'View room, room type, amenity, occupancy, and resource master data', false),
  ('room_master.manage', 'room_master', 'Manage room, room type, amenity, occupancy, and resource master data', false),
  ('commercial.view', 'commercial', 'View rate, tax, policy, payment instruction, document, and display-currency master data', false),
  ('commercial.manage', 'commercial', 'Create and schedule commercial master versions', false),
  ('commercial.approve', 'commercial', 'Approve or reject high-risk commercial master changes', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('OWNER', 'configuration.view'),
  ('OWNER', 'configuration.manage'),
  ('OWNER', 'configuration.approve'),
  ('OWNER', 'room_master.view'),
  ('OWNER', 'room_master.manage'),
  ('OWNER', 'commercial.view'),
  ('OWNER', 'commercial.manage'),
  ('OWNER', 'commercial.approve'),
  ('FRONT_OFFICE', 'configuration.view'),
  ('FRONT_OFFICE', 'configuration.manage'),
  ('FRONT_OFFICE', 'room_master.view'),
  ('FRONT_OFFICE', 'room_master.manage'),
  ('FRONT_OFFICE', 'commercial.view'),
  ('FRONT_OFFICE', 'commercial.manage')
) AS baseline(role_code, permission_code)
JOIN roles r ON r.code = baseline.role_code
JOIN permissions p ON p.code = baseline.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;
