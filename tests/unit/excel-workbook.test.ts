import { describe, expect, it } from "vitest";

import { createExcelWorkbook } from "../../src/platform/excel-workbook";

describe("Excel workbook export", () => {
  it("creates a standards-compatible XLSX workbook", async () => {
    const workbook = await createExcelWorkbook({
      sheetName: "Absensi",
      title: "Laporan Absensi",
      subtitle: "3 Agustus 2026",
      headers: ["Karyawan", "Durasi"],
      rows: [["Temmy & Tim <KOOKA>", 480]],
    });
    const bytes = new Uint8Array(workbook);

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const parsed = new (await import("exceljs")).default.Workbook();
    await parsed.xlsx.load(workbook);
    const worksheet = parsed.getWorksheet("Absensi");
    expect(worksheet?.getCell("A5").value).toBe("Temmy & Tim <KOOKA>");
    expect(worksheet?.getCell("B5").value).toBe(480);
  });
});
