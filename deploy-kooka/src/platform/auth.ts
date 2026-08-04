import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDatabase } from "../db";
import * as schema from "../db/schema";
import { parseApplicationEnvironment } from "./environment";
import { enqueueOutboxEvent } from "./outbox";
import { recordSecurityEvent } from "./security-events";

/**
 * Staff-only authentication (Roadmap Langkah 6). There is no customer
 * account/login: see docs/TECHNICAL-ARCHITECTURE.md §3 and
 * docs/SECURITY-PRIVACY-RETENTION.md §2-3.
 *
 * Field-contract decisions this config depends on (see
 * database/migrations/after-drizzle/0003_auth_contract_alignment.sql):
 * - `auth_sessions.token` / `auth_verifications.value` store Better Auth's
 *   values as-is (its own default posture); protection relies on
 *   HttpOnly/Secure/SameSite cookies, TLS, and a private database, not
 *   at-rest hashing. `auth_accounts.password_hash` genuinely holds a hash
 *   because Better Auth's password hasher runs before the adapter ever
 *   sees the value.
 * - `advanced.database.generateId: false` so Postgres's own `uuidv7()`
 *   column default supplies every id, matching every other KOOKA table,
 *   instead of Better Auth's non-UUID default id generator (which would
 *   violate the `uuid` column type).
 * - `users.emailNormalized` is computed server-side from `email` via a
 *   `databaseHooks.user.create/update.before` hook, not accepted as client
 *   input.
 *
 * Explicit non-goals for this step (exit gate: "authenticated session
 * dapat dikenali server-side; belum memberi akses modul tanpa permission"):
 * - No RBAC/permission enforcement wiring (Roadmap Langkah 7).
 * - No customer-facing account/login of any kind.
 * Login staf sengaja memakai email dan kata sandi biasa. Keamanan tetap
 * mengandalkan akun individual, password hashing, rate limit, session revoke,
 * server-side RBAC, dan audit/security events.
 */

interface AuthOptionsParams {
  allowSignUp: boolean;
}

function buildAuthOptions({ allowSignUp }: AuthOptionsParams) {
  const environment = parseApplicationEnvironment(process.env);
  const localUatOrigin =
    new Set(["development", "test"]).has(environment.APP_ENV) &&
    process.env.UAT_BROWSER_URL
      ? new URL(process.env.UAT_BROWSER_URL).origin
      : null;

  return {
    appName: "KOOKA Residence",
    baseURL: environment.APP_URL,
    trustedOrigins: localUatOrigin
      ? [environment.APP_URL, localUatOrigin]
      : [environment.APP_URL],
    basePath: "/api/auth",
    secret: environment.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDatabase(), {
      provider: "pg" as const,
      schema,
      usePlural: false,
    }),
    emailAndPassword: {
      enabled: true,
      // Public self-service registration stays off; staff accounts are
      // provisioned server-side (see getStaffProvisioningAuth below) until
      // Roadmap Langkah 7 adds an Owner-permission-gated provisioning flow.
      disableSignUp: !allowSignUp,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Staff accounts are created by an operator, not a self-registering
      // stranger, so there is no unverified-stranger risk to gate on.
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { id: string; email: string; name: string };
        url: string;
      }) => {
        await enqueueOutboxEvent({
          topic: "auth.password-reset",
          aggregateType: "user",
          aggregateId: user.id,
          payload: { to: user.email, name: user.name, url },
        });
      },
      onPasswordReset: async ({ user }: { user: { id: string } }) => {
        await recordSecurityEvent({
          actorUserId: user.id,
          category: "AUTH_PASSWORD_RESET",
          result: "SUCCESS",
        });
      },
    },
    user: {
      modelName: "users",
      additionalFields: {
        emailNormalized: {
          type: "string" as const,
          required: true,
          // Only the unmounted, server-only provisioning auth may supply the
          // field required by Better Auth's sign-up validator. The public auth
          // instance still rejects it, and the database hook recomputes it.
          input: allowSignUp,
        },
      },
    },
    session: {
      modelName: "authSessions",
      // Eight hours is a hard lifetime: Better Auth is explicitly forbidden
      // from extending expiresAt during session refresh. A shorter idle lock
      // can later be added at the UI/device layer without weakening this
      // server-side absolute cap.
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 15,
      freshAge: 60 * 15,
      disableSessionRefresh: true,
    },
    account: {
      modelName: "authAccounts",
      fields: { password: "passwordHash" },
    },
    verification: {
      modelName: "authVerifications",
    },
    advanced: {
      database: { generateId: false as const },
      useSecureCookies: environment.APP_ENV !== "development",
      cookiePrefix: "kooka",
    },
    rateLimit: {
      // Single VPS / single Node process per docs/DATABASE-RUNTIME.md, so
      // in-memory storage is adequate; revisit with a Redis-backed
      // `customStorage` if the deployment ever scales horizontally.
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60 * 10, max: 5 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/request-password-reset": { window: 60 * 15, max: 3 },
        "/reset-password": { window: 60 * 15, max: 5 },
      },
    },
    onAPIError: {
      onError: (_error: unknown, context: unknown) => {
        if (
          !context ||
          typeof context !== "object" ||
          !("path" in context) ||
          context.path !== "/sign-in/email"
        )
          return;
        void recordSecurityEvent({
          actorUserId: null,
          category: "AUTH_SIGN_IN_FAILED",
          severity: "WARNING",
          result: "FAILURE",
        });
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (
            user: { email: string } & Record<string, unknown>,
          ) => ({
            data: { ...user, emailNormalized: user.email.toLowerCase() },
          }),
        },
        update: {
          before: async (
            user: Partial<{ email: string }> & Record<string, unknown>,
          ) => {
            if (typeof user.email !== "string") return;
            return {
              data: { ...user, emailNormalized: user.email.toLowerCase() },
            };
          },
        },
      },
      session: {
        create: {
          after: async (session: { userId: string }) => {
            await recordSecurityEvent({
              actorUserId: session.userId,
              category: "AUTH_SESSION_CREATED",
              result: "SUCCESS",
            });
          },
        },
        delete: {
          after: async (session: { userId: string }) => {
            await recordSecurityEvent({
              actorUserId: session.userId,
              category: "AUTH_SESSION_REVOKED",
              result: "SUCCESS",
            });
          },
        },
      },
    },
    plugins: [
      // Must be last: it wraps the response to set cookies via Next.js's
      // cookies() API for Server Action callers.
      nextCookies(),
    ],
  };
}

function buildAuth(params: AuthOptionsParams) {
  return betterAuth(buildAuthOptions(params));
}

let cachedAuth: ReturnType<typeof buildAuth> | undefined;
let cachedStaffProvisioningAuth: ReturnType<typeof buildAuth> | undefined;

/**
 * The auth instance mounted to the public route handler
 * (app/api/auth/[...all]/route.ts). Self-service sign-up is disabled.
 */
export function getAuth() {
  cachedAuth ??= buildAuth({ allowSignUp: false });
  return cachedAuth;
}

/**
 * Server-only instance with sign-up enabled, for staff provisioning
 * (seed scripts, tests, and — once built — an Owner-permission-gated
 * provisioning endpoint in Roadmap Langkah 7). Never import this from a
 * route handler that's reachable without a permission check: it accepts
 * `signUpEmail` calls unconditionally, same as any Better Auth sign-up.
 */
export function getStaffProvisioningAuth() {
  cachedStaffProvisioningAuth ??= buildAuth({ allowSignUp: true });
  return cachedStaffProvisioningAuth;
}
