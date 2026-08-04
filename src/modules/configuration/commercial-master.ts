import "server-only";

import { createHash } from "node:crypto";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  documentProfiles,
  documentProfileVersions,
  documentSequences,
  exchangeRateSnapshots,
  paymentInstructionSets,
  paymentInstructionVersions,
  policySets,
  policyVersions,
  ratePlans,
  ratePlanVersions,
  rateRuleDates,
  rateRules,
  roomTypes,
  taxProfiles,
  taxProfileVersions,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { encryptSensitiveValue } from "../../platform/encryption";
import { AppError } from "../../platform/errors";
import type { MutationResult, StaffSession } from "./contracts";
import {
  assertEffectivePeriod,
  isEffectiveAt,
  nextVersionNumber,
  normalizeMasterCode,
} from "./versioning";

function checkedReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A reason between 3 and 500 characters is required",
    );
  }
  return value;
}

export async function getCommercialMasterOverview(params: {
  session: StaffSession;
  propertyId: string;
}) {
  await requirePermission(params.session, params.propertyId, "commercial.view");
  const db = getDatabase();
  const [
    sequences,
    taxes,
    policies,
    instructions,
    documents,
    rates,
    rateRulesOverview,
    exchangeRates,
  ] = await Promise.all([
    db
      .select({
        id: documentSequences.id,
        documentType: documentSequences.documentType,
        periodKey: documentSequences.periodKey,
        prefix: documentSequences.prefix,
        nextValue: documentSequences.nextValue,
        padding: documentSequences.padding,
      })
      .from(documentSequences)
      .where(eq(documentSequences.propertyId, params.propertyId))
      .orderBy(documentSequences.documentType, documentSequences.periodKey),
    db
      .select({
        profileId: taxProfiles.id,
        code: taxProfiles.code,
        name: taxProfiles.name,
        domain: taxProfiles.domain,
        versionId: taxProfileVersions.id,
        versionNumber: taxProfileVersions.versionNumber,
        lifecycleStatus: taxProfileVersions.lifecycleStatus,
        approvalStatus: taxProfileVersions.approvalStatus,
        taxRate: taxProfileVersions.taxRate,
        serviceChargeRate: taxProfileVersions.serviceChargeRate,
        taxInclusive: taxProfileVersions.taxInclusive,
        serviceChargeInclusive: taxProfileVersions.serviceChargeInclusive,
        noTax: taxProfileVersions.noTax,
        effectiveFrom: taxProfileVersions.effectiveFrom,
        effectiveTo: taxProfileVersions.effectiveTo,
      })
      .from(taxProfiles)
      .leftJoin(
        taxProfileVersions,
        eq(taxProfileVersions.taxProfileId, taxProfiles.id),
      )
      .where(eq(taxProfiles.propertyId, params.propertyId))
      .orderBy(taxProfiles.code, desc(taxProfileVersions.versionNumber)),
    db
      .select({
        policySetId: policySets.id,
        code: policySets.code,
        policyType: policySets.policyType,
        versionId: policyVersions.id,
        versionNumber: policyVersions.versionNumber,
        lifecycleStatus: policyVersions.lifecycleStatus,
        approvalStatus: policyVersions.approvalStatus,
        titleId: policyVersions.titleId,
        titleEn: policyVersions.titleEn,
        contentId: policyVersions.contentId,
        contentEn: policyVersions.contentEn,
        effectiveFrom: policyVersions.effectiveFrom,
        effectiveTo: policyVersions.effectiveTo,
        checksum: policyVersions.checksum,
      })
      .from(policySets)
      .leftJoin(policyVersions, eq(policyVersions.policySetId, policySets.id))
      .where(eq(policySets.propertyId, params.propertyId))
      .orderBy(policySets.code, desc(policyVersions.versionNumber)),
    db
      .select({
        instructionSetId: paymentInstructionSets.id,
        code: paymentInstructionSets.code,
        name: paymentInstructionSets.name,
        versionId: paymentInstructionVersions.id,
        versionNumber: paymentInstructionVersions.versionNumber,
        lifecycleStatus: paymentInstructionVersions.lifecycleStatus,
        approvalStatus: paymentInstructionVersions.approvalStatus,
        bankName: paymentInstructionVersions.bankName,
        accountHolder: paymentInstructionVersions.accountHolder,
        accountNumberLast4: paymentInstructionVersions.accountNumberLast4,
        currency: paymentInstructionVersions.currency,
        effectiveFrom: paymentInstructionVersions.effectiveFrom,
        effectiveTo: paymentInstructionVersions.effectiveTo,
      })
      .from(paymentInstructionSets)
      .leftJoin(
        paymentInstructionVersions,
        eq(
          paymentInstructionVersions.instructionSetId,
          paymentInstructionSets.id,
        ),
      )
      .where(eq(paymentInstructionSets.propertyId, params.propertyId))
      .orderBy(
        paymentInstructionSets.code,
        desc(paymentInstructionVersions.versionNumber),
      ),
    db
      .select({
        profileId: documentProfiles.id,
        code: documentProfiles.code,
        versionId: documentProfileVersions.id,
        versionNumber: documentProfileVersions.versionNumber,
        lifecycleStatus: documentProfileVersions.lifecycleStatus,
        approvalStatus: documentProfileVersions.approvalStatus,
        legalName: documentProfileVersions.legalName,
        displayName: documentProfileVersions.displayName,
        address: documentProfileVersions.address,
        contact: documentProfileVersions.contact,
        templateReference: documentProfileVersions.templateReference,
        effectiveFrom: documentProfileVersions.effectiveFrom,
        effectiveTo: documentProfileVersions.effectiveTo,
      })
      .from(documentProfiles)
      .leftJoin(
        documentProfileVersions,
        eq(documentProfileVersions.documentProfileId, documentProfiles.id),
      )
      .where(eq(documentProfiles.propertyId, params.propertyId))
      .orderBy(
        documentProfiles.code,
        desc(documentProfileVersions.versionNumber),
      ),
    db
      .select({
        ratePlanId: ratePlans.id,
        code: ratePlans.code,
        status: ratePlans.status,
        versionId: ratePlanVersions.id,
        versionNumber: ratePlanVersions.versionNumber,
        lifecycleStatus: ratePlanVersions.lifecycleStatus,
        approvalStatus: ratePlanVersions.approvalStatus,
        nameId: ratePlanVersions.nameId,
        nameEn: ratePlanVersions.nameEn,
        sourceEligibility: ratePlanVersions.sourceEligibility,
        paymentInstructionSetId: ratePlanVersions.paymentInstructionSetId,
        cancellationPolicySetId: ratePlanVersions.cancellationPolicySetId,
        taxProfileId: ratePlanVersions.taxProfileId,
        effectiveFrom: ratePlanVersions.effectiveFrom,
        effectiveTo: ratePlanVersions.effectiveTo,
      })
      .from(ratePlans)
      .leftJoin(ratePlanVersions, eq(ratePlanVersions.ratePlanId, ratePlans.id))
      .where(eq(ratePlans.propertyId, params.propertyId))
      .orderBy(ratePlans.code, desc(ratePlanVersions.versionNumber)),
    db
      .select({
        id: rateRules.id,
        ratePlanVersionId: rateRules.ratePlanVersionId,
        roomTypeId: rateRules.roomTypeId,
        name: rateRules.name,
        ruleType: rateRules.ruleType,
        startsOn: rateRules.startsOn,
        endsOn: rateRules.endsOn,
        nightlyRateIdr: rateRules.nightlyRateIdr,
        minimumStay: rateRules.minimumStay,
      })
      .from(rateRules)
      .innerJoin(
        ratePlanVersions,
        eq(ratePlanVersions.id, rateRules.ratePlanVersionId),
      )
      .innerJoin(ratePlans, eq(ratePlans.id, ratePlanVersions.ratePlanId))
      .where(eq(ratePlans.propertyId, params.propertyId))
      .orderBy(rateRules.priority, rateRules.startsOn),
    db
      .select({
        id: exchangeRateSnapshots.id,
        quoteCurrency: exchangeRateSnapshots.quoteCurrency,
        rate: exchangeRateSnapshots.rate,
        source: exchangeRateSnapshots.source,
        asOfAt: exchangeRateSnapshots.asOfAt,
        expiresAt: exchangeRateSnapshots.expiresAt,
        roundingRule: exchangeRateSnapshots.roundingRule,
      })
      .from(exchangeRateSnapshots)
      .where(eq(exchangeRateSnapshots.propertyId, params.propertyId))
      .orderBy(
        exchangeRateSnapshots.quoteCurrency,
        desc(exchangeRateSnapshots.asOfAt),
      ),
  ]);

  return {
    taxes,
    policies,
    paymentInstructions: instructions,
    documents,
    documentSequences: sequences,
    ratePlans: rates,
    rateRules: rateRulesOverview,
    exchangeRates,
  };
}

