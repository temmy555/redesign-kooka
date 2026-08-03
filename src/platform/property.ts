import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "../db";
import { properties } from "../db/schema";

/**
 * Resolves the single active property (Phase 1 baseline: `properties` has a
 * partial unique index enforcing at most one ACTIVE row -- see
 * src/db/schema/property.ts `uq_one_active_property`). Every `user_roles`
 * grant is property-scoped, so authorization checks need this id.
 *
 * Throws rather than silently picking an archived property or a random
 * property if Phase 2 multi-property support ever adds more than one row:
 * callers should not guess which property a permission check applies to.
 */
export async function getActivePropertyId(): Promise<string> {
  const rows = await getDatabase()
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.status, "ACTIVE"))
    .limit(2);

  if (rows.length === 0) throw new Error("No active property is configured");
  if (rows.length > 1) {
    throw new Error(
      "Multiple active properties found; Phase 1 assumes exactly one",
    );
  }

  return rows[0]!.id;
}
