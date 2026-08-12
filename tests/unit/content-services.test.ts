import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requirePermission: vi.fn(),
  recordAuditEvent: vi.fn(),
  enqueueOutboxEvent: vi.fn(),
  saveStoredFile: vi.fn(),
  runMalwareScan: vi.fn(),
  purgeStoredFile: vi.fn(),
  readPublicStoredFile: vi.fn(),
}));

vi.mock("../../src/db", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("../../src/platform/authorization", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/platform/authorization")>();
  return { ...original, requirePermission: mocks.requirePermission };
});
vi.mock("../../src/platform/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));
vi.mock("../../src/platform/outbox", () => ({
  enqueueOutboxEvent: mocks.enqueueOutboxEvent,
}));
vi.mock("../../src/platform/file-storage", () => ({
  noopMalwareScanner: vi.fn(),
  saveStoredFile: mocks.saveStoredFile,
  runMalwareScan: mocks.runMalwareScan,
  purgeStoredFile: mocks.purgeStoredFile,
  readPublicStoredFile: mocks.readPublicStoredFile,
}));

import {
  createContentPageDraft,
  createContentPreviewToken,
  getPublicLandingPage,
  publishContentVersion,
  submitContentForReview,
  verifyContentPreviewToken,
} from "../../src/modules/content/cms-service";
import { approvedBaselineLanding } from "../../src/modules/content/default-content";
import {
  archiveCmsMedia,
  getMediaOverview,
  linkCmsMedia,
  publishCmsMedia,
  readPublishedMedia,
  setRoomTypeGallery,
  uploadCmsMedia,
} from "../../src/modules/content/media-service";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";
const session = { user: { id: U1 } };

function selectChain(rows: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    "select",
    "from",
    "innerJoin",
    "leftJoin",
    "where",
    "orderBy",
  ]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.then = vi.fn((resolve: (value: unknown[]) => void) => resolve(rows));
  return chain;
}

function queuedDatabase(
  selectResults: unknown[][],
  returningResults: unknown[][] = [],
) {
  const selections = [...selectResults];
  const returns = [...returningResults];
  const db: Record<string, ReturnType<typeof vi.fn>> = {};
  db.select = vi.fn(() => selectChain(selections.shift() ?? []));
  db.execute = vi.fn().mockResolvedValue(undefined);
  db.insert = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.values = vi.fn(() => mutation);
    mutation.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    mutation.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    mutation.returning = vi.fn(async () => returns.shift() ?? []);
    mutation.then = vi.fn((resolve) => resolve(undefined));
    return mutation;
  });
  db.update = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.set = vi.fn(() => mutation);
    mutation.where = vi.fn().mockResolvedValue(undefined);
    return mutation;
  });
  db.delete = vi.fn(() => {
    const mutation: Record<string, ReturnType<typeof vi.fn>> = {};
    mutation.where = vi.fn().mockResolvedValue(undefined);
    return mutation;
  });
  db.transaction = vi.fn(async (callback: (tx: typeof db) => unknown) =>
    callback(db),
  );
  return db;
}

const validSection = {
  key: "hero",
  type: "HERO",
  sortOrder: 0,
  translations: {
    id: { title: "Hunian tenang" },
    en: { title: "A calm stay" },
  },
};

