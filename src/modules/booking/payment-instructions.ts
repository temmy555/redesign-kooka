import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  paymentInstructionSets,
  paymentInstructionVersions,
} from "../../db/schema";
import type * as schema from "../../db/schema";

type PaymentInstructionDb = Pick<NodePgDatabase<typeof schema>, "select">;

/**
 * Resolve one effective version for every active bank account configured for
 * the property. The order is deterministic and becomes the display order
 * snapshotted on a reservation.
 */
export async function resolveActivePaymentInstructions(
  db: PaymentInstructionDb,
  propertyId: string,
  at = new Date(),
) {
  const rows = await db
    .select({
      instructionSetId: paymentInstructionSets.id,
      setCode: paymentInstructionSets.code,
      id: paymentInstructionVersions.id,
      versionNumber: paymentInstructionVersions.versionNumber,
      bankName: paymentInstructionVersions.bankName,
      accountHolder: paymentInstructionVersions.accountHolder,
      accountNumberCiphertext:
        paymentInstructionVersions.accountNumberCiphertext,
      accountNumberLast4: paymentInstructionVersions.accountNumberLast4,
      instructionId: paymentInstructionVersions.instructionId,
      instructionEn: paymentInstructionVersions.instructionEn,
      effectiveFrom: paymentInstructionVersions.effectiveFrom,
      effectiveTo: paymentInstructionVersions.effectiveTo,
    })
    .from(paymentInstructionSets)
    .innerJoin(
      paymentInstructionVersions,
      eq(
        paymentInstructionVersions.instructionSetId,
        paymentInstructionSets.id,
      ),
    )
    .where(
      and(
        eq(paymentInstructionSets.propertyId, propertyId),
        inArray(paymentInstructionVersions.lifecycleStatus, [
          "ACTIVE",
          "SCHEDULED",
        ]),
        inArray(paymentInstructionVersions.approvalStatus, [
          "APPROVED",
          "NOT_REQUIRED",
        ]),
        lte(paymentInstructionVersions.effectiveFrom, at),
        or(
          isNull(paymentInstructionVersions.effectiveTo),
          gt(paymentInstructionVersions.effectiveTo, at),
        ),
      ),
    )
    .orderBy(
      asc(paymentInstructionSets.code),
      desc(paymentInstructionVersions.versionNumber),
    );

  return [...new Map(rows.map((row) => [row.instructionSetId, row])).values()];
}

export function publicPaymentInstruction(
  instruction: Awaited<
    ReturnType<typeof resolveActivePaymentInstructions>
  >[number],
  language: "id" | "en",
  decrypt: (ciphertext: string) => string,
) {
  return {
    paymentInstructionVersionId: instruction.id,
    bankName: instruction.bankName,
    accountHolder: instruction.accountHolder,
    accountNumber: decrypt(instruction.accountNumberCiphertext),
    accountNumberLast4: instruction.accountNumberLast4,
    instruction:
      language === "en" ? instruction.instructionEn : instruction.instructionId,
  };
}
