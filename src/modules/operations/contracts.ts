import { AppError } from "../../platform/errors";

export interface StaffSessionLike {
  user: { id: string };
}

export type StayStatus =
  "NOT_STARTED" | "DUE_IN" | "IN_HOUSE" | "DUE_OUT" | "CHECKED_OUT" | "NO_SHOW";

export type CleaningStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "CLEANED"
  | "INSPECTED"
  | "DEFERRED"
  | "UNABLE_TO_ACCESS"
  | "CANCELLED";

const STAY_TRANSITIONS: Record<StayStatus, StayStatus[]> = {
  NOT_STARTED: ["DUE_IN", "IN_HOUSE", "NO_SHOW"],
  DUE_IN: ["IN_HOUSE", "NO_SHOW"],
  IN_HOUSE: ["DUE_OUT", "CHECKED_OUT"],
  DUE_OUT: ["IN_HOUSE", "CHECKED_OUT"],
  CHECKED_OUT: [],
  NO_SHOW: ["DUE_IN", "IN_HOUSE"],
};

const CLEANING_TRANSITIONS: Record<CleaningStatus, CleaningStatus[]> = {
  REQUESTED: [
    "ASSIGNED",
    "IN_PROGRESS",
    "DEFERRED",
    "UNABLE_TO_ACCESS",
    "CANCELLED",
  ],
  ASSIGNED: ["IN_PROGRESS", "DEFERRED", "UNABLE_TO_ACCESS", "CANCELLED"],
  IN_PROGRESS: ["CLEANED", "DEFERRED", "UNABLE_TO_ACCESS"],
  CLEANED: ["INSPECTED", "IN_PROGRESS"],
  INSPECTED: [],
  DEFERRED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  UNABLE_TO_ACCESS: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

export function assertStayTransition(from: StayStatus, to: StayStatus) {
  if (!STAY_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `Stay cannot transition from ${from} to ${to}`,
    );
  }
}

export function assertCleaningTransition(
  from: CleaningStatus,
  to: CleaningStatus,
) {
  if (!CLEANING_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "CONFLICT",
      `Cleaning task cannot transition from ${from} to ${to}`,
    );
  }
}

export function jakartaBusinessTimestamp(date: string, time: string): Date {
  const value = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(value.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid business date or time");
  }
  return value;
}

export function maskGuestName(name: string | null): string | null {
  if (!name) return null;
  return name
    .trim()
    .split(/\s+/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}***`)
    .join(" ");
}

export function calculateLedgerBalance(
  entries: Array<{ entryType: string; totalAmountIdr: string | number }>,
) {
  return entries.reduce((balance, entry) => {
    const amount = Number(entry.totalAmountIdr);
    return balance + (entry.entryType === "DEBIT" ? amount : -amount);
  }, 0);
}
