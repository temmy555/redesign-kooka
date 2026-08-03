import { describe, expect, it } from "vitest";

import { isTrustedStaffMutation } from "../../src/platform/request-security";

const base = {
  method: "POST",
  requestOrigin: "https://kooka.example",
  configuredOrigin: "https://kooka.example",
};

describe("staff mutation origin guard", () => {
  it("allows safe methods and same-origin mutations", () => {
    expect(
      isTrustedStaffMutation({
        ...base,
        method: "GET",
        originHeader: "https://attacker.example",
        secFetchSite: "cross-site",
      }),
    ).toBe(true);
    expect(
      isTrustedStaffMutation({
        ...base,
        originHeader: "https://kooka.example",
        secFetchSite: "same-origin",
      }),
    ).toBe(true);
  });

  it("rejects cross-site metadata, foreign origins, and malformed origins", () => {
    expect(
      isTrustedStaffMutation({
        ...base,
        originHeader: "https://kooka.example",
        secFetchSite: "cross-site",
      }),
    ).toBe(false);
    expect(
      isTrustedStaffMutation({
        ...base,
        originHeader: "https://attacker.example",
        secFetchSite: "cors",
      }),
    ).toBe(false);
    expect(isTrustedStaffMutation({ ...base, originHeader: "not-a-url" })).toBe(
      false,
    );
  });

  it("allows non-browser tooling without Origin while RBAC remains authoritative", () => {
    expect(isTrustedStaffMutation(base)).toBe(true);
  });

  it("accepts the configured application origin behind a local reverse proxy", () => {
    expect(
      isTrustedStaffMutation({
        ...base,
        requestOrigin: "http://127.0.0.1:3000",
        originHeader: "https://kooka.example/path",
        secFetchSite: "same-site",
      }),
    ).toBe(true);
  });
});
