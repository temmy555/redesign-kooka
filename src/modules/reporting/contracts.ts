import { AppError } from "../../platform/errors";

export const REPORT_TIMEZONE = "Asia/Jakarta";
export const REPORT_METRIC_VERSION = "phase1-v1";
export const DASHBOARD_MAX_DAYS = 31;
export const EXPORT_MAX_DAYS = 366;
export const EXPORT_MAX_ROWS = 10_000;

export type ReportCode =
  | "DAILY_OPERATIONS"
  | "BOOKINGS"
  | "FINANCIAL_LEDGER"
  | "CLEANING"
  | "RECONCILIATION";

export type ReconciliationAction =
  "ACKNOWLEDGE" | "INVESTIGATE" | "RESOLVE" | "ACCEPT_WITH_REASON";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDateRange(
  start: string,
  end: string,
  maximumDays: number,
) {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end))
    throw new AppError("VALIDATION_ERROR", "Dates must use YYYY-MM-DD");
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime < startTime
  )
    throw new AppError("VALIDATION_ERROR", "Invalid report date range");
  const days = Math.floor((endTime - startTime) / 86_400_000) + 1;
  if (days > maximumDays)
    throw new AppError(
      "VALIDATION_ERROR",
      `Date range cannot exceed ${maximumDays} days`,
    );
  return days;
}

export function maskNameForExport(value: string | null): string {
  if (!value?.trim()) return "";
  return value
    .trim()
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}***`)
    .join(" ");
}

function safeCsvCell(value: unknown): string {
  let normalized = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  if (/[",\r\n]/.test(normalized))
    normalized = `"${normalized.replaceAll('"', '""')}"`;
  return normalized;
}

export function serializeCsv(
  rows: Array<Record<string, unknown>>,
  columns?: string[],
): string {
  const headers = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [headers.map(safeCsvCell).join(",")];
  for (const row of rows)
    lines.push(headers.map((header) => safeCsvCell(row[header])).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function statusForReconciliationAction(action: ReconciliationAction) {
  if (action === "ACKNOWLEDGE") return "ACKNOWLEDGED" as const;
  if (action === "INVESTIGATE") return "INVESTIGATING" as const;
  if (action === "RESOLVE") return "RESOLVED" as const;
  return "ACCEPTED_WITH_REASON" as const;
}
