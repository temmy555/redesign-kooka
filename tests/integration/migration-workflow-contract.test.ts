import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("database migration workflow contract", () => {
  it("orders generated SQL before hard constraints", async () => {
    const manifest = await readFile(
      new URL("../../database/migrations/manifest.mjs", import.meta.url),
      "utf8",
    );

    expect(manifest.indexOf("0000_vengeful_raider")).toBeLessThan(
      manifest.indexOf("0001_hard_constraints"),
    );
    expect(manifest.indexOf("0001_hard_constraints")).toBeLessThan(
      manifest.indexOf("0002_whole_rupiah_amounts"),
    );
    expect(manifest.indexOf("0002_whole_rupiah_amounts")).toBeLessThan(
      manifest.indexOf("0003_auth_contract_alignment"),
    );
    expect(manifest.indexOf("0003_auth_contract_alignment")).toBeLessThan(
      manifest.indexOf("0004_two_factor_foundation"),
    );
    expect(manifest.indexOf("0004_two_factor_foundation")).toBeLessThan(
      manifest.indexOf("0005_rbac_baseline_catalog"),
    );
    expect(manifest).toContain("drizzle/0000_vengeful_raider.sql");
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0001_hard_constraints.sql",
    );
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0002_whole_rupiah_amounts.sql",
    );
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0003_auth_contract_alignment.sql",
    );
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0004_two_factor_foundation.sql",
    );
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0005_rbac_baseline_catalog.sql",
    );
    expect(manifest.indexOf("0012_reporting_daily_operations")).toBeLessThan(
      manifest.indexOf("0013_owner_super_admin_alignment"),
    );
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0013_owner_super_admin_alignment.sql",
    );
    expect(manifest.indexOf("0013_owner_super_admin_alignment")).toBeLessThan(
      manifest.indexOf("0014_financial_document_render_guard"),
    );
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0014_financial_document_render_guard.sql",
    );
    expect(
      manifest.indexOf("0014_financial_document_render_guard"),
    ).toBeLessThan(manifest.indexOf("0015_attendance_location_configuration"));
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0015_attendance_location_configuration.sql",
    );
    expect(
      manifest.indexOf("0015_attendance_location_configuration"),
    ).toBeLessThan(manifest.indexOf("0016_attendance_event_persistence"));
    expect(manifest).toContain(
      "database/migrations/after-drizzle/0016_attendance_event_persistence.sql",
    );
  });

  it("guards one active attendance session per employee business date", async () => {
    const attendance = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0016_attendance_event_persistence.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(attendance).toContain(
      "uq_attendance_session_employee_business_date_active",
    );
    expect(attendance).toContain("WHERE status <> 'VOIDED'");
    expect(attendance).toContain("ix_attendance_events_employee_time");
    expect(attendance).toContain("ck_attendance_event_status");
  });

  it("adds effective attendance locations and dedicated permissions", async () => {
    const attendance = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0015_attendance_location_configuration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(attendance).toContain("effective_from timestamptz");
    expect(attendance).toContain("ck_attendance_location_effective_period");
    expect(attendance).toContain("attendance.location.manage");
    expect(attendance).toContain("attendance.report.view");
    expect(attendance).toContain("('OWNER', 'attendance.location.manage')");
    expect(attendance).toContain(
      "('FRONT_OFFICE', 'attendance.location.manage')",
    );
  });

  it("keeps financial document versions immutable except for their first rendered PDF", async () => {
    const guard = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0014_financial_document_render_guard.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(guard).toContain("OLD.rendered_file_id IS NULL");
    expect(guard).toContain("NEW.rendered_file_id IS NOT NULL");
    expect(guard).toContain("to_jsonb(NEW) - 'rendered_file_id'");
    expect(guard).toContain(
      "CREATE TRIGGER trg_financial_document_versions_immutable",
    );
  });

  it("aligns Owner as Super Admin through named permissions without an authorization bypass", async () => {
    const alignment = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0013_owner_super_admin_alignment.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(alignment).toContain("CROSS JOIN permissions");
    expect(alignment).toContain("owner_role.code = 'OWNER'");
    expect(alignment).toContain(
      "ON CONFLICT (role_id, permission_id) DO NOTHING",
    );
  });

  it("seeds the RBAC baseline catalog idempotently and scopes Owner to governance permissions", async () => {
    const catalog = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0005_rbac_baseline_catalog.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(catalog).toContain("ON CONFLICT (code) DO NOTHING");
    expect(catalog).toContain(
      "ON CONFLICT (role_id, permission_id) DO NOTHING",
    );

    // Sensitive field/file permissions are catalogued but deliberately not
    // granted to any baseline role (Owner must grant them selectively).
    for (const sensitiveCode of [
      "guest.identity_document.view",
      "guest.signature.view",
      "payment.evidence.view",
      "attendance.selfie.view",
      "data.export",
    ]) {
      expect(catalog).toContain(`'${sensitiveCode}'`);
    }
    const roleMappingSection = catalog.slice(
      catalog.indexOf("INSERT INTO role_permissions"),
    );
    for (const sensitiveCode of [
      "guest.identity_document.view",
      "guest.signature.view",
      "payment.evidence.view",
      "attendance.selfie.view",
      "data.export",
    ]) {
      expect(roleMappingSection).not.toContain(sensitiveCode);
    }

    // Owner's baseline is governance-only, not operational permissions.
    expect(roleMappingSection).not.toMatch(/\('OWNER', 'booking\.manage'\)/);
    expect(roleMappingSection).not.toMatch(/\('OWNER', 'payment\.manage'\)/);
  });

  it("aligns the staff-auth tables with Better Auth's default field contract", async () => {
    const alignment = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0003_auth_contract_alignment.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(alignment).toContain(
      "ALTER TABLE auth_sessions RENAME COLUMN token_hash TO token;",
    );
    expect(alignment).toContain(
      "ALTER TABLE auth_verifications RENAME COLUMN value_hash TO value;",
    );
    expect(alignment).toContain(
      "ALTER TABLE auth_accounts RENAME COLUMN provider_account_id TO account_id;",
    );

    const schema = await readFile(
      new URL("../../src/db/schema/identity.ts", import.meta.url),
      "utf8",
    );

    expect(schema).toContain('token: varchar("token"');
    expect(schema).toContain('value: varchar("value"');
    expect(schema).toContain('accountId: varchar("account_id"');
    expect(schema).not.toContain("tokenHash");
    expect(schema).not.toContain("valueHash");
  });

  it("guards every official IDR amount column against fractional rupiah", async () => {
    const wholeRupiah = await readFile(
      new URL(
        "../../database/migrations/after-drizzle/0002_whole_rupiah_amounts.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const generated = await readFile(
      new URL("../../drizzle/0000_vengeful_raider.sql", import.meta.url),
      "utf8",
    );

    const guards = [
      ...wholeRupiah.matchAll(
        /ADD CONSTRAINT \S+\s+CHECK \((\w+) = trunc\(\1\)\);/g,
      ),
    ];
    expect(guards).toHaveLength(39);

    // Every numeric(18,2) column is an official IDR amount except the USD/AUD
    // display estimate, which is allowed to carry decimals.
    const moneyColumns = [...generated.matchAll(/"(\w+)" numeric\(18, 2\)/g)]
      .length;
    expect(moneyColumns).toBe(40);
    expect(wholeRupiah).toContain("booking_quotes.display_total");
    expect(wholeRupiah).not.toMatch(/CHECK \(display_total = trunc/);
  });

  it("requires explicit test reset guards and blocks production migration", async () => {
    const runner = await readFile(
      new URL("../../scripts/lib/database-migrations.mjs", import.meta.url),
      "utf8",
    );

    expect(runner).toContain('environment.APP_ENV === "production"');
    expect(runner).toContain('environment.APP_ENV !== "test"');
    expect(runner).toContain('environment.ALLOW_DATABASE_RESET !== "YES"');
    expect(runner).toContain("pg_advisory_lock");
    expect(runner).toContain("Applied migration checksum changed");
  });
});
