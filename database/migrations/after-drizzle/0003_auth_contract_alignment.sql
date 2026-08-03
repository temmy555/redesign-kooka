-- Run after the whole-rupiah batch.
-- Aligns the staff-auth tables with Better Auth 1.6.25's default field
-- contract (Roadmap Langkah 6).
--
-- Rationale: `auth_sessions.token_hash` and `auth_verifications.value_hash`
-- were named as if the session token and verification value were hashed at
-- rest. Better Auth's own internal adapter generates and stores these values
-- as plaintext (see `internal-adapter.mjs` createSession/createVerificationValue)
-- and provides no built-in hook point to hash them without corrupting the
-- value returned to the caller that sets the session cookie or emails the
-- verification link. Rather than storing a plaintext value in a column
-- dishonestly named "*_hash", the columns are renamed to match Better Auth's
-- audited default posture. Protection for these values relies on
-- HttpOnly/Secure/SameSite cookies, TLS in transit, a private (non-public)
-- database, and short expiry/single-use consumption for verification values
-- -- not at-rest hashing. `auth_accounts.provider_account_id` is renamed to
-- `account_id` to match Better Auth's `account.accountId` field name; the
-- column already stored a provider-scoped account identifier so no meaning
-- changes. `auth_accounts.password_hash` is unchanged: Better Auth hashes
-- the credential itself (scrypt by default) before handing the string to the
-- adapter, so that column name already reflects reality.

ALTER TABLE auth_sessions RENAME COLUMN token_hash TO token;
ALTER INDEX uq_auth_sessions_token_hash RENAME TO uq_auth_sessions_token;

ALTER TABLE auth_verifications RENAME COLUMN value_hash TO value;
ALTER TABLE auth_verifications ALTER COLUMN value TYPE varchar(512);

-- Better Auth's internal adapter updates verification rows in place
-- (updateVerificationByIdentifier), so the model needs updatedAt like every
-- other Better Auth table, even though KOOKA's own audit tables are
-- append-only.
ALTER TABLE auth_verifications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE auth_accounts RENAME COLUMN provider_account_id TO account_id;
