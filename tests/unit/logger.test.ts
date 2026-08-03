import { beforeEach, describe, expect, it, vi } from "vitest";

const { debug, info, warn, error, child, pinoFn } = vi.hoisted(() => {
  const debug = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const child = vi.fn();
  const instance = { debug, info, warn, error, child };
  child.mockReturnValue(instance);
  const pinoFn = vi.fn(() => instance);
  return { debug, info, warn, error, child, pinoFn };
});

vi.mock("pino", () => ({
  default: Object.assign(pinoFn, {
    stdTimeFunctions: { isoTime: () => "iso-stub" },
  }),
}));
vi.mock("../../src/platform/environment", () => ({
  parseApplicationEnvironment: () => ({ APP_ENV: "test" }),
}));

import { getLogger, getRequestLogger } from "../../src/platform/logger";

describe("logger", () => {
  beforeEach(() => {
    debug.mockClear();
    info.mockClear();
    warn.mockClear();
    error.mockClear();
    child.mockClear().mockReturnValue({ debug, info, warn, error, child });
  });

  it("redacts sensitive context before handing it to the underlying pino instance", () => {
    const logger = getLogger();

    logger.debug({ password: "hunter2" }, "debug message");
    logger.info({ a: 1 }, "info message");
    logger.warn({ b: 2 }, "warn message");
    logger.error({ c: 3 }, "error message");

    expect(debug).toHaveBeenCalledWith(
      { password: "[redacted]" },
      "debug message",
    );
    expect(info).toHaveBeenCalledWith({ a: 1 }, "info message");
    expect(warn).toHaveBeenCalledWith({ b: 2 }, "warn message");
    expect(error).toHaveBeenCalledWith({ c: 3 }, "error message");
  });

  it("child() redacts bindings and returns a Logger scoped to them", () => {
    const logger = getLogger();
    const scoped = logger.child({ correlationId: "abc", secret: "s" });

    expect(child).toHaveBeenCalledWith({
      correlationId: "abc",
      secret: "[redacted]",
    });

    scoped.info({}, "scoped message");
    expect(info).toHaveBeenCalledWith({}, "scoped message");
  });

  it("getRequestLogger attaches a correlationId binding via child()", () => {
    getRequestLogger("req-1");
    expect(child).toHaveBeenCalledWith({ correlationId: "req-1" });
  });

  it("only constructs the base pino instance once, on first use", () => {
    getLogger();
    getLogger();
    getRequestLogger("req-2");

    // pino() itself may already have been called by an earlier test in this
    // file (the module-level cache in logger.ts persists for the file's
    // lifetime) -- what matters is it's not called again per getLogger().
    const callsBefore = pinoFn.mock.calls.length;
    getLogger();
    expect(pinoFn.mock.calls.length).toBe(callsBefore);
  });
});
