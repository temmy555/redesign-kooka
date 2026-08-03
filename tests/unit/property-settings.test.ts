import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    leftJoin: () => link,
    where: () => link,
    orderBy: () => link,
    limit: () => link,
    for: () => link,
    set: () => link,
    values: () => link,
    returning: () => link,
    onConflictDoNothing: () => link,
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

import {
  createPropertySettingDraft,
  getPropertyConfigurationOverview,
  previewPropertySettingChange,
  publishPropertySettingVersion,
  retirePropertySettingVersion,
  reviewPropertySettingVersion,
  updatePropertyProfile,
} from "../../src/modules/configuration/property-settings";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const session = { user: { id: U1 } };

describe("property configuration service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
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

  it("updates the property profile with a valid IANA timezone", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          name: "Old Kooka",
          address: null,
          timezone: "Asia/Jakarta",
          defaultLocale: "id",
          baseCurrency: "IDR",
        },
      ]),
    );
    const result = await updatePropertyProfile({
      session,
      propertyId: U1,
      name: " Kooka Residence ",
      address: "Surabaya",
      timezone: "Asia/Jakarta",
      defaultLocale: "en",
      reason: "Update verified profile",
    });
    expect(result.id).toBe(U1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("allows clearing an optional property address", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          name: "Kooka",
          address: "Old address",
          timezone: "Asia/Jakarta",
          defaultLocale: "id",
          baseCurrency: "IDR",
        },
      ]),
    );
    const result = await updatePropertyProfile({
      session,
      propertyId: U1,
      name: "Kooka",
      timezone: "Asia/Jakarta",
      defaultLocale: "id",
      reason: "Clear obsolete address",
    });
    expect(result.id).toBe(U1);
  });

  it("rejects invalid timezone and too-short reasons", async () => {
    await expect(
      updatePropertyProfile({
        session,
        propertyId: U1,
        name: "Kooka",
        timezone: "Not/AZone",
        defaultLocale: "id",
        reason: "Valid reason",
      }),
    ).rejects.toThrow("Invalid IANA timezone");
    await expect(
      updatePropertyProfile({
        session,
        propertyId: U1,
        name: "Kooka",
        timezone: "Asia/Jakarta",
        defaultLocale: "id",
        reason: "x",
      }),
    ).rejects.toThrow("between 3 and 500");
  });

  it("returns property settings resolved for the requested instant", async () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            code: "KOOKA",
            name: "Kooka",
            timezone: "Asia/Jakarta",
            defaultLocale: "id",
            baseCurrency: "IDR",
            status: "ACTIVE",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            setId: U2,
            code: "STAY_TIMES",
            name: "Stay Times",
            versionId: U3,
            versionNumber: 1,
            lifecycleStatus: "ACTIVE",
            approvalStatus: "NOT_REQUIRED",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
            values: { checkInTime: "14:00" },
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            quoteCurrency: "USD",
            rate: "0.0000625",
            source: "MANUAL",
            asOfAt: now,
            expiresAt: null,
          },
        ]),
      );
    const result = await getPropertyConfigurationOverview({
      session,
      propertyId: U1,
      at: now,
    });
    expect(result.settings[0]?.resolved?.versionId).toBe(U3);
    expect(result.displayRates).toHaveLength(1);
  });

  it("previews high-risk immediate settings and low-risk new settings", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2 }]));
    const high = await previewPropertySettingChange({
      session,
      propertyId: U1,
      input: {
        code: "stay times",
        name: "Stay Times",
        values: { checkoutTime: "12:00" },
        effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
        reason: "Preview settings",
      },
    });
    expect(high.severity).toBe("HIGH");
    expect(high.warnings).toHaveLength(2);

    mocks.select.mockReturnValueOnce(chain([]));
    const low = await previewPropertySettingChange({
      session,
      propertyId: U1,
      input: {
        code: "theme",
        name: "Theme",
        values: { accent: "green" },
        effectiveFrom: new Date("2099-01-01T00:00:00.000Z"),
        reason: "Preview theme",
      },
    });
    expect(low.severity).toBe("LOW");
  });

  it("creates a sequential property-setting draft", async () => {
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([{ versionNumber: 1 }]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]));
    const result = await createPropertySettingDraft({
      session,
      propertyId: U1,
      input: {
        code: "stay times",
        name: "Stay Times",
        values: { checkInTime: "14:00", checkoutTime: "12:00" },
        effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
        reason: "Configure default stay times",
        requiresApproval: true,
      },
    });
    expect(result).toMatchObject({
      id: U3,
      versionNumber: 2,
      lifecycleStatus: "DRAFT",
      approvalStatus: "PENDING",
    });
  });

  it("reviews, publishes, and retires a property-setting version", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          settingSetId: U2,
          lifecycleStatus: "DRAFT",
          approvalStatus: "PENDING",
          effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
          effectiveTo: null,
          createdByUserId: U2,
        },
      ]),
    );
    const reviewed = await reviewPropertySettingVersion({
      session,
      propertyId: U1,
      versionId: U3,
      decision: "APPROVE",
      reason: "Configuration reviewed",
    });
    expect(reviewed.approvalStatus).toBe("APPROVED");

    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            settingSetId: U2,
            lifecycleStatus: "DRAFT",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
            effectiveTo: null,
            createdByUserId: U2,
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    const published = await publishPropertySettingVersion({
      session,
      propertyId: U1,
      versionId: U3,
      reason: "Publish approved settings",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(published.lifecycleStatus).toBe("SCHEDULED");

    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          settingSetId: U2,
          lifecycleStatus: "SCHEDULED",
          approvalStatus: "APPROVED",
          effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
          effectiveTo: null,
          createdByUserId: U2,
        },
      ]),
    );
    const retired = await retirePropertySettingVersion({
      session,
      propertyId: U1,
      versionId: U3,
      reason: "Superseded configuration",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(retired.lifecycleStatus).toBe("RETIRED");
  });

  it("covers medium-risk drafts, rejection, immediate replacement, and retirement", async () => {
    mocks.select.mockReturnValueOnce(chain([{ id: U2 }]));
    const preview = await previewPropertySettingChange({
      session,
      propertyId: U1,
      input: {
        code: "theme",
        name: "Theme",
        values: { accent: "sand" },
        effectiveFrom: new Date("2099-01-01T00:00:00.000Z"),
        reason: "Update existing theme",
      },
    });
    expect(preview.severity).toBe("MEDIUM");

    mocks.select.mockReset();
    mocks.select
      .mockReturnValueOnce(chain([{ id: U2 }]))
      .mockReturnValueOnce(chain([]));
    mocks.insert
      .mockReturnValueOnce(chain())
      .mockReturnValueOnce(chain([{ id: U3 }]));
    const draftResult = await createPropertySettingDraft({
      session,
      propertyId: U1,
      input: {
        code: "theme",
        name: "Theme",
        values: { accent: "sand" },
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
        effectiveTo: new Date("2099-01-01T00:00:00.000Z"),
        reason: "Create no-approval theme",
        requiresApproval: false,
      },
    });
    expect(draftResult.approvalStatus).toBe("NOT_REQUIRED");

    mocks.select.mockReset();
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          settingSetId: U2,
          lifecycleStatus: "DRAFT",
          approvalStatus: "PENDING",
          effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
          effectiveTo: null,
          createdByUserId: U2,
        },
      ]),
    );
    const rejected = await reviewPropertySettingVersion({
      session,
      propertyId: U1,
      versionId: U3,
      decision: "REJECT",
      reason: "Configuration needs revision",
    });
    expect(rejected.approvalStatus).toBe("REJECTED");

    mocks.select.mockReset();
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            settingSetId: U2,
            lifecycleStatus: "DRAFT",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
            effectiveTo: null,
            createdByUserId: U2,
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          {
            id: U1,
            lifecycleStatus: "ACTIVE",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
          },
        ]),
      );
    const published = await publishPropertySettingVersion({
      session,
      propertyId: U1,
      versionId: U3,
      reason: "Replace active theme",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(published.lifecycleStatus).toBe("ACTIVE");

    mocks.select.mockReset();
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          settingSetId: U2,
          lifecycleStatus: "ACTIVE",
          approvalStatus: "APPROVED",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveTo: null,
          createdByUserId: U2,
        },
      ]),
    );
    const retired = await retirePropertySettingVersion({
      session,
      propertyId: U1,
      versionId: U3,
      reason: "Retire current theme",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(retired.lifecycleStatus).toBe("RETIRED");
  });
});
