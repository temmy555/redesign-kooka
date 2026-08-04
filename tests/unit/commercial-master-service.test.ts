import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    leftJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    set: () => link,
    values: () => link,
    returning: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  encryptSensitiveValue: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    execute: mocks.execute,
    transaction: mocks.transaction,
  }),
}));
vi.mock("../../src/platform/authorization", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/encryption", () => ({
  encryptSensitiveValue: mocks.encryptSensitiveValue,
}));

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
} from "../../src/modules/configuration/commercial-master";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const session = { user: { id: U1 } };
const effectiveFrom = new Date("2026-08-03T00:00:00.000Z");

describe("commercial master service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.encryptSensitiveValue.mockReturnValue("encrypted-value");
    mocks.insert.mockReturnValue(chain());
    mocks.update.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.transaction.mockImplementation(
      async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          select: mocks.select,
          insert: mocks.insert,
          update: mocks.update,
          execute: mocks.execute,
        }),
    );
  });

  it("returns all commercial master collections", async () => {
    for (let index = 0; index < 8; index += 1) {
      mocks.select.mockReturnValueOnce(chain([{ id: `${index}` }]));
    }
    const result = await getCommercialMasterOverview({
      session,
      propertyId: U1,
    });
    expect(result.taxes).toHaveLength(1);
    expect(result.ratePlans).toHaveLength(1);
    expect(result.rateRules).toHaveLength(1);
    expect(result.documentSequences).toHaveLength(1);
  });

  it("creates a versioned tax profile and validates no-tax rules", async () => {
    mocks.select.mockReturnValueOnce(chain([{ versionNumber: 1 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createTaxProfileDraft({
      session,
      propertyId: U1,
      code: "room tax",
      name: "Room tax",
      domain: "lodging",
      taxRate: "0.10",
      serviceChargeRate: "0.05",
      taxInclusive: false,
      serviceChargeInclusive: false,
      noTax: false,
      effectiveFrom,
      reason: "Configure lodging tax",
    });
    expect(result).toMatchObject({ id: U3, versionNumber: 2 });
    await expect(
      createTaxProfileDraft({
        session,
        propertyId: U1,
        code: "no tax",
        name: "No tax",
        domain: "tour",
        taxRate: "0.10",
        serviceChargeRate: "0",
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax: true,
        effectiveFrom,
        reason: "Validate no tax profile",
      }),
    ).rejects.toThrow("must use zero");
  });

  it("creates a bilingual cancellation-policy snapshot", async () => {
    mocks.select.mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createPolicyDraft({
      session,
      propertyId: U1,
      code: "cancellation",
      policyType: "cancellation",
      titleId: "Pembatalan",
      titleEn: "Cancellation",
      contentId: "Refund diproses manual.",
      contentEn: "Refunds are processed manually.",
      effectiveFrom,
      reason: "Record cancellation policy",
    });
    expect(result.approvalStatus).toBe("PENDING");
  });

  it("encrypts bank account details for payment instructions", async () => {
    mocks.select.mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createPaymentInstructionDraft({
      session,
      propertyId: U1,
      code: "bca transfer",
      name: "BCA Transfer",
      bankName: "BCA",
      accountHolder: "KOOKA Residence",
      accountNumber: "1234-5678-9012",
      instructionId: "Transfer lalu kirim bukti via WhatsApp.",
      instructionEn: "Transfer and send proof via WhatsApp.",
      effectiveFrom,
      reason: "Configure transfer destination",
    });
    expect(result.id).toBe(U3);
    expect(mocks.encryptSensitiveValue).toHaveBeenCalledWith("123456789012");
  });

  it("creates preference-only exchange-rate snapshots", async () => {
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createExchangeRateSnapshot({
      session,
      propertyId: U1,
      quoteCurrency: "AUD",
      rate: "0.000095",
      source: "Manual preference",
      asOfAt: new Date("2026-08-02T00:00:00.000Z"),
      expiresAt: new Date("2026-08-03T00:00:00.000Z"),
      reason: "Refresh display estimate",
    });
    expect(result.id).toBe(U3);
  });

  it("creates an auditable invoice document profile", async () => {
    mocks.select.mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createDocumentProfileDraft({
      session,
      propertyId: U1,
      code: "invoice",
      legalName: "KOOKA Residence",
      displayName: "KOOKA",
      address: "Surabaya",
      contact: "+62 812",
      taxIdentity: "NPWP-123",
      templateReference: "invoice-v1",
      effectiveFrom,
      reason: "Configure financial documents",
    });
    expect(result.id).toBe(U3);
    expect(mocks.encryptSensitiveValue).toHaveBeenCalledWith("NPWP-123");
  });

  it("creates validated document numbering sequences", async () => {
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createDocumentSequence({
      session,
      propertyId: U1,
      documentType: "invoice",
      periodKey: "2026-08",
      prefix: "INV-",
      reason: "Configure invoice sequence",
    });
    expect(result.id).toBe(U3);
    await expect(
      createDocumentSequence({
        session,
        propertyId: U1,
        documentType: "invoice",
        periodKey: "2026-08",
        prefix: "INV-",
        padding: 0,
        reason: "Validate sequence",
      }),
    ).rejects.toThrow("Invalid document sequence");
  });

  it("creates a rate plan with a special-date override", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ versionNumber: 1 }]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain());
    const result = await createRatePlanDraft({
      session,
      propertyId: U1,
      code: "bar",
      nameId: "Best Available Rate",
      nameEn: "Best Available Rate",
      effectiveFrom,
      requiresApproval: true,
      reason: "Configure public room price",
      rules: [
        {
          roomTypeId: U2,
          name: "Base Deluxe",
          ruleType: "BASE",
          priority: 1,
          startsOn: "2026-08-03",
          endsOn: "2026-12-31",
          weekdaysMask: 127,
          nightlyRateIdr: "500000",
          dateOverrides: [{ stayDate: "2026-08-17", nightlyRateIdr: "600000" }],
        },
      ],
    });
    expect(result).toMatchObject({ id: U3, approvalStatus: "PENDING" });
  });

  it("resolves special-date rates ahead of ordinary rules", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            ratePlanId: U1,
            ratePlanVersionId: U2,
            versionNumber: 1,
            lifecycleStatus: "ACTIVE",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            name: "Base",
            ruleType: "BASE",
            priority: 1,
            startsOn: "2026-01-01",
            endsOn: "2026-12-31",
            weekdaysMask: 127,
            nightlyRateIdr: "500000",
            minimumStay: 1,
            maximumStay: null,
            closedToArrival: false,
            closedToDeparture: false,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          { rateRuleId: U3, nightlyRateIdr: "600000", salesClosed: false },
        ]),
      );
    const result = await resolveNightlyRate({
      propertyId: U1,
      ratePlanCode: "bar",
      roomTypeId: U2,
      stayDate: "2026-08-03",
      at: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(result).toMatchObject({
      ruleType: "SPECIAL_DATE",
      nightlyRateIdr: "600000",
    });
  });

  it("appends versions to existing owned commercial masters", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    expect(
      (
        await createTaxProfileDraft({
          session,
          propertyId: U1,
          profileId: U2,
          code: "no-tax",
          name: "No tax",
          domain: "service",
          taxRate: "0",
          serviceChargeRate: "0",
          taxInclusive: true,
          serviceChargeInclusive: true,
          noTax: true,
          effectiveFrom,
          effectiveTo: new Date("2099-01-01T00:00:00.000Z"),
          reason: "Append no-tax version",
        })
      ).versionNumber,
    ).toBe(1);

    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    expect(
      (
        await createPolicyDraft({
          session,
          propertyId: U1,
          policySetId: U2,
          code: "house-rules",
          policyType: "HOUSE_RULES",
          titleId: "Peraturan",
          titleEn: "House rules",
          summaryId: "Ringkas",
          summaryEn: "Summary",
          contentId: "Konten",
          contentEn: "Content",
          effectiveFrom,
          reason: "Append house rules",
        })
      ).id,
    ).toBe(U3);

    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    expect(
      (
        await createPaymentInstructionDraft({
          session,
          propertyId: U1,
          instructionSetId: U2,
          code: "transfer",
          name: "Transfer",
          bankName: "BCA",
          accountHolder: "KOOKA",
          accountNumber: "1234",
          instructionId: "Instruksi",
          instructionEn: "Instruction",
          effectiveFrom,
          reason: "Append transfer details",
        })
      ).id,
    ).toBe(U3);

    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert.mockReturnValueOnce(chain([{ id: U3 }]));
    expect(
      (
        await createDocumentProfileDraft({
          session,
          propertyId: U1,
          documentProfileId: U2,
          code: "receipt",
          legalName: "KOOKA Residence",
          displayName: "KOOKA",
          address: "Surabaya",
          templateReference: "receipt-v1",
          effectiveFrom,
          reason: "Append receipt profile",
        })
      ).id,
    ).toBe(U3);

    mocks.select.mockReset();
    mocks.insert.mockReset();
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ id: U1 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain([{ id: U3 }]))
      .mockReturnValueOnce(chain([{ id: U2 }]));
    expect(
      (
        await createRatePlanDraft({
          session,
          propertyId: U1,
          ratePlanId: U1,
          code: "bar",
          nameId: "BAR",
          nameEn: "BAR",
          sourceEligibility: "ADMIN_MANUAL",
          effectiveFrom,
          reason: "Append manual rate version",
          rules: [
            {
              roomTypeId: U2,
              name: "Weekday",
              ruleType: "WEEK_PATTERN",
              priority: 2,
              startsOn: "2026-08-03",
              endsOn: "2026-12-31",
              weekdaysMask: 62,
              nightlyRateIdr: "450000",
              minimumStay: 2,
              maximumStay: 7,
              closedToArrival: true,
              closedToDeparture: true,
            },
          ],
        })
      ).approvalStatus,
    ).toBe("NOT_REQUIRED");
  });

  it("rejects malformed financial configuration before database writes", async () => {
    await expect(
      createTaxProfileDraft({
        session,
        propertyId: U1,
        code: "bad-tax",
        name: "Bad tax",
        domain: "ROOM",
        taxRate: "-1",
        serviceChargeRate: "0",
        taxInclusive: false,
        serviceChargeInclusive: false,
        noTax: false,
        effectiveFrom,
        reason: "Validate negative tax",
      }),
    ).rejects.toThrow("non-negative numbers");
    await expect(
      createPaymentInstructionDraft({
        session,
        propertyId: U1,
        code: "bad-account",
        name: "Bad account",
        bankName: "Bank",
        accountHolder: "KOOKA",
        accountNumber: "123",
        instructionId: "Instruksi",
        instructionEn: "Instruction",
        effectiveFrom,
        reason: "Validate account number",
      }),
    ).rejects.toThrow("4-40 characters");
    await expect(
      createExchangeRateSnapshot({
        session,
        propertyId: U1,
        quoteCurrency: "USD",
        rate: "0",
        source: "Invalid",
        asOfAt: new Date("2026-08-03"),
        expiresAt: new Date("2026-08-02"),
        reason: "Validate exchange rate",
      }),
    ).rejects.toThrow("validity period");
    await expect(
      createDocumentSequence({
        session,
        propertyId: U1,
        documentType: "invoice",
        periodKey: "2026",
        prefix: "INV",
        nextValue: 0,
        padding: 13,
        reason: "Validate sequence bounds",
      }),
    ).rejects.toThrow("Invalid document sequence");
    await expect(
      createRatePlanDraft({
        session,
        propertyId: U1,
        code: "empty",
        nameId: "Kosong",
        nameEn: "Empty",
        effectiveFrom,
        rules: [],
        reason: "Validate empty rate plan",
      }),
    ).rejects.toThrow("at least one rate rule");
    await expect(
      createRatePlanDraft({
        session,
        propertyId: U1,
        code: "invalid-rule",
        nameId: "Invalid",
        nameEn: "Invalid",
        effectiveFrom,
        rules: [
          {
            roomTypeId: U2,
            name: "Invalid dates",
            ruleType: "BASE",
            priority: 1,
            startsOn: "2026-12-31",
            endsOn: "2026-01-01",
            weekdaysMask: 0,
            nightlyRateIdr: "0",
          },
        ],
        reason: "Validate rate rule",
      }),
    ).rejects.toThrow("Invalid rate rule");
  });

  it("rejects missing, inapplicable, and sales-closed nightly rates", async () => {
    const version = {
      ratePlanId: U1,
      ratePlanVersionId: U2,
      versionNumber: 1,
      lifecycleStatus: "ACTIVE",
      approvalStatus: "APPROVED",
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
    };
    const request = {
      propertyId: U1,
      ratePlanCode: "BAR",
      roomTypeId: U2,
      stayDate: "2026-08-03",
      at: new Date("2026-08-02"),
    };
    mocks.select.mockReturnValueOnce(chain([]));
    await expect(resolveNightlyRate(request)).rejects.toThrow(
      "No active rate plan version",
    );

    mocks.select.mockReturnValueOnce(chain([version])).mockReturnValueOnce(
      chain([
        {
          id: U3,
          name: "Not Monday",
          ruleType: "BASE",
          priority: 1,
          weekdaysMask: 1,
          nightlyRateIdr: "500000",
        },
      ]),
    );
    await expect(resolveNightlyRate(request)).rejects.toThrow(
      "No rate is configured",
    );

    mocks.select
      .mockReturnValueOnce(chain([version]))
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            name: "Closed",
            ruleType: "BASE",
            priority: 1,
            weekdaysMask: 127,
            nightlyRateIdr: "500000",
            minimumStay: 1,
            maximumStay: null,
            closedToArrival: false,
            closedToDeparture: false,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          { rateRuleId: U3, nightlyRateIdr: "500000", salesClosed: true },
        ]),
      );
    await expect(resolveNightlyRate(request)).rejects.toThrow(
      "Sales are closed",
    );
  });
});
