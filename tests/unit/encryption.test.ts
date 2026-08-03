import { afterEach, describe, expect, it } from "vitest";

import {
  decryptSensitiveValue,
  encryptSensitiveValue,
} from "../../src/platform/encryption";

const previousKey = process.env.DATA_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
  else process.env.DATA_ENCRYPTION_KEY = previousKey;
});

describe("sensitive configuration encryption", () => {
  it("round-trips plaintext without storing it in the envelope", () => {
    process.env.DATA_ENCRYPTION_KEY =
      "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
    const plaintext = "1234567890";
    const encrypted = encryptSensitiveValue(plaintext);

    expect(encrypted).toMatch(/^v1\./u);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSensitiveValue(encrypted)).toBe(plaintext);
  });

  it("rejects a missing or malformed key", () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => encryptSensitiveValue("secret")).toThrow(
      /DATA_ENCRYPTION_KEY/u,
    );

    process.env.DATA_ENCRYPTION_KEY = "dG9vLXNob3J0";
    expect(() => encryptSensitiveValue("secret")).toThrow(/32 bytes/u);
  });
});