export async function createTaxProfileDraft(params: {
  session: StaffSession;
  propertyId: string;
  profileId?: string;
  code: string;
  name: string;
  domain: string;
  taxRate: string;
  serviceChargeRate: string;
  taxInclusive: boolean;
  serviceChargeInclusive: boolean;
  noTax: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  assertEffectivePeriod(params.effectiveFrom, params.effectiveTo);
  const taxRate = Number(params.taxRate);
  const serviceRate = Number(params.serviceChargeRate);
  if (
    !Number.isFinite(taxRate) ||
    !Number.isFinite(serviceRate) ||
    taxRate < 0 ||
    serviceRate < 0
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tax and service rates must be non-negative numbers",
    );
  }
  if (params.noTax && (taxRate !== 0 || serviceRate !== 0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No Tax profile must use zero tax and service rates",
    );
  }
  return getDatabase().transaction(async (tx) => {
    let profileId = params.profileId;
    if (!profileId) {
      const [createdProfile] = await tx
        .insert(taxProfiles)
        .values({
          propertyId: params.propertyId,
          code: normalizeMasterCode(params.code),
          name: params.name.trim(),
          domain: params.domain.trim().toUpperCase(),
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: taxProfiles.id });
      profileId = createdProfile?.id;
    } else {
      const [owned] = await tx
        .select({ id: taxProfiles.id })
        .from(taxProfiles)
        .where(
          and(
            eq(taxProfiles.id, profileId),
            eq(taxProfiles.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Tax profile not found");
    }
    if (!profileId) throw new Error("Failed to create tax profile");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`tax-profile:${profileId}`}, 0))`,
    );
    const existing = await tx
      .select({ versionNumber: taxProfileVersions.versionNumber })
      .from(taxProfileVersions)
      .where(eq(taxProfileVersions.taxProfileId, profileId));
    const versionNumber = nextVersionNumber(existing);
    const [created] = await tx
      .insert(taxProfileVersions)
      .values({
        taxProfileId: profileId,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus: "PENDING",
        taxRate: params.taxRate,
        serviceChargeRate: params.serviceChargeRate,
        taxInclusive: params.taxInclusive,
        serviceChargeInclusive: params.serviceChargeInclusive,
        noTax: params.noTax,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo ?? null,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: taxProfileVersions.id });
    if (!created) throw new Error("Failed to create tax version");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.tax.version.create",
        targetType: "tax_profile_version",
        targetId: created.id,
        after: {
          profileId,
          versionNumber,
          taxRate: params.taxRate,
          serviceChargeRate: params.serviceChargeRate,
          noTax: params.noTax,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: created.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus: "PENDING",
    };
  });
}

export async function createPolicyDraft(params: {
  session: StaffSession;
  propertyId: string;
  policySetId?: string;
  code: string;
  policyType: string;
  titleId: string;
  titleEn: string;
  summaryId?: string | null;
  summaryEn?: string | null;
  contentId: string;
  contentEn: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  assertEffectivePeriod(params.effectiveFrom, params.effectiveTo);
  const checksum = createHash("sha256")
    .update(
      [params.titleId, params.titleEn, params.contentId, params.contentEn].join(
        "\u0000",
      ),
    )
    .digest("hex");
  return getDatabase().transaction(async (tx) => {
    let policySetId = params.policySetId;
    if (!policySetId) {
      const [createdSet] = await tx
        .insert(policySets)
        .values({
          propertyId: params.propertyId,
          code: normalizeMasterCode(params.code),
          policyType: params.policyType.trim().toUpperCase(),
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: policySets.id });
      policySetId = createdSet?.id;
    } else {
      const [owned] = await tx
        .select({ id: policySets.id })
        .from(policySets)
        .where(
          and(
            eq(policySets.id, policySetId),
            eq(policySets.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Policy set not found");
    }
    if (!policySetId) throw new Error("Failed to create policy set");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`policy-set:${policySetId}`}, 0))`,
    );
    const existing = await tx
      .select({ versionNumber: policyVersions.versionNumber })
      .from(policyVersions)
      .where(eq(policyVersions.policySetId, policySetId));
    const versionNumber = nextVersionNumber(existing);
    const [created] = await tx
      .insert(policyVersions)
      .values({
        policySetId,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus: "PENDING",
        titleId: params.titleId.trim(),
        titleEn: params.titleEn.trim(),
        summaryId: params.summaryId ?? null,
        summaryEn: params.summaryEn ?? null,
        contentId: params.contentId,
        contentEn: params.contentEn,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo ?? null,
        checksum,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: policyVersions.id });
    if (!created) throw new Error("Failed to create policy version");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.policy.version.create",
        targetType: "policy_version",
        targetId: created.id,
        after: { policySetId, versionNumber, checksum, locales: ["id", "en"] },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: created.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus: "PENDING",
    };
  });
}

