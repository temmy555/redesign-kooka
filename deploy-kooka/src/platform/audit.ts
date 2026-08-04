import "server-only";

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDatabase } from "../db";
import { auditEvents } from "../db/schema";
import type * as schema from "../db/schema";
import { getLogger } from "./logger";
import { redactSensitiveFields } from "./redaction";

/**
 * Audit writer with redaction (Roadmap Langkah 8). Every domain module
 * that mutates something worth an audit trail -- booking, room, price,
 * payment, refund, folio, invoice, policy/retention override, sensitive
 * data view/export (docs/SECURITY-PRIVACY-RETENTION.md §8) -- should call
 * this instead of inserting into `audit_events` directly, so redaction
 * cannot be forgotten module by module.
 *
 * `before`/`after` and `deviceMetadata` are run through the same
 * `redactSensitiveFields` the logger uses (src/platform/redaction.ts)
 * before being written, matching §8: "Audit tidak menyimpan secret,
 * password, OTP, full identity number, signature content, bank account
 * penuh, atau file body." That redaction is a key-name denylist backstop,
 * not a substitute for callers not putting a raw KTP scan or password into
 * `before`/`after` in the first place -- see the module doc comment on
 * redaction.ts for that limitation.
 *
 * `recordAuditEvent` is fail-closed. Sensitive domain actions must pass the
 * same transaction handle used by their mutation so neither can commit
 * without the other. `recordBestEffortAuditEvent` exists only for
 * non-authoritative diagnostics where losing the event is explicitly
 * acceptable; callers must opt into that weaker contract by name.
 */
export interface AuditEventInput {
  propertyId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "system" | "customer";
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  result: "SUCCESS" | "FAILURE";
  requestId?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  deviceMetadata?: Record<string, unknown> | null;
}

type AuditDb = Pick<NodePgDatabase<typeof schema>, "insert">;

export async function recordAuditEvent(
  event: AuditEventInput,
  db: AuditDb = getDatabase(),
): Promise<void> {
  await db.insert(auditEvents).values({
    propertyId: event.propertyId ?? null,
    actorUserId: event.actorUserId ?? null,
    actorType: event.actorType,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    beforeJson: event.before ? redactSensitiveFields(event.before) : null,
    afterJson: event.after ? redactSensitiveFields(event.after) : null,
    reason: event.reason ?? null,
    result: event.result,
    requestId: event.requestId ?? null,
    correlationId: event.correlationId ?? null,
    ipAddress: event.ipAddress ?? null,
    deviceMetadata: event.deviceMetadata
      ? redactSensitiveFields(event.deviceMetadata)
      : null,
  });
}

export async function recordBestEffortAuditEvent(
  event: AuditEventInput,
): Promise<void> {
  try {
    await recordAuditEvent(event);
  } catch (error) {
    getLogger().error(
      { error, action: event.action, targetType: event.targetType },
      "Failed to record audit event",
    );
  }
}
