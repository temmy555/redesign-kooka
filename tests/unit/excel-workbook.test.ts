import { describe, expect, it } from "vitest";

import { createExcelWorkbook } from "../../src/platform/excel-workbook";

describe("Excel workbook export", () => {
  it("creates a real XLSX container with escaped attendance values", () => {
    const workbook = createExcelWorkbook({
      sheetName: "Absensi",
      title: "Laporan Absensi",
      subtitle: "3 Agustus 2026",
      headers: ["Karyawan", "Durasi"],
      rows: [["Temmy & Tim <KOOKA>", 480]],
    });
    const bytes = new Uint8Array(workbook);
    const storedXml = new TextDecoder().decode(bytes);

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(storedXml).toContain("xl/worksheets/sheet1.xml");
    expect(storedXml).toContain("Temmy &amp; Tim &lt;KOOKA&gt;");
    expect(storedXml).toContain("<v>480</v>");
  });
});