export async function createPaymentInstructionDraft(params: {
  session: StaffSession;
  propertyId: string;
  instructionSetId?: string;
  code: string;
  name: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  instructionId: string;
  instructionEn: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  assertEffectivePeriod(params.effectiveFrom, params.effectiveTo);
  const normalizedAccount = params.accountNumber.replace(/[\s-]+/gu, "");
  if (normalizedAccount.length < 4 || normalizedAccount.length > 40) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Account number must contain 4-40 characters",
    );
  }
  const encryptedAccount = encryptSensitiveValue(normalizedAccount);
  const last4 = normalizedAccount.slice(-4);
  return getDatabase().transaction(async (tx) => {
    let instructionSetId = params.instructionSetId;
    if (!instructionSetId) {
      const [createdSet] = await tx
        .insert(paymentInstructionSets)
        .values({
          propertyId: params.propertyId,
          code: normalizeMasterCode(params.code),
          name: params.name.trim(),
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: paymentInstructionSets.id });
      instructionSetId = createdSet?.id;
    } else {
      const [owned] = await tx
        .select({ id: paymentInstructionSets.id })
        .from(paymentInstructionSets)
        .where(
          and(
            eq(paymentInstructionSets.id, instructionSetId),
            eq(paymentInstructionSets.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned)
        throw new AppError("NOT_FOUND", "Payment instruction set not found");
    }
    if (!instructionSetId) throw new Error("Failed to create instruction set");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`payment-instruction:${instructionSetId}`}, 0))`,
    );
    const existing = await tx
      .select({ versionNumber: paymentInstructionVersions.versionNumber })
      .from(paymentInstructionVersions)
      .where(eq(paymentInstructionVersions.instructionSetId, instructionSetId));
    const versionNumber = nextVersionNumber(existing);
    const [created] = await tx
      .insert(paymentInstructionVersions)
      .values({
        instructionSetId,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus: "PENDING",
        bankName: params.bankName.trim(),
        accountHolder: params.accountHolder.trim(),
        accountNumberCiphertext: encryptedAccount,
        accountNumberLast4: last4,
        currency: "IDR",
        instructionId: params.instructionId,
        instructionEn: params.instructionEn,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo ?? null,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: paymentInstructionVersions.id });
    if (!created)
      throw new Error("Failed to create payment instruction version");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.payment_instruction.version.create",
        targetType: "payment_instruction_version",
        targetId: created.id,
        after: {
          instructionSetId,
          versionNumber,
          bankName: params.bankName,
          accountNumberLast4: last4,
          currency: "IDR",
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: created.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus: "PENDING",
    };
  });
}

export async function createExchangeRateSnapshot(params: {
  session: StaffSession;
  propertyId: string;
  quoteCurrency: "USD" | "AUD";
  rate: string;
  source: string;
  asOfAt: Date;
  expiresAt: Date;
  roundingRule?: Record<string, unknown> | null;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  if (Number(params.rate) <= 0 || params.expiresAt <= params.asOfAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Exchange rate and validity period are invalid",
    );
  }
  return getDatabase().transaction(async (tx) => {
    const [created] = await tx
      .insert(exchangeRateSnapshots)
      .values({
        propertyId: params.propertyId,
        baseCurrency: "IDR",
        quoteCurrency: params.quoteCurrency,
        rate: params.rate,
        source: params.source.trim(),
        asOfAt: params.asOfAt,
        expiresAt: params.expiresAt,
        roundingRule: params.roundingRule ?? null,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: exchangeRateSnapshots.id });
    if (!created) throw new Error("Failed to create exchange rate snapshot");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.exchange_rate.create",
        targetType: "exchange_rate_snapshot",
        targetId: created.id,
        after: {
          baseCurrency: "IDR",
          quoteCurrency: params.quoteCurrency,
          rate: params.rate,
          source: params.source,
          asOfAt: params.asOfAt.toISOString(),
          expiresAt: params.expiresAt.toISOString(),
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export async function createDocumentProfileDraft(params: {
  session: StaffSession;
  propertyId: string;
  documentProfileId?: string;
  code: string;
  legalName: string;
  displayName: string;
  address: string;
  contact?: string | null;
  taxIdentity?: string | null;
  logoFileId?: string | null;
  footerId?: string | null;
  footerEn?: string | null;
  templateReference: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  assertEffectivePeriod(params.effectiveFrom, params.effectiveTo);
  const taxIdentityCiphertext = params.taxIdentity
    ? encryptSensitiveValue(params.taxIdentity.trim())
    : null;
  return getDatabase().transaction(async (tx) => {
    let documentProfileId = params.documentProfileId;
    if (!documentProfileId) {
      const [createdProfile] = await tx
        .insert(documentProfiles)
        .values({
          propertyId: params.propertyId,
          code: normalizeMasterCode(params.code),
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: documentProfiles.id });
      documentProfileId = createdProfile?.id;
    } else {
      const [owned] = await tx
        .select({ id: documentProfiles.id })
        .from(documentProfiles)
        .where(
          and(
            eq(documentProfiles.id, documentProfileId),
            eq(documentProfiles.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Document profile not found");
    }
    if (!documentProfileId)
      throw new Error("Failed to create document profile");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`document-profile:${documentProfileId}`}, 0))`,
    );
    const existing = await tx
      .select({ versionNumber: documentProfileVersions.versionNumber })
      .from(documentProfileVersions)
      .where(eq(documentProfileVersions.documentProfileId, documentProfileId));
    const versionNumber = nextVersionNumber(existing);
    const [created] = await tx
      .insert(documentProfileVersions)
      .values({
        documentProfileId,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus: "PENDING",
        legalName: params.legalName.trim(),
        displayName: params.displayName.trim(),
        address: params.address.trim(),
        contact: params.contact ?? null,
        taxIdentityCiphertext,
        logoFileId: params.logoFileId ?? null,
        footerId: params.footerId ?? null,
        footerEn: params.footerEn ?? null,
        templateReference: params.templateReference.trim(),
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo ?? null,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: documentProfileVersions.id });
    if (!created) throw new Error("Failed to create document profile version");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.document_profile.version.create",
        targetType: "document_profile_version",
        targetId: created.id,
        after: {
          documentProfileId,
          versionNumber,
          templateReference: params.templateReference,
          hasTaxIdentity: Boolean(params.taxIdentity),
          logoFileId: params.logoFileId ?? null,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: created.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus: "PENDING",
    };
  });
}

