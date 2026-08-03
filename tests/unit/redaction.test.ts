import { describe, expect, it } from "vitest";

import {
  REDACTED_VALUE,
  isSensitiveKey,
  redactSensitiveFields,
} from "../../src/platform/redaction";

describe("isSensitiveKey", () => {
  it.each([
    "password",
    "Password",
    "userPassword",
    "otp",
    "otpCode",
    "apiKey",
    "api_key",
    "creditCardNumber",
    "cvv",
    "identityNumber",
    "ktpNumber",
    "passportNumber",
    "nikNumber",
    "signature",
    "bankAccountNumber",
    "accountNumber",
    "fileBody",
    "base64Content",
    "sessionToken",
    "authorization",
    "cookieHeader",
  ])("flags %s as sensitive", (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(["email", "name", "roomNumber", "propertyId", "status", "reason"])(
    "does not flag %s as sensitive",
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe("redactSensitiveFields", () => {
  it("redacts a top-level sensitive key", () => {
    expect(
      redactSensitiveFields({ password: "hunter2", email: "a@b.com" }),
    ).toEqual({
      password: REDACTED_VALUE,
      email: "a@b.com",
    });
  });

  it("redacts sensitive keys nested arbitrarily deep", () => {
    const input = {
      actor: { name: "Budi", credentials: { otp: "123456" } },
    };
    expect(redactSensitiveFields(input)).toEqual({
      actor: { name: "Budi", credentials: { otp: REDACTED_VALUE } },
    });
  });

  it("redacts sensitive keys inside arrays of objects", () => {
    const input = { items: [{ ktpNumber: "1234" }, { name: "ok" }] };
    expect(redactSensitiveFields(input)).toEqual({
      items: [{ ktpNumber: REDACTED_VALUE }, { name: "ok" }],
    });
  });

  it("leaves Date instances untouched instead of walking into them", () => {
    const when = new Date("2026-08-02T00:00:00.000Z");
    const result = redactSensitiveFields({ createdAt: when });
    expect(result.createdAt).toBe(when);
  });

  it("does not mutate the input object", () => {
    const input = { password: "hunter2" };
    redactSensitiveFields(input);
    expect(input.password).toBe("hunter2");
  });

  it("handles circular references without throwing", () => {
    const input: Record<string, unknown> = { name: "loop" };
    input.self = input;
    expect(() => redactSensitiveFields(input)).not.toThrow();
  });

  it("redacts authorization fields and tokens embedded in URLs", () => {
    expect(
      redactSensitiveFields({
        authorization: "Bearer secret",
        cookieHeader: "session=secret",
        resetUrl: "https://kooka.test/reset?token=secret&next=%2Fstaff",
      }),
    ).toEqual({
      authorization: REDACTED_VALUE,
      cookieHeader: REDACTED_VALUE,
      resetUrl: "https://kooka.test/reset?token=%5Bredacted%5D&next=%2Fstaff",
    });
  });

  it("passes primitives and null straight through", () => {
    expect(redactSensitiveFields(null)).toBeNull();
    expect(redactSensitiveFields(42)).toBe(42);
    expect(redactSensitiveFields("password")).toBe("password");
  });
});
