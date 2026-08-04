import "server-only";

import { getDatabase } from "../db";
import { securityEvents } from "../db/schema";
import { getLogger } from "./logger";
import { redactSensitiveFields } from "./redaction";

/**
 * Shared best-effort security-event writer used by both staff auth
 * (Roadmap Langkah 6: "Rate limit, login security event, dan generic
 * error") and RBAC admin actions (Roadmap Langkah 7: role/permission
 * changes must produce a security event per
 * docs/SECURITY-PRIVACY-RETENTION.md §2: "Perubahan password,
 * email/login identifier, role, atau permission menghasilkan security
 * event/audit.").
 *
 * This writes directly with `getDatabase()`, outside whatever transaction
 * the action it describes is running in, so it is best-effort logging
 * rather than atomic with that action -- acceptable for this step, but
 * worth tightening (e.g. via a shared transaction context) if this table
 * becomes the basis for compliance-grade audit reporting in a later step.
 * `severity`/`result`/`category` have no fixed vocabulary yet
 * (docs/DATABASE-SCHEMA.md §15 leaves them as free-form columns); the
 * category names used by callers are this step's own convention pending a
 * broader taxonomy.
 */
export async function recordSecurityEvent(event: {
  actorUserId: string | null;
  category: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  result: "SUCCESS" | "FAILURE";
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await getDatabase()
      .insert(securityEvents)
      .values({
        actorUserId: event.actorUserId,
        category: event.category,
        severity: event.severity ?? "INFO",
        result: event.result,
        targetType: event.targetType,
        targetId: event.targetId,
        details: event.details
          ? redactSensitiveFields(event.details)
          : undefined,
      });
  } catch (error) {
    getLogger().error(
      { error, category: event.category },
      "Failed to record security event",
    );
  }
}