export async function createDocumentSequence(params: {
  session: StaffSession;
  propertyId: string;
  documentType: string;
  periodKey: string;
  prefix: string;
  nextValue?: number;
  padding?: number;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  const nextValue = params.nextValue ?? 1;
  const padding = params.padding ?? 5;
  if (
    !Number.isInteger(nextValue) ||
    nextValue < 1 ||
    !Number.isInteger(padding) ||
    padding < 1 ||
    padding > 12
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid document sequence values");
  }
  return getDatabase().transaction(async (tx) => {
    const [created] = await tx
      .insert(documentSequences)
      .values({
        propertyId: params.propertyId,
        documentType: params.documentType.trim().toUpperCase(),
        periodKey: params.periodKey.trim().toUpperCase(),
        prefix: params.prefix.trim(),
        nextValue,
        padding,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: documentSequences.id });
    if (!created) throw new Error("Failed to create document sequence");
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.document_sequence.create",
        targetType: "document_sequence",
        targetId: created.id,
        after: {
          documentType: params.documentType,
          periodKey: params.periodKey,
          prefix: params.prefix,
          nextValue,
          padding,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: created.id };
  });
}

export interface RateRuleInput {
  roomTypeId: string;
  name: string;
  ruleType: "BASE" | "WEEK_PATTERN" | "SEASONAL" | "SPECIAL_DATE";
  priority: number;
  startsOn: string;
  endsOn: string;
  weekdaysMask: number;
  nightlyRateIdr: string;
  minimumStay?: number;
  maximumStay?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  dateOverrides?: {
    stayDate: string;
    nightlyRateIdr: string;
    salesClosed?: boolean;
  }[];
}

export async function createRatePlanDraft(params: {
  session: StaffSession;
  propertyId: string;
  ratePlanId?: string;
  code: string;
  nameId: string;
  nameEn: string;
  sourceEligibility?: string;
  paymentInstructionSetId?: string | null;
  cancellationPolicySetId?: string | null;
  taxProfileId?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  rules: RateRuleInput[];
  requiresApproval?: boolean;
  reason: string;
}): Promise<MutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "commercial.manage",
  );
  const reason = checkedReason(params.reason);
  assertEffectivePeriod(params.effectiveFrom, params.effectiveTo);
  if (params.rules.length === 0)
    throw new AppError(
      "VALIDATION_ERROR",
      "A rate plan requires at least one rate rule",
    );
  for (const rule of params.rules) {
    if (
      Number(rule.nightlyRateIdr) <= 0 ||
      rule.endsOn < rule.startsOn ||
      rule.weekdaysMask < 1 ||
      rule.weekdaysMask > 127
    ) {
      throw new AppError("VALIDATION_ERROR", `Invalid rate rule: ${rule.name}`);
    }
  }
  return getDatabase().transaction(async (tx) => {
    const roomTypeIds = [
      ...new Set(params.rules.map((rule) => rule.roomTypeId)),
    ];
    const ownedRoomTypes = await tx
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, params.propertyId),
          inArray(roomTypes.id, roomTypeIds),
        ),
      );
    if (ownedRoomTypes.length !== roomTypeIds.length) {
      throw new AppError(
        "VALIDATION_ERROR",
        "One or more room types do not belong to this property",
      );
    }
    let ratePlanId = params.ratePlanId;
    if (!ratePlanId) {
      const [createdPlan] = await tx
        .insert(ratePlans)
        .values({
          propertyId: params.propertyId,
          code: normalizeMasterCode(params.code),
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: ratePlans.id });
      ratePlanId = createdPlan?.id;
    } else {
      const [owned] = await tx
        .select({ id: ratePlans.id })
        .from(ratePlans)
        .where(
          and(
            eq(ratePlans.id, ratePlanId),
            eq(ratePlans.propertyId, params.propertyId),
          ),
        )
        .limit(1);
      if (!owned) throw new AppError("NOT_FOUND", "Rate plan not found");
    }
    if (!ratePlanId) throw new Error("Failed to create rate plan");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`rate-plan:${ratePlanId}`}, 0))`,
    );
    const existing = await tx
      .select({ versionNumber: ratePlanVersions.versionNumber })
      .from(ratePlanVersions)
      .where(eq(ratePlanVersions.ratePlanId, ratePlanId));
    const versionNumber = nextVersionNumber(existing);
    const [version] = await tx
      .insert(ratePlanVersions)
      .values({
        ratePlanId,
        versionNumber,
        lifecycleStatus: "DRAFT",
        approvalStatus: params.requiresApproval ? "PENDING" : "NOT_REQUIRED",
        nameId: params.nameId.trim(),
        nameEn: params.nameEn.trim(),
        sourceEligibility: params.sourceEligibility ?? "ALL",
        paymentInstructionSetId: params.paymentInstructionSetId ?? null,
        cancellationPolicySetId: params.cancellationPolicySetId ?? null,
        taxProfileId: params.taxProfileId ?? null,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo ?? null,
        reason,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: ratePlanVersions.id });
    if (!version) throw new Error("Failed to create rate plan version");

    for (const rule of params.rules) {
      const [createdRule] = await tx
        .insert(rateRules)
        .values({
          ratePlanVersionId: version.id,
          roomTypeId: rule.roomTypeId,
          name: rule.name.trim(),
          ruleType: rule.ruleType,
          priority: rule.priority,
          startsOn: rule.startsOn,
          endsOn: rule.endsOn,
          weekdaysMask: rule.weekdaysMask,
          nightlyRateIdr: rule.nightlyRateIdr,
          minimumStay: rule.minimumStay ?? 1,
          maximumStay: rule.maximumStay ?? null,
          closedToArrival: rule.closedToArrival ?? false,
          closedToDeparture: rule.closedToDeparture ?? false,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: rateRules.id });
      if (!createdRule) throw new Error("Failed to create rate rule");
      if (rule.dateOverrides?.length) {
        await tx.insert(rateRuleDates).values(
          rule.dateOverrides.map((override) => ({
            rateRuleId: createdRule.id,
            stayDate: override.stayDate,
            nightlyRateIdr: override.nightlyRateIdr,
            salesClosed: override.salesClosed ?? false,
            createdByUserId: params.session.user.id,
            updatedByUserId: params.session.user.id,
          })),
        );
      }
    }
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "commercial.rate_plan.version.create",
        targetType: "rate_plan_version",
        targetId: version.id,
        after: {
          ratePlanId,
          versionNumber,
          ruleCount: params.rules.length,
          roomTypeIds,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return {
      id: version.id,
      versionNumber,
      lifecycleStatus: "DRAFT",
      approvalStatus: params.requiresApproval ? "PENDING" : "NOT_REQUIRED",
    };
  });
}

const ruleTypeRank: Record<RateRuleInput["ruleType"], number> = {
  BASE: 1,
  WEEK_PATTERN: 2,
  SEASONAL: 3,
  SPECIAL_DATE: 4,
};

/** Deterministic special-date → seasonal → weekday → base resolver. */
export async function resolveNightlyRate(params: {
  propertyId: string;
  ratePlanCode: string;
  roomTypeId: string;
  stayDate: string;
  at?: Date;
}) {
  const db = getDatabase();
  const at = params.at ?? new Date();
  const versions = await db
    .select({
      ratePlanId: ratePlans.id,
      ratePlanVersionId: ratePlanVersions.id,
      versionNumber: ratePlanVersions.versionNumber,
      lifecycleStatus: ratePlanVersions.lifecycleStatus,
      approvalStatus: ratePlanVersions.approvalStatus,
      effectiveFrom: ratePlanVersions.effectiveFrom,
      effectiveTo: ratePlanVersions.effectiveTo,
    })
    .from(ratePlans)
    .innerJoin(ratePlanVersions, eq(ratePlanVersions.ratePlanId, ratePlans.id))
    .where(
      and(
        eq(ratePlans.propertyId, params.propertyId),
        eq(ratePlans.code, normalizeMasterCode(params.ratePlanCode)),
        eq(ratePlans.status, "ACTIVE"),
        inArray(ratePlanVersions.lifecycleStatus, ["ACTIVE", "SCHEDULED"]),
      ),
    )
    .orderBy(desc(ratePlanVersions.effectiveFrom));
  const version = versions.find((candidate) => isEffectiveAt(candidate, at));
  if (!version) throw new AppError("NOT_FOUND", "No active rate plan version");

  const candidates = await db
    .select({
      id: rateRules.id,
      name: rateRules.name,
      ruleType: rateRules.ruleType,
      priority: rateRules.priority,
      startsOn: rateRules.startsOn,
      endsOn: rateRules.endsOn,
      weekdaysMask: rateRules.weekdaysMask,
      nightlyRateIdr: rateRules.nightlyRateIdr,
      minimumStay: rateRules.minimumStay,
      maximumStay: rateRules.maximumStay,
      closedToArrival: rateRules.closedToArrival,
      closedToDeparture: rateRules.closedToDeparture,
    })
    .from(rateRules)
    .where(
      and(
        eq(rateRules.ratePlanVersionId, version.ratePlanVersionId),
        eq(rateRules.roomTypeId, params.roomTypeId),
        lte(rateRules.startsOn, params.stayDate),
        gte(rateRules.endsOn, params.stayDate),
      ),
    )
    .orderBy(desc(rateRules.priority), asc(rateRules.id));
  const weekday = new Date(`${params.stayDate}T00:00:00.000Z`).getUTCDay();
  const applicable = candidates.filter(
    (candidate) => (candidate.weekdaysMask & (1 << weekday)) !== 0,
  );
  if (applicable.length === 0) {
    throw new AppError("NOT_FOUND", "No rate is configured for this date");
  }
  const overrides = await db
    .select({
      rateRuleId: rateRuleDates.rateRuleId,
      nightlyRateIdr: rateRuleDates.nightlyRateIdr,
      salesClosed: rateRuleDates.salesClosed,
    })
    .from(rateRuleDates)
    .where(
      and(
        inArray(
          rateRuleDates.rateRuleId,
          applicable.map((rule) => rule.id),
        ),
        eq(rateRuleDates.stayDate, params.stayDate),
      ),
    );
  const overrideByRule = new Map(overrides.map((row) => [row.rateRuleId, row]));
  applicable.sort((left, right) => {
    const overrideDelta =
      Number(overrideByRule.has(right.id)) -
      Number(overrideByRule.has(left.id));
    if (overrideDelta) return overrideDelta;
    const typeDelta =
      (ruleTypeRank[right.ruleType as RateRuleInput["ruleType"]] ?? 0) -
      (ruleTypeRank[left.ruleType as RateRuleInput["ruleType"]] ?? 0);
    if (typeDelta) return typeDelta;
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.id.localeCompare(right.id);
  });
  const winner = applicable[0];
  if (!winner)
    throw new AppError("NOT_FOUND", "No rate is configured for this date");
  const override = overrideByRule.get(winner.id);
  if (override?.salesClosed)
    throw new AppError("CONFLICT", "Sales are closed for this date");
  return {
    ratePlanId: version.ratePlanId,
    ratePlanVersionId: version.ratePlanVersionId,
    ratePlanVersionNumber: version.versionNumber,
    rateRuleId: winner.id,
    ruleName: winner.name,
    ruleType: override ? "SPECIAL_DATE" : winner.ruleType,
    stayDate: params.stayDate,
    nightlyRateIdr: override?.nightlyRateIdr ?? winner.nightlyRateIdr,
    minimumStay: winner.minimumStay,
    maximumStay: winner.maximumStay,
    closedToArrival: winner.closedToArrival,
    closedToDeparture: winner.closedToDeparture,
  };
}
