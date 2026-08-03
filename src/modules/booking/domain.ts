import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { AppError } from "../../platform/errors";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableRequestHash(value: unknown): string {
  return hashOpaque(JSON.stringify(canonicalize(value)));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function constantTimeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function generateBookingCode(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replaceAll("-", "");
  return `KR-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function generateLookupToken(): string {
  return randomBytes(32).toString("base64url");
}

export function enumerateStayDates(
  checkInDate: string,
  checkoutDate: string,
  maximumNights = 60,
): string[] {
  if (!DATE_PATTERN.test(checkInDate) || !DATE_PATTERN.test(checkoutDate)) {
    throw new AppError("VALIDATION_ERROR", "Dates must use YYYY-MM-DD");
  }
  const start = new Date(`${checkInDate}T00:00:00.000Z`);
  const end = new Date(`${checkoutDate}T00:00:00.000Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Checkout date must be after check-in date",
    );
  }
  const result: string[] = [];
  for (
    let current = start;
    current < end;
    current = new Date(current.getTime() + 86_400_000)
  ) {
    result.push(current.toISOString().slice(0, 10));
    if (result.length > maximumNights) {
      throw new AppError(
        "VALIDATION_ERROR",
        `A booking cannot exceed ${maximumNights} nights`,
      );
    }
  }
  return result;
}

export interface TaxCalculationInput {
  roomRateIdr: number;
  taxRate: number;
  serviceChargeRate: number;
  taxInclusive: boolean;
  serviceChargeInclusive: boolean;
  noTax: boolean;
}

export function calculateNightAmounts(input: TaxCalculationInput) {
  const roomRateIdr = Math.round(input.roomRateIdr);
  if (input.noTax) {
    return {
      roomRateIdr,
      netAmountIdr: roomRateIdr,
      serviceChargeIdr: 0,
      taxIdr: 0,
      totalIdr: roomRateIdr,
    };
  }
  const includedService = input.serviceChargeInclusive
    ? Math.round(
        roomRateIdr * (input.serviceChargeRate / (1 + input.serviceChargeRate)),
      )
    : 0;
  const netAmountIdr = roomRateIdr - includedService;
  const serviceChargeIdr = input.serviceChargeInclusive
    ? includedService
    : Math.round(netAmountIdr * input.serviceChargeRate);
  const taxableBase = netAmountIdr + serviceChargeIdr;
  const taxIdr = input.taxInclusive
    ? Math.round(taxableBase * (input.taxRate / (1 + input.taxRate)))
    : Math.round(taxableBase * input.taxRate);
  const totalIdr = input.taxInclusive ? taxableBase : taxableBase + taxIdr;
  return {
    roomRateIdr,
    netAmountIdr,
    serviceChargeIdr,
    taxIdr,
    totalIdr,
  };
}

export function calculateRequiredPayment(
  source: "ONLINE" | "ADMIN_MANUAL",
  totalIdr: number,
  mode: string | undefined,
  value: number | null | undefined,
): number {
  if (source === "ONLINE") return totalIdr;
  switch (mode ?? "FULL") {
    case "FIXED_DEPOSIT":
      return Math.min(totalIdr, Math.max(0, Math.round(value ?? 0)));
    case "PERCENTAGE_DEPOSIT":
      return Math.min(
        totalIdr,
        Math.max(0, Math.round(totalIdr * ((value ?? 0) / 100))),
      );
    case "PAY_AT_CHECKIN":
    case "PAY_AT_CHECKOUT":
      return 0;
    default:
      return totalIdr;
  }
}
