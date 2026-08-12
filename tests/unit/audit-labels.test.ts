import { describe, expect, it } from "vitest";

import { auditActionLabel } from "../../src/platform/audit-labels";

describe("auditActionLabel", () => {
  it("uses clear operational labels for common commercial actions", () => {
    expect(auditActionLabel("commercial.rate_plan.publish")).toBe(
      "Tarif kamar diterbitkan",
    );
    expect(auditActionLabel("commercial.document_profile.version.create")).toBe(
      "Profil invoice & kuitansi diperbarui",
    );
  });

  it("uses clear operational labels for room actions", () => {
    expect(auditActionLabel("ROOM_MARKED_READY")).toBe("Kamar ditandai siap");
    expect(auditActionLabel("ROOM_CLEANING_STARTED")).toBe(
      "Pembersihan kamar dimulai",
    );
  });

  it("converts known structured actions without exposing technical codes", () => {
    expect(auditActionLabel("room_master.room_type.version.create")).toBe(
      "Jenis kamar diperbarui",
    );
    expect(auditActionLabel("attendance.location.update")).toBe(
      "Titik absensi diperbarui",
    );
  });

  it("still makes an unknown action readable", () => {
    expect(auditActionLabel("NEW_OPERATION_STARTED")).toBe(
      "New operation dimulai",
    );
    expect(auditActionLabel("")).toBe("Aktivitas sistem");
  });
});
