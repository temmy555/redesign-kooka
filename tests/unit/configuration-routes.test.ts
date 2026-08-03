import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  requirePermission: vi.fn(),
  getCommercialMasterOverview: vi.fn(),
  createTaxProfileDraft: vi.fn(),
  createPolicyDraft: vi.fn(),
  createPaymentInstructionDraft: vi.fn(),
  createExchangeRateSnapshot: vi.fn(),
  createDocumentSequence: vi.fn(),
  createDocumentProfileDraft: vi.fn(),
  createRatePlanDraft: vi.fn(),
  reviewCommercialVersion: vi.fn(),
  publishCommercialVersion: vi.fn(),
  resolveNightlyRate: vi.fn(),
  getPropertyConfigurationOverview: vi.fn(),
  updatePropertyProfile: vi.fn(),
  previewPropertySettingChange: vi.fn(),
  createPropertySettingDraft: vi.fn(),
  reviewPropertySettingVersion: vi.fn(),
  publishPropertySettingVersion: vi.fn(),
  retirePropertySettingVersion: vi.fn(),
  getRoomMasterOverview: vi.fn(),
  archiveRoomMaster: vi.fn(),
  createAmenity: vi.fn(),
  previewRoomTypeDraft: vi.fn(),
  createRoomTypeDraft: vi.fn(),
  reviewRoomTypeVersion: vi.fn(),
  publishRoomTypeVersion: vi.fn(),
  createRoomUnit: vi.fn(),
  changeRoomUnitType: vi.fn(),
  createResourcePool: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/platform/authorization", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/platform/authorization")>();
  return { ...original, requirePermission: mocks.requirePermission };
});
vi.mock("../../src/modules/configuration/commercial-lifecycle", () => ({
  reviewCommercialVersion: mocks.reviewCommercialVersion,
  publishCommercialVersion: mocks.publishCommercialVersion,
}));
vi.mock("../../src/modules/configuration/commercial-master", () => ({
  getCommercialMasterOverview: mocks.getCommercialMasterOverview,
  createTaxProfileDraft: mocks.createTaxProfileDraft,
  createPolicyDraft: mocks.createPolicyDraft,
  createPaymentInstructionDraft: mocks.createPaymentInstructionDraft,
  createExchangeRateSnapshot: mocks.createExchangeRateSnapshot,
  createDocumentSequence: mocks.createDocumentSequence,
  createDocumentProfileDraft: mocks.createDocumentProfileDraft,
  createRatePlanDraft: mocks.createRatePlanDraft,
  resolveNightlyRate: mocks.resolveNightlyRate,
}));
vi.mock("../../src/modules/configuration/property-settings", () => ({
  getPropertyConfigurationOverview: mocks.getPropertyConfigurationOverview,
  updatePropertyProfile: mocks.updatePropertyProfile,
  previewPropertySettingChange: mocks.previewPropertySettingChange,
  createPropertySettingDraft: mocks.createPropertySettingDraft,
  reviewPropertySettingVersion: mocks.reviewPropertySettingVersion,
  publishPropertySettingVersion: mocks.publishPropertySettingVersion,
  retirePropertySettingVersion: mocks.retirePropertySettingVersion,
}));
vi.mock("../../src/modules/configuration/room-master", () => ({
  getRoomMasterOverview: mocks.getRoomMasterOverview,
  archiveRoomMaster: mocks.archiveRoomMaster,
  createAmenity: mocks.createAmenity,
  previewRoomTypeDraft: mocks.previewRoomTypeDraft,
  createRoomTypeDraft: mocks.createRoomTypeDraft,
  reviewRoomTypeVersion: mocks.reviewRoomTypeVersion,
  publishRoomTypeVersion: mocks.publishRoomTypeVersion,
  createRoomUnit: mocks.createRoomUnit,
  changeRoomUnitType: mocks.changeRoomUnitType,
  createResourcePool: mocks.createResourcePool,
}));

import {
  GET as commercialGet,
  POST as commercialPost,
} from "../../app/api/staff/admin/commercial-master/route";
import {
  GET as configurationGet,
  POST as configurationPost,
} from "../../app/api/staff/admin/configuration/route";
import {
  GET as roomGet,
  POST as roomPost,
} from "../../app/api/staff/admin/room-master/route";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const date = "2026-08-03T00:00:00.000Z";

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const roomTypeInput = {
  code: "DELUXE",
  nameId: "Deluxe",
  nameEn: "Deluxe",
  standardAdults: 2,
  maximumAdults: 2,
  maximumChildren: 1,
  maximumTotalGuests: 3,
  extraBedAllowed: true,
  maximumExtraBeds: 1,
  extraBedCapacityIncrement: 1,
  effectiveFrom: date,
  reason: "Initial room type configuration",
};

