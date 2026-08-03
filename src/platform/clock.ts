/**
 * Clock/business-date service (Roadmap Langkah 8). No `server-only` marker:
 * this is pure date arithmetic, safe to import from client code too (e.g.
 * to render a business-date label) without pulling in a database import.
 *
 * "Business date" here is the hospitality-operations sense used throughout
 * the PRD (§19.1): the operating day used for due-in/due-out, housekeeping,
 * and daily-close reconciliation, which is *not* the same as the calendar
 * date at midnight. Per PRD §19.1: "Business date menggunakan Asia/Jakarta
 * dengan automatic rollover rekomendasi awal pukul 04:00 yang dapat
 * dikonfigurasi." -- 04:00 is only the recommended default; the actual
 * production rollover hour is a versioned configuration value that belongs
 * to Roadmap Langkah 9 (property/configuration admin), not this module.
 * `getBusinessDate` therefore takes the rollover hour as an explicit
 * parameter rather than hardcoding or reading it from anywhere, so callers
 * are never silently wrong about which value they're using.
 */

export const PROPERTY_TIMEZONE = "Asia/Jakarta";
export const DEFAULT_BUSINESS_DATE_ROLLOVER_HOUR = 4;

export function nowUtc(): Date {
  return new Date();
}

/**
 * Formats an instant as a `YYYY-MM-DD` calendar date in the property's
 * timezone. This is a plain calendar-date view of the instant -- it does
 * NOT apply the business-date rollover; use `getBusinessDate` for that.
 */
export function toJakartaDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PROPERTY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function toJakartaTimeString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PROPERTY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(instant);
}

/**
 * Resolves the operating business date for `instant`: the Jakarta calendar
 * date, shifted back one day if the Jakarta local time is still before
 * `rolloverHour` (e.g. at 04:00 rollover, 02:00 local time on the 5th is
 * still business date the 4th).
 */
export function getBusinessDate(
  instant: Date = new Date(),
  rolloverHour: number = DEFAULT_BUSINESS_DATE_ROLLOVER_HOUR,
): string {
  if (
    !Number.isInteger(rolloverHour) ||
    rolloverHour < 0 ||
    rolloverHour > 23
  ) {
    throw new Error(
      `rolloverHour must be an integer 0-23, got ${rolloverHour}`,
    );
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PROPERTY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  // Intl formats midnight as "24" with hour12: false in some engines; treat
  // that the same as hour 0 of the *next* calendar day it represents.
  const rawHour = get("hour");
  const hour = rawHour === "24" ? 0 : Number(rawHour);

  if (!year || !month || !day || rawHour === undefined) {
    throw new Error("Failed to resolve Jakarta local time parts");
  }

  const localDateUtcMidnight = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );

  if (hour < rolloverHour) {
    localDateUtcMidnight.setUTCDate(localDateUtcMidnight.getUTCDate() - 1);
  }

  return localDateUtcMidnight.toISOString().slice(0, 10);
}
