-- Run after the auth-contract-alignment batch.
-- MFA foundation for Roadmap Langkah 6: adds the columns/table the Better
-- Auth `twoFactor` plugin needs. This batch only makes the mechanism
-- available; per-role mandatory enrollment (Owner/Super Admin, Front Office)
-- and any enrollment UI are RBAC/employee-onboarding work for Langkah 7.

ALTER TABLE users
  ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE two_factor_credentials (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  verified boolean NOT NULL DEFAULT true,
  failed_verification_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  version integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_two_factor_credentials_user ON two_factor_credentials USING btree (user_id);
CREATE INDEX ix_two_factor_credentials_secret ON two_factor_credentials USING btree (secret);
