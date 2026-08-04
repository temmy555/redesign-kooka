const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface MutationRequestSecurityInput {
  method: string;
  requestOrigin: string;
  configuredOrigin?: string | null;
  originHeader?: string | null;
  secFetchSite?: string | null;
}

function normalizedOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Browser CSRF boundary for cookie-authenticated staff mutations. Session and
 * named-permission checks remain mandatory inside every route/service; this
 * additional layer rejects cross-site browser requests before they reach them.
 * Requests without browser fetch metadata remain possible for controlled
 * server-to-server tooling and are still subject to authentication/RBAC.
 */
export function isTrustedStaffMutation(
  input: MutationRequestSecurityInput,
): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
  if (input.secFetchSite === "cross-site") return false;

  const origin = normalizedOrigin(input.originHeader);
  if (!origin) return input.originHeader == null;

  const allowed = new Set(
    [input.requestOrigin, input.configuredOrigin]
      .map(normalizedOrigin)
      .filter((value): value is string => Boolean(value)),
  );
  return allowed.has(origin);
}
