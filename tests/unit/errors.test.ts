import { describe, expect, it } from "vitest";

import { AppError, toErrorResponse } from "../../src/platform/errors";

describe("AppError / toErrorResponse", () => {
  it.each([
    ["VALIDATION_ERROR", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["INTERNAL_ERROR", 500],
  ] as const)("maps %s to HTTP %d", (code, status) => {
    const response = toErrorResponse(new AppError(code, "message"));
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
  });

  it("echoes the caller's message for a known AppError", () => {
    const response = toErrorResponse(
      new AppError("NOT_FOUND", "Booking 123 was not found"),
    );
    expect(response.body.error.message).toBe("Booking 123 was not found");
  });

  it("threads the request id through for correlation without altering the error shape", () => {
    const response = toErrorResponse(
      new AppError("FORBIDDEN", "denied"),
      "req-abc-123",
    );
    expect(response.body.error.requestId).toBe("req-abc-123");
  });

  it("never leaks the message of an unknown thrown value", () => {
    const response = toErrorResponse(
      new Error("connection refused to internal-db-host:5432"),
    );
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.message).not.toMatch(/internal-db-host/u);
    expect(response.body.error.message).toBe("An unexpected error occurred");
  });

  it("handles a non-Error thrown value the same generic way", () => {
    const response = toErrorResponse("just a string throw");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  });
});
