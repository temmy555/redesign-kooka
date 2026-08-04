import { NextResponse } from "next/server";
import { z } from "zod";

import {
  publishCommercialVersion,
  retireCommercialVersion,
  reviewCommercialVersion,
} from "../../../../../src/modules/configuration/commercial-lifecycle";
import {
  createDocumentProfileDraft,
  createDocumentSequence,
  createExchangeRateSnapshot,
  createPaymentInstructionDraft,
  createPolicyDraft,
  createRatePlanDraft,
  createTaxProfileDraft,
  getCommercialMasterOverview,
  resolveNightlyRate,
} from "../../../../../src/modules/configuration/commercial-master";
import {
  AuthorizationError,
  requirePermission,
} from "../../../../../src/platform/authorization";
import { AppError, toErrorResponse } from "../../../../../src/platform/errors";
import { getActivePropertyId } from "../../../../../src/platform/property";
import { requireCurrentSession } from "../../../../../src/platform/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const reason = z.string().trim().min(3).max(500);
const nullableDate = z.coerce.date().nullable().optional();
const decimal = z.union([z.string(), z.number()]).transform(String);
const versionSubject = z.enum([
  "TAX_PROFILE",
  "POLICY",
  "PAYMENT_INSTRUCTION",
  "DOCUMENT_PROFILE",
  "RATE_PLAN",
]);

const rateRule = z.object({
  roomTypeId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  ruleType: z.enum(["BASE", "WEEK_PATTERN", "SEASONAL", "SPECIAL_DATE"]),
  priority: z.number().int(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  weekdaysMask: z.number().int().min(1).max(127),
  nightlyRateIdr: decimal,
  minimumStay: z.number().int().min(1).optional(),
  maximumStay: z.number().int().min(1).nullable().optional(),
  closedToArrival: z.boolean().optional(),
  closedToDeparture: z.boolean().optional(),
  dateOverrides: z
    .array(
      z.object({
        stayDate: z.iso.date(),
        nightlyRateIdr: decimal,
        salesClosed: z.boolean().optional(),
      }),
    )
    .optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_TAX_DRAFT"),
    profileId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    domain: z.string().trim().min(1).max(48),
    taxRate: decimal,
    serviceChargeRate: decimal,
    taxInclusive: z.boolean(),
    serviceChargeInclusive: z.boolean(),
    noTax: z.boolean(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: nullableDate,
    reason,
  }),
  z.object({
    action: z.literal("CREATE_POLICY_DRAFT"),
    policySetId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(80),
    policyType: z.string().trim().min(1).max(48),
    titleId: z.string().trim().min(1).max(200),
    titleEn: z.string().trim().min(1).max(200),
    summaryId: z.string().nullable().optional(),
    summaryEn: z.string().nullable().optional(),
    contentId: z.string().min(1),
    contentEn: z.string().min(1),
    effectiveFrom: z.coerce.date(),
    effectiveTo: nullableDate,
    reason,
  }),
  z.object({
    action: z.literal("CREATE_PAYMENT_INSTRUCTION_DRAFT"),
    instructionSetId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    bankName: z.string().trim().min(1).max(120),
    accountHolder: z.string().trim().min(1).max(160),
    accountNumber: z.string().trim().min(4).max(60),
    instructionId: z.string().min(1),
    instructionEn: z.string().min(1),
    effectiveFrom: z.coerce.date(),
    effectiveTo: nullableDate,
    reason,
  }),
  z.object({
    action: z.literal("CREATE_EXCHANGE_RATE"),
    quoteCurrency: z.enum(["USD", "AUD"]),
    rate: decimal,
    source: z.string().trim().min(1).max(120),
    asOfAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    roundingRule: z.record(z.string(), z.unknown()).nullable().optional(),
    reason,
  }),
  z.object({
    action: z.literal("CREATE_DOCUMENT_SEQUENCE"),
    documentType: z.string().trim().min(1).max(40),
    periodKey: z.string().trim().min(1).max(20),
    prefix: z.string().trim().min(1).max(40),
    nextValue: z.number().int().min(1).optional(),
    padding: z.number().int().min(1).max(12).optional(),
    reason,
  }),
  z.object({
    action: z.literal("CREATE_DOCUMENT_PROFILE_DRAFT"),
    documentProfileId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(80),
    legalName: z.string().trim().min(1).max(200),
    displayName: z.string().trim().min(1).max(200),
    address: z.string().trim().min(1),
    contact: z.string().nullable().optional(),
    taxIdentity: z.string().nullable().optional(),
    logoFileId: z.string().uuid().nullable().optional(),
    footerId: z.string().nullable().optional(),
    footerEn: z.string().nullable().optional(),
    templateReference: z.string().trim().min(1).max(160),
    effectiveFrom: z.coerce.date(),
    effectiveTo: nullableDate,
    reason,
  }),
  z.object({
    action: z.literal("CREATE_RATE_PLAN_DRAFT"),
    ratePlanId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(64),
    nameId: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160),
    sourceEligibility: z.string().trim().min(1).max(80).optional(),
    paymentInstructionSetId: z.string().uuid().nullable().optional(),
    cancellationPolicySetId: z.string().uuid().nullable().optional(),
    taxProfileId: z.string().uuid().nullable().optional(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: nullableDate,
    rules: z.array(rateRule).min(1),
    requiresApproval: z.boolean().optional(),
    reason,
  }),
  z.object({
    action: z.literal("REVIEW_VERSION"),
    subject: versionSubject,
    versionId: z.string().uuid(),
    decision: z.enum(["APPROVE", "REJECT"]),
    reason,
  }),
  z.object({
    action: z.literal("PUBLISH_VERSION"),
    subject: versionSubject,
    versionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("RETIRE_VERSION"),
    subject: versionSubject,
    versionId: z.string().uuid(),
    reason,
  }),
  z.object({
    action: z.literal("PREVIEW_RESOLVED_RATE"),
    ratePlanCode: z.string().trim().min(1).max(64),
    roomTypeId: z.string().uuid(),
    stayDate: z.iso.date(),
  }),
]);

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Forbidden" } },
      { status: 403 },
    );
  }
  const normalized =
    error instanceof z.ZodError
      ? new AppError("VALIDATION_ERROR", "Invalid request")
      : error;
  const response = toErrorResponse(normalized);
  return NextResponse.json(response.body, { status: response.status });
}

