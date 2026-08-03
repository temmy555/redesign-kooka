import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(rows: unknown[] = []) {
  const link = {
    from: () => link,
    innerJoin: () => link,
    where: () => link,
    limit: () => link,
    set: () => link,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
  return link;
}

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  getDatabase: () => ({
    select: mocks.select,
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
  publishCommercialVersion,
  reviewCommercialVersion,
  type CommercialVersionSubject,
} from "../../src/modules/configuration/commercial-lifecycle";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const U3 = "33333333-3333-4333-a333-333333333333";
const session = { user: { id: U1 } };
const subjects: CommercialVersionSubject[] = [
  "TAX_PROFILE",
  "POLICY",
  "PAYMENT_INSTRUCTION",
  "DOCUMENT_PROFILE",
  "RATE_PLAN",
];

describe("commercial version lifecycle", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.update.mockReturnValue(chain());
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.transaction.mockImplementation(
      async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          select: mocks.select,
          update: mocks.update,
          execute: mocks.execute,
        }),
    );
  });

  it.each(subjects)("reviews a pending %s version", async (subject) => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          parentId: U2,
          lifecycleStatus: "DRAFT",
          approvalStatus: "PENDING",
          effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
          effectiveTo: null,
        },
      ]),
    );
    const result = await reviewCommercialVersion({
      session,
      propertyId: U1,
      subject,
      versionId: U3,
      decision: "APPROVE",
      reason: "Commercial configuration reviewed",
    });
    expect(result.approvalStatus).toBe("APPROVED");
  });

  it.each(subjects)("publishes an approved %s version", async (subject) => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            parentId: U2,
            lifecycleStatus: "DRAFT",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
            effectiveTo: null,
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
    const result = await publishCommercialVersion({
      session,
      propertyId: U1,
      subject,
      versionId: U3,
      reason: "Publish approved commercial version",
      now: new Date("2026-08-02T00:00:00.000Z"),
    });
    expect(result.lifecycleStatus).toBe("SCHEDULED");
  });

  it("closes an older overlapping active version when publishing", async () => {
    mocks.select
      .mockReturnValueOnce(
        chain([
          {
            id: U3,
            parentId: U2,
            lifecycleStatus: "DRAFT",
            approvalStatus: "APPROVED",
            effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
            effectiveTo: null,
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
    const result = await publishCommercialVersion({
      session,
      propertyId: U1,
      subject: "TAX_PROFILE",
      versionId: U3,
      reason: "Replace current tax version",
      now: new Date("2026-08-03T00:00:00.000Z"),
    });
    expect(result.lifecycleStatus).toBe("ACTIVE");
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("rejects review of a non-pending version", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          parentId: U2,
          lifecycleStatus: "ACTIVE",
          approvalStatus: "APPROVED",
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          effectiveTo: null,
        },
      ]),
    );
    await expect(
      reviewCommercialVersion({
        session,
        propertyId: U1,
        subject: "POLICY",
        versionId: U3,
        decision: "REJECT",
        reason: "Invalid lifecycle check",
      }),
    ).rejects.toThrow("Only a pending draft");
  });

  it("successfully rejects a pending commercial draft", async () => {
    mocks.select.mockReturnValueOnce(
      chain([
        {
          id: U3,
          parentId: U2,
          lifecycleStatus: "DRAFT",
          approvalStatus: "PENDING",
          effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
          effectiveTo: null,
        },
      ]),
    );
    const result = await reviewCommercialVersion({
      session,
      propertyId: U1,
      subject: "POLICY",
      versionId: U3,
      decision: "REJECT",
      reason: "Policy wording needs revision",
    });
    expect(result.approvalStatus).toBe("REJECTED");
  });

  it.each(subjects)(
    "rejects overlapping scheduled %s publication",
    async (subject) => {
      mocks.select
        .mockReturnValueOnce(
          chain([
            {
              id: U3,
              parentId: U2,
              lifecycleStatus: "DRAFT",
              approvalStatus: "APPROVED",
              effectiveFrom: new Date("2026-08-03T00:00:00.000Z"),
              effectiveTo: null,
            },
          ]),
        )
        .mockReturnValueOnce(
          chain([
            {
              id: U1,
              lifecycleStatus: "SCHEDULED",
              effectiveFrom: new Date("2026-08-04T00:00:00.000Z"),
              effectiveTo: null,
            },
          ]),
        );
      await expect(
        publishCommercialVersion({
          session,
          propertyId: U1,
          subject,
          versionId: U3,
          reason: "Overlap guard verification",
          now: new Date("2026-08-02T00:00:00.000Z"),
        }),
      ).rejects.toThrow("Effective period overlaps");
    },
  );
});
