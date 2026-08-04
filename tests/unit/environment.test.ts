import { describe, expect, it } from "vitest";

import { parseApplicationEnvironment } from "../../src/platform/environment";

const localEnvironment = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "local-test-secret-at-least-32-characters-long",
  DATA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  DATABASE_URL: "postgresql://kooka:secret@127.0.0.1:55432/kooka",
  REDIS_URL: "redis://:secret@127.0.0.1:56379",
  PRIVATE_STORAGE_ROOT: ".data/private-files",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "11025",
  SMTP_FROM: "KOOKA Local <no-reply@kooka.local>",
  MAILPIT_URL: "http://127.0.0.1:18025",
};

describe("application environment", () => {
  it("accepts the isolated local configuration", () => {
    expect(parseApplicationEnvironment(localEnvironment)).toMatchObject({
      APP_ENV: "development",
      SMTP_PORT: 11025,
      DB_POOL_MAX: 8,
      DB_CONNECTION_TIMEOUT_MS: 5_000,
      DB_IDLE_TIMEOUT_MS: 10_000,
    });
  });

  it("rejects localhost and Mailpit in production-like environments", () => {
    expect(() =>
      parseApplicationEnvironment({
        ...localEnvironment,
        APP_ENV: "production",
      }),
    ).toThrow(/cannot use localhost|Mailpit/u);
  });

  it("accepts isolated UAT services and encrypted Redis", () => {
    const uatEnvironment: Record<string, string | undefined> = {
      ...localEnvironment,
      MAILPIT_URL: undefined,
    };

    expect(
      parseApplicationEnvironment({
        ...uatEnvironment,
        APP_ENV: "uat",
        APP_URL: "https://uat.kooka.example.invalid",
        DATABASE_URL:
          "postgresql://kooka:secret@postgres-uat.internal:5432/kooka_uat",
        REDIS_URL: "rediss://:secret@redis-uat.internal:6379",
        PRIVATE_STORAGE_ROOT: "/srv/kooka-uat/private-files",
      }),
    ).toMatchObject({ APP_ENV: "uat" });
  });

  it("accepts production-like environments without Redis for lightweight testing deployments", () => {
    const productionEnvironment: Record<string, string | undefined> = {
      ...localEnvironment,
      APP_ENV: "production",
      APP_URL: "https://testing.kooka.example.invalid",
      DATABASE_URL: "postgresql://kooka:secret@postgres.aws.example:5432/kooka",
      REDIS_URL: undefined,
      MAILPIT_URL: undefined,
      PRIVATE_STORAGE_ROOT: "/home/u123456/domains/kooka/private-files",
    };

    expect(parseApplicationEnvironment(productionEnvironment)).toMatchObject({
      APP_ENV: "production",
      REDIS_URL: undefined,
    });
  });

  it("rejects non-Redis protocols", () => {
    expect(() =>
      parseApplicationEnvironment({
        ...localEnvironment,
        REDIS_URL: "https://redis.internal",
      }),
    ).toThrow(/redis:\/\/ or rediss:\/\//u);
  });

  it("rejects private files stored below a public directory", () => {
    expect(() =>
      parseApplicationEnvironment({
        ...localEnvironment,
        PRIVATE_STORAGE_ROOT: "public/uploads/private",
      }),
    ).toThrow(/outside every public directory/u);
  });

  it("rejects an excessive database connection pool", () => {
    expect(() =>
      parseApplicationEnvironment({
        ...localEnvironment,
        DB_POOL_MAX: "50",
      }),
    ).toThrow();
  });

  it("rejects a short BETTER_AUTH_SECRET", () => {
    expect(() =>
      parseApplicationEnvironment({
        ...localEnvironment,
        BETTER_AUTH_SECRET: "too-short",
      }),
    ).toThrow(/BETTER_AUTH_SECRET/u);
  });

  it("rejects Better Auth's built-in fallback secret (too short to pass in any environment)", () => {
    expect(() =>
      parseApplicationEnvironment({
        ...localEnvironment,
        BETTER_AUTH_SECRET: "better-auth-secret-123456789",
      }),
    ).toThrow(/BETTER_AUTH_SECRET/u);
  });
});