async function context() {
  const session = await requireCurrentSession();
  const propertyId = await getActivePropertyId();
  return { session, propertyId };
}

export async function GET() {
  try {
    return NextResponse.json(
      await getCommercialMasterOverview(await context()),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    ) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    }
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const requestContext = await context();
    const body = actionSchema.parse(await request.json());
    switch (body.action) {
      case "CREATE_TAX_DRAFT":
        return NextResponse.json(
          await createTaxProfileDraft({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_POLICY_DRAFT":
        return NextResponse.json(
          await createPolicyDraft({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_PAYMENT_INSTRUCTION_DRAFT":
        return NextResponse.json(
          await createPaymentInstructionDraft({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_EXCHANGE_RATE":
        return NextResponse.json(
          await createExchangeRateSnapshot({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_DOCUMENT_PROFILE_DRAFT":
        return NextResponse.json(
          await createDocumentProfileDraft({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_DOCUMENT_SEQUENCE":
        return NextResponse.json(
          await createDocumentSequence({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "CREATE_RATE_PLAN_DRAFT":
        return NextResponse.json(
          await createRatePlanDraft({ ...requestContext, ...body }),
          { status: 201 },
        );
      case "REVIEW_VERSION":
        return NextResponse.json(
          await reviewCommercialVersion({ ...requestContext, ...body }),
        );
      case "PUBLISH_VERSION":
        return NextResponse.json(
          await publishCommercialVersion({ ...requestContext, ...body }),
        );
      case "RETIRE_VERSION":
        return NextResponse.json(
          await retireCommercialVersion({ ...requestContext, ...body }),
        );
      case "PREVIEW_RESOLVED_RATE":
        await requirePermission(
          requestContext.session,
          requestContext.propertyId,
          "commercial.view",
        );
        return NextResponse.json(
          await resolveNightlyRate({
            propertyId: requestContext.propertyId,
            ratePlanCode: body.ratePlanCode,
            roomTypeId: body.roomTypeId,
            stayDate: body.stayDate,
          }),
        );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No authenticated staff session"
    ) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthenticated" } },
        { status: 401 },
      );
    }
    return errorResponse(error);
  }
}