describe("Batch 4 content service safeguards", () => {
  beforeEach(() => {
    mocks.getDatabase.mockReset();
    mocks.requirePermission.mockReset().mockResolvedValue(undefined);
    mocks.recordAuditEvent.mockReset().mockResolvedValue(undefined);
    mocks.enqueueOutboxEvent.mockReset().mockResolvedValue(undefined);
    mocks.saveStoredFile.mockReset();
    mocks.runMalwareScan.mockReset().mockResolvedValue("CLEAN");
    mocks.purgeStoredFile.mockReset().mockResolvedValue(undefined);
    mocks.readPublicStoredFile.mockReset();
    process.env.BETTER_AUTH_SECRET = "a".repeat(48);
  });

  it("keeps the approved baseline bilingual and free of operational room copies", () => {
    const id = approvedBaselineLanding("id", new Date("2026-08-02T00:00:00Z"));
    const en = approvedBaselineLanding("en", new Date("2026-08-02T00:00:00Z"));
    expect(id.source).toBe("APPROVED_BASELINE");
    expect(id.rooms).toEqual([]);
    expect(
      id.sections.find((section) => section.key === "hero")?.content.title,
    ).toContain("Hunian");
    expect(
      en.sections.find((section) => section.key === "hero")?.content.title,
    ).toContain("calm");
  });

  it.each([
    ["empty page", { routeKey: "home", reason: "Valid reason", sections: [] }],
    [
      "invalid section key",
      {
        routeKey: "home",
        reason: "Valid reason",
        sections: [{ ...validSection, key: "Hero Space" }],
      },
    ],
    [
      "duplicate section key",
      {
        routeKey: "home",
        reason: "Valid reason",
        sections: [validSection, { ...validSection, sortOrder: 1 }],
      },
    ],
    [
      "missing Indonesian translation",
      {
        routeKey: "home",
        reason: "Valid reason",
        sections: [
          {
            ...validSection,
            translations: { id: {}, en: { title: "Calm" } },
          },
        ],
      },
    ],
    [
      "missing English translation",
      {
        routeKey: "home",
        reason: "Valid reason",
        sections: [
          {
            ...validSection,
            translations: { id: { title: "Tenang" }, en: {} },
          },
        ],
      },
    ],
    [
      "operational price copy",
      {
        routeKey: "home",
        reason: "Valid reason",
        sections: [
          {
            ...validSection,
            translations: {
              id: { cards: [{ title: "Deluxe", price: 500_000 }] },
              en: { title: "Calm" },
            },
          },
        ],
      },
    ],
  ])("rejects unsafe draft input: %s", async (_label, input) => {
    await expect(
      createContentPageDraft({ session, propertyId: U2, input }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("creates, verifies, and rejects tampered preview tokens", async () => {
    mocks.getDatabase.mockReturnValue(
      selectChain([
        {
          id: U1,
          pageId: U2,
          routeKey: "home",
          versionNumber: 3,
          lifecycleStatus: "DRAFT",
        },
      ]),
    );
    const preview = await createContentPreviewToken({
      session,
      propertyId: U2,
      versionId: U1,
      ttlMinutes: 10,
    });
    expect(verifyContentPreviewToken(preview.token)).toMatchObject({
      propertyId: U2,
      versionId: U1,
    });
    expect(() => verifyContentPreviewToken(`${preview.token}x`)).toThrow(
      "Invalid preview token",
    );
    expect(() => verifyContentPreviewToken("broken")).toThrow(
      "Invalid preview token",
    );
  });

  it("expires preview tokens and fails closed without a signing secret", async () => {
    const db = selectChain([
      {
        id: U1,
        pageId: U2,
        routeKey: "home",
        versionNumber: 3,
        lifecycleStatus: "DRAFT",
      },
    ]);
    mocks.getDatabase.mockReturnValue(db);
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const preview = await createContentPreviewToken({
      session,
      propertyId: U2,
      versionId: U1,
      ttlMinutes: 1,
    });
    clock.mockReturnValue(1_060_001);
    expect(() => verifyContentPreviewToken(preview.token)).toThrow("expired");
    clock.mockRestore();

    delete process.env.BETTER_AUTH_SECRET;
    mocks.getDatabase.mockReturnValue(db);
    await expect(
      createContentPreviewToken({
        session,
        propertyId: U2,
        versionId: U1,
        ttlMinutes: 90,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("fails closed when the property or media record does not exist", async () => {
    mocks.getDatabase.mockReturnValue(selectChain([]));
    await expect(
      getPublicLandingPage({ propertyId: U2, locale: "id" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      publishCmsMedia({
        session,
        propertyId: U2,
        assetId: U1,
        reason: "Publish verified image",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("links owned media to a room type and rejects invalid targets", async () => {
    const asset = {
      id: U1,
      fileId: U2,
      status: "PUBLISHED",
      authenticPropertyMedia: true,
      rightsSource: "KOOKA",
      altId: "Kamar",
      altEn: "Room",
      scanStatus: "CLEAN",
      purgedAt: null,
    };
    const db = queuedDatabase([[asset], [{ id: U2 }]]);
    mocks.getDatabase.mockReturnValue(db);
    await expect(
      linkCmsMedia({
        session,
        propertyId: U2,
        assetId: U1,
        usageType: "ROOM_TYPE_HERO",
        targetId: U2,
        sortOrder: 0,
      }),
    ).resolves.toMatchObject({ usageType: "ROOM_TYPE_HERO", targetId: U2 });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cms.media.link" }),
      db,
    );

    mocks.getDatabase.mockReturnValue(queuedDatabase([[asset], []]));
    await expect(
      linkCmsMedia({
        session,
        propertyId: U2,
        assetId: U1,
        usageType: "CONTENT_SECTION",
        targetId: U2,
        sortOrder: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not link archived media", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase([
        [
          {
            id: U1,
            fileId: U2,
            status: "ARCHIVED",
            authenticPropertyMedia: true,
            rightsSource: "KOOKA",
            altId: "Kamar",
            altEn: "Room",
            scanStatus: "CLEAN",
            purgedAt: null,
          },
        ],
      ]),
    );
    await expect(
      linkCmsMedia({
        session,
        propertyId: U2,
        assetId: U1,
        usageType: "ROOM_TYPE_GALLERY",
        targetId: U2,
        sortOrder: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("replaces a room gallery while preserving its photo order", async () => {
    const asset = (id: string) => ({
      id,
      fileId: U2,
      status: "PUBLISHED",
      authenticPropertyMedia: true,
      rightsSource: "KOOKA",
      altId: "Kamar",
      altEn: "Room",
      scanStatus: "CLEAN",
      purgedAt: null,
    });
    const db = queuedDatabase([[{ id: U2 }], [asset(U1)], [asset(U2)]]);
    mocks.getDatabase.mockReturnValue(db);
    await expect(
      setRoomTypeGallery({
        session,
        propertyId: U2,
        roomTypeId: U2,
        assetIds: [U1, U2],
      }),
    ).resolves.toMatchObject({
      roomTypeId: U2,
      assetIds: [U1, U2],
      heroAssetId: U1,
    });
    expect(db.delete).toHaveBeenCalledOnce();
    expect(db.insert).toHaveBeenCalledOnce();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cms.media.room_gallery.set" }),
      db,
    );
  });

  it("resolves published CMS content and operational room data together", async () => {
    const db = queuedDatabase([
      [
        {
          name: "KOOKA Residence",
          address: "Surabaya",
          baseCurrency: "IDR",
        },
      ],
      [
        {
          pageId: U1,
          versionId: U2,
          versionNumber: 2,
          lifecycleStatus: "PUBLISHED",
        },
      ],
      [
        {
          id: U1,
          key: "hero",
          type: "HERO",
          sortOrder: 0,
          settings: { tone: "forest" },
        },
      ],
      [
        {
          id: U1,
          code: "DELUXE",
          versionId: U2,
          nameId: "Deluxe",
          nameEn: "Deluxe",
          descriptionId: "Menghadap taman",
          descriptionEn: "Garden-facing room",
          bedConfiguration: "Queen bed",
          maximumAdults: 2,
          maximumChildren: 1,
          maximumTotalGuests: 3,
          extraBedAllowed: true,
          maximumExtraBeds: 1,
        },
      ],
      [
        {
          contentSectionId: U1,
          locale: "en",
          content: { title: "A calm stay" },
        },
        {
          contentSectionId: U1,
          locale: "id",
          content: { title: "Hunian tenang" },
        },
      ],
      [
        {
          roomTypeVersionId: U2,
          code: "WIFI",
          iconKey: "wifi",
          locale: "id",
          name: "Wi-Fi",
        },
        {
          roomTypeVersionId: U2,
          code: "WIFI",
          iconKey: "wifi",
          locale: "en",
          name: "Wi-Fi",
        },
      ],
      [
        {
          sectionId: U1,
          assetId: U2,
          sortOrder: 0,
          altId: "Halaman",
          altEn: "Courtyard",
          captionId: null,
          captionEn: "Garden",
        },
      ],
      [
        {
          roomTypeId: U1,
          assetId: U2,
          sortOrder: 0,
          altId: "Kamar Deluxe",
          altEn: "Deluxe room",
          captionId: null,
          captionEn: null,
        },
      ],
    ]);
    mocks.getDatabase.mockReturnValue(db);
    const result = await getPublicLandingPage({
      propertyId: U2,
      locale: "en",
      now: new Date("2026-08-02T00:00:00Z"),
    });
    expect(result.source).toBe("PUBLISHED_CMS");
    expect(result.sections[0]).toMatchObject({
      content: { title: "A calm stay", tone: "forest" },
    });
    expect(result.rooms[0]).toMatchObject({
      code: "DELUXE",
      description: "Garden-facing room",
    });
    expect(result.rooms[0]?.amenities[0]?.name).toBe("Wi-Fi");
    expect(result.rooms[0]?.media[0]?.url).toContain(U2);
  });

  it("uses the approved baseline when no CMS revision is published", async () => {
    mocks.getDatabase.mockReturnValue(
      queuedDatabase([
        [
          {
            name: "KOOKA Residence",
            address: null,
            baseCurrency: "IDR",
          },
        ],
        [],
        [],
      ]),
    );
    const result = await getPublicLandingPage({
      propertyId: U2,
      locale: "id",
    });
    expect(result.source).toBe("APPROVED_BASELINE");
    expect(result.property.address).toBeNull();
    expect(result.rooms).toEqual([]);
  });

  it("creates a complete bilingual revision atomically", async () => {
    const db = queuedDatabase(
      [[{ id: U2 }], [{ versionNumber: 2 }]],
      [[{ id: U1 }], [{ id: U2 }]],
    );
    mocks.getDatabase.mockReturnValue(db);
    const result = await createContentPageDraft({
      session,
      propertyId: U2,
      input: {
        routeKey: "home",
        reason: "Create reviewed bilingual page",
        sections: [validSection],
      },
    });
    expect(result).toMatchObject({
      id: U1,
      versionNumber: 3,
      lifecycleStatus: "DRAFT",
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledOnce();
  });

  it("submits and publishes a complete reviewed revision", async () => {
    const owned = {
      id: U1,
      pageId: U2,
      routeKey: "home",
      versionNumber: 3,
      lifecycleStatus: "DRAFT",
    };
    const submitDb = queuedDatabase([[owned]]);
    mocks.getDatabase.mockReturnValue(submitDb);
    await expect(
      submitContentForReview({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Ready for content review",
      }),
    ).resolves.toMatchObject({ lifecycleStatus: "IN_REVIEW" });

    const sectionTypes = [
      "HERO",
      "TRUST_STRIP",
      "ROOM_COLLECTION",
      "EDITORIAL_FEATURE",
      "LOCATION",
      "FAQ",
      "CTA",
    ];
    const sections = sectionTypes.map((type, index) => ({
      id: `${String(index + 1).padStart(8, "0")}-1111-4111-a111-111111111111`,
      type,
    }));
    const translations = sections.flatMap((section) => [
      { sectionId: section.id, locale: "id", content: { title: "Konten" } },
      { sectionId: section.id, locale: "en", content: { title: "Content" } },
    ]);
    const publishDb = queuedDatabase([
      [{ ...owned, lifecycleStatus: "IN_REVIEW" }],
      sections,
      translations,
      [{ id: U2 }],
      sections.map((section) => ({ id: section.id })),
    ]);
    mocks.getDatabase.mockReturnValue(publishDb);
    await expect(
      publishContentVersion({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Approved for public publication",
        now: new Date("2026-08-02T00:00:00Z"),
      }),
    ).resolves.toMatchObject({ lifecycleStatus: "PUBLISHED" });
    expect(mocks.enqueueOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "cms.content.published" }),
      publishDb,
    );
  });

  it("rejects invalid review and publication states", async () => {
    const owned = {
      id: U1,
      pageId: U2,
      routeKey: "home",
      versionNumber: 3,
      lifecycleStatus: "PUBLISHED",
    };
    mocks.getDatabase.mockReturnValue(queuedDatabase([[owned]]));
    await expect(
      submitContentForReview({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Submit invalid state",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    mocks.getDatabase.mockReturnValue(queuedDatabase([[owned]]));
    await expect(
      publishContentVersion({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Publish invalid state",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("blocks incomplete sections, translations, and unauthentic hero media", async () => {
    const owned = {
      id: U1,
      pageId: U2,
      routeKey: "home",
      versionNumber: 3,
      lifecycleStatus: "IN_REVIEW",
    };
    mocks.getDatabase.mockReturnValue(
      queuedDatabase([[owned], [{ id: U1, type: "HERO" }]]),
    );
    await expect(
      publishContentVersion({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Missing required sections",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const types = [
      "HERO",
      "TRUST_STRIP",
      "ROOM_COLLECTION",
      "EDITORIAL_FEATURE",
      "LOCATION",
      "FAQ",
      "CTA",
    ];
    const sections = types.map((type, index) => ({
      id: `${String(index + 1).padStart(8, "0")}-1111-4111-a111-111111111111`,
      type,
    }));
    mocks.getDatabase.mockReturnValue(
      queuedDatabase([
        [owned],
        sections,
        [
          {
            sectionId: sections[0]!.id,
            locale: "id",
            content: { title: "Ada" },
          },
        ],
      ]),
    );
    await expect(
      publishContentVersion({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Missing English content",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const translations = sections.flatMap((section) => [
      { sectionId: section.id, locale: "id", content: { title: "Ada" } },
      { sectionId: section.id, locale: "en", content: { title: "Exists" } },
    ]);
    mocks.getDatabase.mockReturnValue(
      queuedDatabase([[owned], sections, translations, []]),
    );
    await expect(
      publishContentVersion({
        session,
        propertyId: U2,
        versionId: U1,
        reason: "Missing authentic hero media",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("uploads, publishes, and archives scanned CMS media", async () => {
    mocks.saveStoredFile.mockResolvedValue({
      id: U1,
      scanStatus: "PENDING",
    });
    const uploadDb = queuedDatabase([], [[{ id: U2 }]]);
    mocks.getDatabase.mockReturnValue(uploadDb);
    await expect(
      uploadCmsMedia({
        session,
        propertyId: U2,
        originalName: "hero.jpg",
        mimeType: "image/jpeg",
        bytes: Buffer.from([0xff, 0xd8, 0xff]),
        metadata: {
          title: "Courtyard",
          altId: "Halaman KOOKA",
          altEn: "KOOKA courtyard",
          rightsSource: "Owned by KOOKA",
          authenticPropertyMedia: true,
        },
      }),
    ).resolves.toMatchObject({ id: U2, scanStatus: "CLEAN" });
    expect(mocks.runMalwareScan).toHaveBeenCalledWith(U1, expect.any(Function));

    const mediaRow = {
      id: U2,
      fileId: U1,
      status: "DRAFT",
      authenticPropertyMedia: true,
      rightsSource: "Owned by KOOKA",
      altId: "Halaman KOOKA",
      altEn: "KOOKA courtyard",
      scanStatus: "CLEAN",
      purgedAt: null,
    };
    mocks.getDatabase.mockReturnValue(queuedDatabase([[mediaRow]]));
    await expect(
      publishCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "Approved authentic image",
      }),
    ).resolves.toMatchObject({ status: "PUBLISHED" });

    mocks.getDatabase.mockReturnValue(
      queuedDatabase([[{ ...mediaRow, status: "PUBLISHED" }]]),
    );
    await expect(
      archiveCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "Replace with updated image",
      }),
    ).resolves.toMatchObject({ status: "ARCHIVED" });
  });

  it("purges CMS media when file inspection rejects the upload", async () => {
    mocks.saveStoredFile.mockResolvedValue({
      id: U1,
      scanStatus: "PENDING",
    });
    mocks.runMalwareScan.mockResolvedValue("REJECTED");
    await expect(
      uploadCmsMedia({
        session,
        propertyId: U2,
        originalName: "unsafe.jpg",
        mimeType: "image/jpeg",
        bytes: Buffer.from([0xff, 0xd8, 0xff]),
        metadata: {
          altId: "Foto kamar",
          altEn: "Room photo",
          rightsSource: "Owned by KOOKA",
          authenticPropertyMedia: true,
        },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.purgeStoredFile).toHaveBeenCalledWith(U1, U1);
  });

  it("checks and publishes an older draft whose scan is still pending", async () => {
    const db = queuedDatabase([
      [
        {
          id: U2,
          fileId: U1,
          status: "DRAFT",
          authenticPropertyMedia: true,
          rightsSource: "Owned by KOOKA",
          altId: "Foto kamar",
          altEn: "Room photo",
          scanStatus: "PENDING",
          purgedAt: null,
        },
      ],
    ]);
    mocks.getDatabase.mockReturnValue(db);
    mocks.runMalwareScan.mockResolvedValue("CLEAN");
    await expect(
      publishCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "Inspect and publish existing draft",
      }),
    ).resolves.toMatchObject({ id: U2, status: "PUBLISHED" });
    expect(mocks.runMalwareScan).toHaveBeenCalledWith(U1, expect.any(Function));
  });

  it("blocks media publication until every readiness rule passes", async () => {
    const base = {
      id: U2,
      fileId: U1,
      status: "DRAFT",
      authenticPropertyMedia: false,
      rightsSource: "Owned by KOOKA",
      altId: "Halaman KOOKA",
      altEn: "KOOKA courtyard",
      scanStatus: "CLEAN",
      purgedAt: null,
    };
    mocks.getDatabase.mockReturnValue(
      queuedDatabase([[{ ...base, status: "PUBLISHED" }]]),
    );
    await expect(
      publishCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "Already published",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    mocks.getDatabase.mockReturnValue(
      queuedDatabase([[{ ...base, scanStatus: "PENDING" }]]),
    );
    mocks.runMalwareScan.mockResolvedValueOnce("REJECTED");
    await expect(
      publishCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "Scanner pending",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    mocks.getDatabase.mockReturnValue(queuedDatabase([[base]]));
    await expect(
      publishCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "x",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    mocks.getDatabase.mockReturnValue(
      queuedDatabase([[{ ...base, status: "ARCHIVED" }]]),
    );
    await expect(
      archiveCmsMedia({
        session,
        propertyId: U2,
        assetId: U2,
        reason: "Already archived",
      }),
    ).resolves.toEqual({ id: U2, status: "ARCHIVED" });
  });

  it("lists and reads only published media", async () => {
    const overviewDb = queuedDatabase([[{ id: U2, status: "PUBLISHED" }]]);
    mocks.getDatabase.mockReturnValue(overviewDb);
    await expect(
      getMediaOverview({ session, propertyId: U2 }),
    ).resolves.toEqual([{ id: U2, status: "PUBLISHED", usages: [] }]);

    const publicDb = queuedDatabase([[{ fileId: U1 }]]);
    mocks.getDatabase.mockReturnValue(publicDb);
    mocks.readPublicStoredFile.mockResolvedValue({
      file: { id: U1 },
      bytes: Buffer.from([1]),
    });
    await expect(readPublishedMedia(U2)).resolves.toMatchObject({
      file: { id: U1 },
    });

    mocks.getDatabase.mockReturnValue(queuedDatabase([[]]));
    await expect(readPublishedMedia(U2)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("validates CMS upload metadata and Phase 1 image types", async () => {
    await expect(
      uploadCmsMedia({
        session,
        propertyId: U2,
        originalName: "hero.jpg",
        mimeType: "image/jpeg",
        bytes: Buffer.from([0xff, 0xd8, 0xff]),
        metadata: {
          altId: "",
          altEn: "Courtyard",
          rightsSource: "Owned by KOOKA",
          authenticPropertyMedia: true,
        },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      uploadCmsMedia({
        session,
        propertyId: U2,
        originalName: "tour.pdf",
        mimeType: "application/pdf",
        bytes: Buffer.from("%PDF-"),
        metadata: {
          altId: "Dokumen",
          altEn: "Document",
          rightsSource: "Owned by KOOKA",
          authenticPropertyMedia: false,
        },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
