import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const MAINTENANCE_PREVIEW_COOKIE = "kooka_maintenance_preview";

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const TOKEN_VERSION = "v1";
const MINIMUM_PASSWORD_LENGTH = 8;
const DEFAULT_DURATION_HOURS = 8;
const MAX_DURATION_HOURS = 168;

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function previewSecret(): string | null {
  const secret = process.env.MAINTENANCE_PREVIEW_SECRET?.trim();
  return secret && secret.length >= MINIMUM_PASSWORD_LENGTH ? secret : null;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isMaintenanceModeEnabled(): boolean {
  const value = process.env.SITE_MAINTENANCE_MODE;
  return value ? TRUE_VALUES.has(value.trim().toLowerCase()) : false;
}

export function isMaintenancePreviewConfigured(): boolean {
  return previewSecret() !== null;
}

export function maintenancePreviewDurationSeconds(): number {
  const parsed = Number(process.env.MAINTENANCE_PREVIEW_DURATION_HOURS);
  const hours = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_DURATION_HOURS)
    : DEFAULT_DURATION_HOURS;
  return hours * 60 * 60;
}

export function verifyMaintenancePreviewPassword(candidate: string): boolean {
  const secret = previewSecret();
  return secret !== null && safeEqual(candidate, secret);
}

export function createMaintenancePreviewToken(now = Date.now()): {
  token: string;
  expiresAt: Date;
} {
  const secret = previewSecret();
  if (!secret) throw new Error("Maintenance preview is not configured");

  const expiresAt = new Date(now + maintenancePreviewDurationSeconds() * 1_000);
  const payload = [
    TOKEN_VERSION,
    String(expiresAt.getTime()),
    randomBytes(18).toString("base64url"),
  ].join(".");

  return {
    token: `${payload}.${signature(payload, secret)}`,
    expiresAt,
  };
}

export function isValidMaintenancePreviewToken(
  token: string | null | undefined,
  now = Date.now(),
): boolean {
  const secret = previewSecret();
  if (!secret || !token) return false;

  const [version, encodedExpiry, nonce, suppliedSignature, extra] =
    token.split(".");
  if (
    version !== TOKEN_VERSION ||
    !encodedExpiry ||
    !nonce ||
    !suppliedSignature ||
    extra
  ) {
    return false;
  }

  const expiresAt = Number(encodedExpiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const payload = [version, encodedExpiry, nonce].join(".");
  return safeEqual(suppliedSignature, signature(payload, secret));
}
