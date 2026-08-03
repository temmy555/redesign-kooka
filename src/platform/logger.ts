import "server-only";

import pino from "pino";

import { parseApplicationEnvironment } from "./environment";
import { redactSensitiveFields } from "./redaction";

/**
 * Structured logging (Roadmap Langkah 8). Pino's own `redact` option only
 * matches a static list of dot-paths, which can't cover an arbitrary
 * nested context object -- so rather than fight that, every context object
 * passed to a log call is deep-redacted with the same
 * `redactSensitiveFields` the audit writer uses (src/platform/audit.ts),
 * before Pino ever sees it. `pino-pretty` is intentionally not used: the
 * dependency baseline only pins `pino` itself (see
 * docs/DEPENDENCY-QUALITY-BASELINE.md), and JSON-per-line is what a VPS log
 * collector expects anyway.
 */

let basePino: pino.Logger | undefined;

function getBasePino(): pino.Logger {
  if (basePino) return basePino;
  const environment = parseApplicationEnvironment(process.env);
  basePino = pino({
    level: environment.APP_ENV === "development" ? "debug" : "info",
    base: { app: "kooka-web" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return basePino;
}

export interface Logger {
  debug(context: Record<string, unknown>, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
  /** Scopes subsequent log calls with fixed bindings, e.g. a correlation id. */
  child(bindings: Record<string, unknown>): Logger;
}

function wrap(pinoInstance: pino.Logger): Logger {
  return {
    debug: (context, message) =>
      pinoInstance.debug(redactSensitiveFields(context), message),
    info: (context, message) =>
      pinoInstance.info(redactSensitiveFields(context), message),
    warn: (context, message) =>
      pinoInstance.warn(redactSensitiveFields(context), message),
    error: (context, message) =>
      pinoInstance.error(redactSensitiveFields(context), message),
    child: (bindings) =>
      wrap(pinoInstance.child(redactSensitiveFields(bindings))),
  };
}

export function getLogger(): Logger {
  return wrap(getBasePino());
}

/**
 * Per-request logger carrying a correlation id, matching
 * docs/TECHNICAL-ARCHITECTURE.md §7: "Structured log memakai
 * request/correlation ID dan tidak memuat highly sensitive data." Callers
 * (route handlers, worker jobs) should create one of these at the start of
 * a unit of work and thread it through instead of calling `getLogger()`
 * repeatedly with the id passed by hand.
 */
export function getRequestLogger(correlationId: string): Logger {
  return getLogger().child({ correlationId });
}
