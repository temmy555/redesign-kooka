export type ExcelCellValue = string | number | null | undefined;

export type ExcelWorkbookInput = {
  sheetName: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: ExcelCellValue[][];
  columnWidths?: number[];
};

const encoder = new TextEncoder();

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function cell(reference: string, value: ExcelCellValue, style = 0) {
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  const normalized = value === null || value === undefined ? "" : String(value);
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(normalized)}</t></is></c>`;
}

function rowXml(rowNumber: number, values: ExcelCellValue[], style = 0) {
  return `<row r="${rowNumber}">${values
    .map((value, index) =>
      cell(`${columnName(index + 1)}${rowNumber}`, value, style),
    )
    .join("")}</row>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function header(length: number) {
  return new Uint8Array(length);
}

function uint16(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer).setUint16(offset, value, true);
}

function uint32(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer).setUint32(offset, value, true);
}

function zip(files: Array<{ name: string; content: string }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const local = header(30);
    uint32(local, 0, 0x04034b50);
    uint16(local, 4, 20);
    uint16(local, 6, 0x0800);
    uint16(local, 8, 0);
    uint32(local, 14, checksum);
    uint32(local, 18, data.length);
    uint32(local, 22, data.length);
    uint16(local, 26, name.length);
    localParts.push(local, name, data);

    const central = header(46);
    uint32(central, 0, 0x02014b50);
    uint16(central, 4, 20);
    uint16(central, 6, 20);
    uint16(central, 8, 0x0800);
    uint16(central, 10, 0);
    uint32(central, 16, checksum);
    uint32(central, 20, data.length);
    uint32(central, 24, data.length);
    uint16(central, 28, name.length);
    uint32(central, 42, localOffset);
    centralParts.push(central, name);
    localOffset += local.length + name.length + data.length;
  }

  const central = concat(centralParts);
  const end = header(22);
  uint32(end, 0, 0x06054b50);
  uint16(end, 8, files.length);
  uint16(end, 10, files.length);
  uint32(end, 12, central.length);
  uint32(end, 16, localOffset);
  return concat([...localParts, central, end]);
}

export function createExcelWorkbook(input: ExcelWorkbookInput): ArrayBuffer {
  if (!input.headers.length)
    throw new Error("Excel workbook requires at least one column");
  const lastColumn = columnName(input.headers.length);
  const lastRow = input.rows.length + 4;
  const columns = input.headers
    .map((_, index) => {
      const width = Math.max(8, input.columnWidths?.[index] ?? 18);
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>
    ${rowXml(1, [input.title], 2)}
    ${rowXml(2, [input.subtitle ?? ""], 3)}
    ${rowXml(3, [])}
    ${rowXml(4, input.headers, 1)}
    ${input.rows.map((values, index) => rowXml(index + 5, values)).join("\n")}
  </sheetData>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
  <autoFilter ref="A4:${lastColumn}${Math.max(4, lastRow)}"/>
</worksheet>`;
  const safeSheetName = input.sheetName
    .slice(0, 31)
    .replace(/[\\/*?:[\]]/gu, "-");
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(safeSheetName || "Laporan")}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF123F35"/><sz val="16"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123F35"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD8DED8"/></left><right style="thin"><color rgb="FFD8DED8"/></right><top style="thin"><color rgb="FFD8DED8"/></top><bottom style="thin"><color rgb="FFD8DED8"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: worksheet },
  ];
  const output = zip(files);
  return output.buffer.slice(
    output.byteOffset,
    output.byteOffset + output.byteLength,
  ) as ArrayBuffer;
}
