import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { safeCell, unsafeCell } from "@/lib/csv-schema";

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 10_000;

const cellText = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v);
};

/** An uploaded .csv or .xlsx as a grid of text (first row = headers). Throws a readable Error. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_BYTES) throw new Error("The file is larger than 10 MB. Split it into smaller files.");
  const name = file.name.toLowerCase();
  let grid: string[][];

  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load((await file.arrayBuffer()) as ExcelJS.Buffer);
    } catch {
      throw new Error("That doesn't look like a valid Excel (.xlsx) file.");
    }
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error("The workbook has no sheets.");
    grid = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value).trim());
      grid.push(cells);
    });
  } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = (await file.text()).replace(/^﻿/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    // A stray quotation mark makes a CSV reader swallow the rows after it, so refuse such a file instead of importing half of it.
    const broken = parsed.errors.find((e) => e.type === "Quotes");
    if (broken) throw new Error(`Row ${(broken.row ?? 0) + 1} has a quotation mark that is never closed, so the rows after it can't be read. Fix that row in your file (put quotes around text that contains commas) and try again.`);
    grid = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
  } else {
    throw new Error("Upload a .csv or .xlsx file.");
  }

  grid = grid.map((r) => r.map(unsafeCell));
  if (grid.length < 2) throw new Error("The file needs a header row and at least one data row.");
  if (grid.length - 1 > MAX_ROWS) throw new Error(`The file has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  return grid;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return "﻿" + Papa.unparse({ fields: headers, data: rows.map((r) => r.map(safeCell)) }, { newline: "\r\n" });
}

export async function toXlsx(sheetName: string, headers: string[], rows: (string | number | null | undefined)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "deboTrack";
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.addRow(headers).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) ws.addRow(r.map((c) => (typeof c === "number" ? c : safeCell(c))));
  ws.columns.forEach((col, i) => {
    const longest = Math.max(headers[i]?.length ?? 8, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length));
    col.width = Math.min(40, Math.max(10, longest + 2));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