describe("configuration admin routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
      mock.mockResolvedValue({ ok: true });
    }
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.getActivePropertyId.mockResolvedValue(U2);
  });

  it("returns every configuration overview", async () => {
    const responses = await Promise.all([
      commercialGet(),
      configurationGet(),
      roomGet(),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
  });

  it.each([
    [
      "CREATE_TAX_DRAFT",
      {
        action: "CREATE_TAX_DRAFT",
        code: "ROOM_TAX",
        name: "Room Tax",
        domain: "ROOM",
        taxRate: 0.11,
        serviceChargeRate: 0,
        taxInclusive: true,
        serviceChargeInclusive: true,
        noTax: false,
        effectiveFrom: date,
        reason: "Initial tax profile",
      },
      "createTaxProfileDraft",
    ],
    [
      "CREATE_POLICY_DRAFT",
      {
        action: "CREATE_POLICY_DRAFT",
        code: "HOUSE_RULES",
        policyType: "HOUSE_RULES",
        titleId: "Peraturan",
        titleEn: "House Rules",
        contentId: "Konten kebijakan",
        contentEn: "Policy content",
        effectiveFrom: date,
        reason: "Initial policy",
      },
      "createPolicyDraft",
    ],
    [
      "CREATE_PAYMENT_INSTRUCTION_DRAFT",
      {
        action: "CREATE_PAYMENT_INSTRUCTION_DRAFT",
        code: "BANK_TRANSFER",
        name: "Bank Transfer",
        bankName: "BCA",
        accountHolder: "KOOKA",
        accountNumber: "1234567890",
        instructionId: "Transfer lalu kirim bukti",
        instructionEn: "Transfer and send proof",
        effectiveFrom: date,
        reason: "Initial instruction",
      },
      "createPaymentInstructionDraft",
    ],
    [
      "CREATE_EXCHANGE_RATE",
      {
        action: "CREATE_EXCHANGE_RATE",
        quoteCurrency: "USD",
        rate: 16000,
        source: "Manual Front Office",
        asOfAt: date,
        expiresAt: "2026-08-04T00:00:00.000Z",
        reason: "Daily display preference",
      },
      "createExchangeRateSnapshot",
    ],
    [
      "CREATE_DOCUMENT_SEQUENCE",
      {
        action: "CREATE_DOCUMENT_SEQUENCE",
        documentType: "INVOICE",
        periodKey: "202608",
        prefix: "INV",
        nextValue: 1,
        padding: 5,
        reason: "Initial invoice sequence",
      },
      "createDocumentSequence",
    ],
    [
      "CREATE_DOCUMENT_PROFILE_DRAFT",
      {
        action: "CREATE_DOCUMENT_PROFILE_DRAFT",
        code: "DEFAULT",
        legalName: "KOOKA Residence",
        displayName: "KOOKA Residence",
        address: "Surabaya",
        templateReference: "default-v1",
        effectiveFrom: date,
        reason: "Initial document profile",
      },
      "createDocumentProfileDraft",
    ],
    [
      "CREATE_RATE_PLAN_DRAFT",
      {
        action: "CREATE_RATE_PLAN_DRAFT",
        code: "BAR",
        nameId: "Harga Terbaik",
        nameEn: "Best Available Rate",
        effectiveFrom: date,
        reason: "Initial rate plan",
        rules: [
          {
            roomTypeId: U1,
            name: "Base",
            ruleType: "BASE",
            priority: 1,
            startsOn: "2026-08-03",
            endsOn: "2026-12-31",
            weekdaysMask: 127,
            nightlyRateIdr: 500000,
          },
        ],
      },
      "createRatePlanDraft",
    ],
    [
      "REVIEW_VERSION",
      {
        action: "REVIEW_VERSION",
        subject: "RATE_PLAN",
        versionId: U1,
        decision: "APPROVE",
        reason: "Reviewed configuration",
      },
      "reviewCommercialVersion",
    ],
    [
      "PUBLISH_VERSION",
      {
        action: "PUBLISH_VERSION",
        subject: "RATE_PLAN",
        versionId: U1,
        reason: "Publish approved configuration",
      },
      "publishCommercialVersion",
    ],
    [
      "PREVIEW_RESOLVED_RATE",
      {
        action: "PREVIEW_RESOLVED_RATE",
        ratePlanCode: "BAR",
        roomTypeId: U1,
        stayDate: "2026-08-03",
      },
      "resolveNightlyRate",
    ],
  ])("dispatches commercial action %s", async (_action, body, service) => {
    const response = await commercialPost(
      request("/api/staff/admin/commercial-master", body),
    );
    expect([200, 201]).toContain(response.status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  const settingInput = {
    code: "STAY_TIMING",
    name: "Stay timing",
    values: { checkInTime: "14:00", checkoutTime: "12:00" },
    effectiveFrom: date,
    reason: "Initial timing setting",
  };

  it.each([
    [
      "UPDATE_PROPERTY_PROFILE",
      {
        action: "UPDATE_PROPERTY_PROFILE",
        name: "KOOKA Residence",
        address: "Surabaya",
        timezone: "Asia/Jakarta",
        defaultLocale: "id",
        reason: "Verified property profile",
      },
      "updatePropertyProfile",
    ],
    [
      "PREVIEW_SETTING",
      { action: "PREVIEW_SETTING", input: settingInput },
      "previewPropertySettingChange",
    ],
    [
      "CREATE_SETTING_DRAFT",
      { action: "CREATE_SETTING_DRAFT", input: settingInput },
      "createPropertySettingDraft",
    ],
    [
      "REVIEW_SETTING",
      {
        action: "REVIEW_SETTING",
        versionId: U1,
        decision: "APPROVE",
        reason: "Reviewed setting",
      },
      "reviewPropertySettingVersion",
    ],
    [
      "PUBLISH_SETTING",
      { action: "PUBLISH_SETTING", versionId: U1, reason: "Publish setting" },
      "publishPropertySettingVersion",
    ],
    [
      "RETIRE_SETTING",
      { action: "RETIRE_SETTING", versionId: U1, reason: "Setting replaced" },
      "retirePropertySettingVersion",
    ],
  ])(
    "dispatches property configuration action %s",
    async (_action, body, service) => {
      const response = await configurationPost(
        request("/api/staff/admin/configuration", body),
      );
      expect([200, 201]).toContain(response.status);
      expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [
      "ARCHIVE_MASTER",
      {
        action: "ARCHIVE_MASTER",
        target: "AMENITY",
        targetId: U1,
        reason: "Duplicate amenity",
      },
      "archiveRoomMaster",
    ],
    [
      "CREATE_AMENITY",
      {
        action: "CREATE_AMENITY",
        code: "WIFI",
        nameId: "Wi-Fi",
        nameEn: "Wi-Fi",
        reason: "Initial amenity",
      },
      "createAmenity",
    ],
    [
      "PREVIEW_ROOM_TYPE",
      { action: "PREVIEW_ROOM_TYPE", input: roomTypeInput },
      "previewRoomTypeDraft",
    ],
    [
      "CREATE_ROOM_TYPE_DRAFT",
      { action: "CREATE_ROOM_TYPE_DRAFT", input: roomTypeInput },
      "createRoomTypeDraft",
    ],
    [
      "REVIEW_ROOM_TYPE",
      {
        action: "REVIEW_ROOM_TYPE",
        versionId: U1,
        decision: "APPROVE",
        reason: "Capacity reviewed",
      },
      "reviewRoomTypeVersion",
    ],
    [
      "PUBLISH_ROOM_TYPE",
      {
        action: "PUBLISH_ROOM_TYPE",
        versionId: U1,
        reason: "Publish room type",
      },
      "publishRoomTypeVersion",
    ],
    [
      "CREATE_ROOM_UNIT",
      {
        action: "CREATE_ROOM_UNIT",
        roomNumber: "1",
        sortOrder: 1,
        roomTypeId: U1,
        effectiveFrom: date,
        reason: "Initial physical room",
      },
      "createRoomUnit",
    ],
    [
      "CHANGE_ROOM_UNIT_TYPE",
      {
        action: "CHANGE_ROOM_UNIT_TYPE",
        roomUnitId: U1,
        roomTypeId: U2,
        effectiveFrom: date,
        reason: "Room type remapped",
      },
      "changeRoomUnitType",
    ],
    [
      "CREATE_RESOURCE_POOL",
      {
        action: "CREATE_RESOURCE_POOL",
        code: "EXTRA_BED",
        nameId: "Extra bed",
        nameEn: "Extra bed",
        physicalCapacity: 5,
        inventoryTracked: true,
        reason: "Initial resource inventory",
      },
      "createResourcePool",
    ],
  ])("dispatches room master action %s", async (_action, body, service) => {
    const response = await roomPost(
      request("/api/staff/admin/room-master", body),
    );
    expect([200, 201]).toContain(response.status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("returns generic validation errors without invoking a service", async () => {
    const responses = await Promise.all([
      commercialPost(
        request("/api/staff/admin/commercial-master", {
          action: "CREATE_TAX_DRAFT",
        }),
      ),
      configurationPost(
        request("/api/staff/admin/configuration", { action: "REVIEW_SETTING" }),
      ),
      roomPost(
        request("/api/staff/admin/room-master", { action: "CREATE_ROOM_UNIT" }),
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400,
    ]);
  });
});
