import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(() => ({ query: {}, execute: vi.fn() })),
}));
const { enqueueOutboxEvent } = vi.hoisted(() => ({
  enqueueOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));
const { recordSecurityEvent } = vi.hoisted(() => ({
  recordSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/db", () => ({ getDatabase }));
vi.mock("../../src/platform/outbox", () => ({ enqueueOutboxEvent }));
vi.mock("../../src/platform/security-events", () => ({ recordSecurityEvent }));

const testEnvironment = {
  APP_ENV: "test",
  APP_URL: "http://127.0.0.1:3100",
  BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters-long",
  DATABASE_URL: "postgresql://kooka_test:secret@127.0.0.1:55432/kooka_test",
  DB_POOL_MAX: "8",
  DB_CONNECTION_TIMEOUT_MS: "5000",
  DB_IDLE_TIMEOUT_MS: "10000",
  REDIS_URL: "redis://:secret@127.0.0.1:56379",
  PRIVATE_STORAGE_ROOT: ".data/test/private-files",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "11025",
  SMTP_FROM: "KOOKA Test <no-reply@test.kooka.local>",
};

describe("staff authentication config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    getDatabase.mockClear();
    enqueueOutboxEvent.mockClear();
    recordSecurityEvent.mockClear();
    process.env = { ...originalEnv, ...testEnvironment } as NodeJS.ProcessEnv;
  });

  it("disables public self-service sign-up on the instance mounted to the route handler", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();

    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("only enables sign-up on the server-only staff provisioning instance", async () => {
    const { getStaffProvisioningAuth } =
      await import("../../src/platform/auth");
    const auth = getStaffProvisioningAuth();

    expect(auth.options.emailAndPassword?.disableSignUp).toBe(false);
  });

  it("maps Better Auth's default model/field names onto KOOKA's existing tables", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();

    expect(auth.options.user?.modelName).toBe("users");
    expect(auth.options.session?.modelName).toBe("authSessions");
    expect(auth.options.account?.modelName).toBe("authAccounts");
    expect(auth.options.account?.fields?.password).toBe("passwordHash");
    expect(auth.options.verification?.modelName).toBe("authVerifications");
  });

  it("lets Postgres supply every id via its own uuidv7() column default", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();

    expect(auth.options.advanced?.database?.generateId).toBe(false);
  });

  it("computes emailNormalized server-side instead of accepting it as client input", async () => {
    const { getAuth, getStaffProvisioningAuth } =
      await import("../../src/platform/auth");
    const auth = getAuth();

    expect(auth.options.user?.additionalFields?.emailNormalized).toMatchObject({
      required: true,
      input: false,
    });
    expect(
      getStaffProvisioningAuth().options.user?.additionalFields
        ?.emailNormalized,
    ).toMatchObject({ required: true, input: true });

    const before = auth.options.databaseHooks?.user?.create?.before;
    expect(before).toBeTypeOf("function");
    const result = await before!(
      { email: "Front.Office@KOOKA.example" } as never,
      null,
    );
    expect(result).toMatchObject({
      data: { emailNormalized: "front.office@kooka.example" },
    });
  });

  it("applies tighter rate-limit rules to credential endpoints than the default", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();

    expect(auth.options.rateLimit?.enabled).toBe(true);
    const signIn = auth.options.rateLimit?.customRules?.["/sign-in/email"];
    expect(signIn).toMatchObject({ max: 5 });
    if (
      signIn &&
      typeof signIn === "object" &&
      "max" in signIn &&
      typeof auth.options.rateLimit?.max === "number"
    ) {
      expect(signIn.max).toBeLessThan(auth.options.rateLimit.max);
    }
  });

  it("does not register a two-factor authentication plugin", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();

    const pluginIds = auth.options.plugins?.map((plugin) => plugin.id);
    expect(pluginIds).not.toContain("two-factor");
  });

  it("wires login/logout security-event hooks", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();

    expect(auth.options.databaseHooks?.session?.create?.after).toBeTypeOf(
      "function",
    );
    expect(auth.options.databaseHooks?.session?.delete?.after).toBeTypeOf(
      "function",
    );
    expect(auth.options.emailAndPassword?.onPasswordReset).toBeTypeOf(
      "function",
    );
    expect(auth.options.emailAndPassword?.sendResetPassword).toBeTypeOf(
      "function",
    );
    expect(auth.options.session?.disableSessionRefresh).toBe(true);
    expect(auth.options.onAPIError?.onError).toBeTypeOf("function");
  });

  it("queues password-reset delivery without exposing a customer login", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();
    const sendResetPassword = auth.options.emailAndPassword?.sendResetPassword;

    await sendResetPassword?.(
      {
        user: {
          id: "11111111-1111-4111-a111-111111111111",
          email: "owner@example.com",
          name: "Owner",
        } as never,
        url: "http://localhost:3000/api/auth/reset-password/token",
        token: "token",
      },
      new Request("http://localhost"),
    );

    expect(enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "auth.password-reset",
        aggregateType: "user",
      }),
    );
  });

  it("normalizes updated email addresses and ignores unrelated user updates", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();
    const before = auth.options.databaseHooks?.user?.update?.before;
    expect(
      await before?.({ name: "Front Office" } as never, null),
    ).toBeUndefined();
    expect(
      await before?.({ email: "NEW@KOOKA.EXAMPLE" } as never, null),
    ).toMatchObject({ data: { emailNormalized: "new@kooka.example" } });
  });

  it("records password-reset, session, and failed-login security events", async () => {
    const { getAuth } = await import("../../src/platform/auth");
    const auth = getAuth();
    await auth.options.emailAndPassword?.onPasswordReset?.(
      { user: { id: "user-1" } as never },
      new Request("http://localhost"),
    );
    await auth.options.databaseHooks?.session?.create?.after?.(
      { userId: "user-1" } as never,
      null,
    );
    await auth.options.databaseHooks?.session?.delete?.after?.(
      { userId: "user-1" } as never,
      null,
    );
    auth.options.onAPIError?.onError?.(new Error("bad credentials"), {
      path: "/sign-in/email",
    } as never);
    auth.options.onAPIError?.onError?.(new Error("other"), null as never);
    expect(recordSecurityEvent).toHaveBeenCalledTimes(4);
  });
});
