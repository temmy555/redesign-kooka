/**
 * Shared sensitive-field redaction (Roadmap Langkah 8), used by both the
 * structured logger and the audit writer so the two surfaces can't drift
 * apart. Per docs/SECURITY-PRIVACY-RETENTION.md §8: "Audit tidak menyimpan
 * secret, password, OTP, full identity number, signature content, bank
 * account penuh, atau file body." and §4: "Highly Sensitive content tidak
 * masuk analytics payload, URL/query string, browser log, generic
 * application log, ... atau error tracking."
 *
 * This is deliberately a key-name denylist, not a value-shape scanner: it
 * cannot catch a KTP number stored under an unrelated key name. It is a
 * baseline safety net, not a substitute for callers choosing what they
 * pass into a log/audit payload in the first place.
 */

const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "secret",
  "token",
  "otp",
  "apikey",
  "api_key",
  "creditcard",
  "credit_card",
  "cvv",
  "cvc",
  "identitynumber",
  "identity_number",
  "ktp",
  "passport",
  "nik",
  "signature",
  "bankaccount",
  "bank_account",
  "accountnumber",
  "account_number",
  "filebody",
  "file_body",
  "filecontent",
  "file_content",
  "base64",
  "authorization",
  "cookie",
  "privatekey",
  "private_key",
  "refreshcredential",
  "refresh_credential",
] as const;

export const REDACTED_VALUE = "[redacted]";

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => normalized.includes(needle));
}

/**
 * Deep-clones `value`, replacing any object property whose key name looks
 * sensitive with `REDACTED_VALUE`. Non-plain-object values (Date, etc.)
 * inside the tree are passed through as-is rather than walked further.
 */
export function redactSensitiveFields<T>(value: T): T {
  return redact(value, new WeakSet<object>()) as T;
}

function redactSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);
    let changed = false;
    for (const key of url.searchParams.keys()) {
      if (isSensitiveKey(key) || key.toLowerCase().includes("code")) {
        url.searchParams.set(key, REDACTED_VALUE);
        changed = true;
      }
    }
    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}

function redact(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactSensitiveUrl(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED_VALUE : redact(val, seen);
  }
  return result;
}
