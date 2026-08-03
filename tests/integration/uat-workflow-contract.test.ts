import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};
const script = readFileSync("scripts/uat.mjs", "utf8");
const environment = readFileSync("scripts/lib/uat-environment.mjs", "utf8");

describe("Phase 1 UAT workflow contract", () => {
  it("provides explicit prepare, verify, clean, reset, and isolated dev commands", () => {
    expect(packageJson.scripts["uat:prepare"]).toContain("uat.mjs prepare");
    expect(packageJson.scripts["uat:verify"]).toContain("uat.mjs verify");
    expect(packageJson.scripts["uat:reset"]).toContain("uat.mjs reset");
    expect(packageJson.scripts["uat:clean"]).toContain("uat.mjs clean");
    expect(packageJson.scripts["uat:credentials:rotate"]).toContain(
      "uat.mjs rotate",
    );
    expect(packageJson.scripts["dev:uat"]).toContain("dev-uat.mjs");
    expect(readFileSync("scripts/dev-uat.mjs", "utf8")).toContain(
      'scripts", "worker.mjs',
    );
  });

  it("seeds an effective document profile for PDF invoice testing", () => {
    expect(script).toContain("DEFAULT-UAT");
    expect(script).toContain("document_profile_versions");
    expect(script).toContain("documentProfileReady");
  });

  it("restricts destructive reset to a marked local UAT database", () => {
    expect(environment).toContain('uatDatabaseName = "kooka_phase1_uat_test"');
    expect(environment).toContain("assertLocalUatTarget");
    expect(script).toContain('process.env.ALLOW_UAT_RESET !== "YES"');
    expect(script).toContain("UAT marker property was not found");
    expect(script).toContain("Clean start requires ALLOW_UAT_RESET=YES");
    expect(script).toContain(
      "UAT marker property was not found; clean start refused",
    );
  });

  it("supports a clean UAT start without deleting master data", () => {
    expect(script).toContain("TRUNCATE TABLE");
    expect(script).toContain("food_orders");
    expect(script).toContain("cleaning_tasks");
    expect(script).toContain("occupancy_status = 'VACANT'");
    expect(script).toContain("housekeeping_status = 'INSPECTED'");
    expect(script).toContain("serviceability_status = 'IN_SERVICE'");
    expect(script).toContain('mode: "CLEAN_START"');
  });

  it("uses only synthetic identities and ordinary password login", () => {
    expect(script).toContain("@kooka.example.invalid");
    expect(script).not.toContain("mfaEnrollmentRequired");
    expect(script).not.toContain("ownerAndFrontOfficeMfaPending");
    expect(script).not.toContain("@kookaresidencesby.com");
  });

  it("verifies required fixtures without rejecting additional UAT data", () => {
    expect(script).toContain("AS fixture_rooms");
    expect(script).toContain("AS fixture_room_types");
    expect(script).toContain("AS fixture_reservations");
    expect(script).toContain("AS fixture_cleaning_tasks");
    expect(script).toContain("AS fixture_menu_items");
    expect(script).not.toContain(
      `FROM room_units WHERE property_id = '\${ids.property}'`,
    );
  });
});
