/**
 * Shared error contract (Roadmap Langkah 8), per
 * docs/TECHNICAL-ARCHITECTURE.md §7: route handlers respond with a generic,
 * non-leaking error shape rather than each inventing its own. No
 * `server-only` marker: the `ErrorCode`/`ErrorResponseBody` shapes are also
 * useful to a client parsing a response.
 *
 * Domain code throws `AppError` with one of the codes below; anything else
 * (an unexpected exception) is treated as `INTERNAL_ERROR` and its real
 * message is never included in the response body, only in the server log
 * (via `toErrorResponse`'s caller passing it to a logger) -- this is what
 * keeps a stray database error from leaking a table/column name to a
 * client.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
  };
}

export interface ErrorResponse {
  status: number;
  body: ErrorResponseBody;
}

/**
 * Converts any thrown value into the response shape a route handler should
 * send. `requestId` (from a correlation-id-carrying request logger, see
 * `getRequestLogger` in src/platform/logger.ts) is echoed back so a client
 * can quote it when reporting an issue, without exposing anything about
 * the underlying cause.
 */
export function toErrorResponse(
  error: unknown,
  requestId?: string,
): ErrorResponse {
  if (error instanceof AppError) {
    return {
      status: STATUS_BY_CODE[error.code],
      body: {
        error: { code: error.code, message: error.message, requestId },
      },
    };
  }

  return {
    status: STATUS_BY_CODE.INTERNAL_ERROR,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId,
      },
    },
  };
}
