import ExcelJS from "exceljs";

export type ExcelCellValue = string | number | null | undefined;

export type ExcelWorkbookInput = {
  sheetName: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: ExcelCellValue[][];
  columnWidths?: number[];
};

function safeSheetName(value: string) {
  return value.slice(0, 31).replace(/[\\/*?:[\]]/gu, "-") || "Laporan";
}

function borderStyle(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = {
    style: "thin",
    color: { argb: "FFD8DED8" },
  };
  return { top: side, left: side, bottom: side, right: side };
}

function workbookBytes(value: ExcelJS.Buffer) {
  const bytes = new Uint8Array(value);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function createExcelWorkbook(
  input: ExcelWorkbookInput,
): Promise<ArrayBuffer> {
  if (!input.headers.length)
    throw new Error("Excel workbook requires at least one column");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KOOKA Residence Surabaya";
  workbook.lastModifiedBy = "KOOKA Residence Surabaya";
  workbook.company = "KOOKA Residence Surabaya";
  workbook.subject = input.title;
  workbook.title = input.title;
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet(safeSheetName(input.sheetName), {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5" }],
    pageSetup: {
      orientation: input.headers.length > 6 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
    properties: { defaultRowHeight: 15 },
  });

  input.headers.forEach((_, index) => {
    worksheet.getColumn(index + 1).width = Math.max(
      8,
      input.columnWidths?.[index] ?? 18,
    );
  });

  const titleRow = worksheet.addRow([input.title]);
  const subtitleRow = worksheet.addRow([input.subtitle ?? ""]);
  worksheet.addRow([]);
  const headerRow = worksheet.addRow(input.headers);
  for (const values of input.rows)
    worksheet.addRow(input.headers.map((_, index) => values[index] ?? ""));

  const lastColumn = input.headers.length;
  worksheet.mergeCells(1, 1, 1, lastColumn);
  worksheet.mergeCells(2, 1, 2, lastColumn);
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, worksheet.rowCount), column: lastColumn },
  };

  titleRow.height = 24;
  titleRow.getCell(1).font = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: "FF123F35" },
  };
  subtitleRow.getCell(1).alignment = {
    vertical: "middle",
    wrapText: true,
  };
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF123F35" },
    };
    cell.border = borderStyle();
    cell.alignment = { vertical: "middle" };
  });

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 4) return;
    row.alignment = { vertical: "top", wrapText: true };
  });

  const output = await workbook.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true,
  });
  return workbookBytes(output);
}
