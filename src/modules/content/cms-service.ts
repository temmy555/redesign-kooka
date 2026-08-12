import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  amenities,
  amenityTranslations,
  contentPages,
  contentPageVersions,
  contentSections,
  contentTranslations,
  mediaAssets,
  mediaUsages,
  properties,
  roomTypeAmenities,
  roomTypes,
  roomTypeVersions,
  storedFiles,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import { enqueueOutboxEvent } from "../../platform/outbox";
import type {
  ContentMutationResult,
  ContentPageDraftInput,
  ContentSectionDraftInput,
  ContentStaffSession,
  LandingMedia,
  LandingRoomType,
  LandingSection,
  PublicGalleryMedia,
  PublicLandingData,
  PublicLocale,
} from "./contracts";
import { approvedBaselineSections } from "./default-content";

const REQUIRED_HOME_SECTION_TYPES = new Set([
  "HERO",
  "TRUST_STRIP",
  "ROOM_COLLECTION",
  "EDITORIAL_FEATURE",
  "LOCATION",
  "FAQ",
  "CTA",
]);

const FORBIDDEN_EDITORIAL_KEYS = new Set([
  "availability",
  "availableRooms",
  "capacity",
  "maximumAdults",
  "maximumChildren",
  "maximumTotalGuests",
  "nightlyRate",
  "price",
  "rate",
  "tax",
]);

function assertReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A reason between 3 and 500 characters is required",
    );
  }
  return value;
}

function normalizeRouteKey(routeKey: string): string {
  const value = routeKey.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9/_-]{0,158}$/u.test(value)) {
    throw new AppError("VALIDATION_ERROR", "Invalid content route key");
  }
  return value;
}

function assertEditorialBoundary(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertEditorialBoundary(item, [...path, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EDITORIAL_KEYS.has(key)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Operational field cannot be stored in CMS content: ${[...path, key].join(".")}`,
      );
    }
    assertEditorialBoundary(child, [...path, key]);
  }
}

function assertDraftInput(input: ContentPageDraftInput): void {
  if (input.sections.length === 0) {
    throw new AppError("VALIDATION_ERROR", "A content page needs sections");
  }
  const keys = new Set<string>();
  for (const section of input.sections) {
    if (!/^[a-z0-9][a-z0-9_-]{0,118}$/u.test(section.key)) {
      throw new AppError("VALIDATION_ERROR", "Invalid content section key");
    }
    if (keys.has(section.key)) {
      throw new AppError("VALIDATION_ERROR", "Section keys must be unique");
    }
    keys.add(section.key);
    if (Object.keys(section.translations.id).length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Indonesian content is required for ${section.key}`,
      );
    }
    if (Object.keys(section.translations.en).length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `English content is required for ${section.key}`,
      );
    }
    assertEditorialBoundary(section.translations.id, [section.key, "id"]);
    assertEditorialBoundary(section.translations.en, [section.key, "en"]);
  }
}

function localeCandidates(locale: PublicLocale): PublicLocale[] {
  return locale === "id" ? ["id"] : ["en", "id"];
}

function localizedContent(
  rows: Array<{
    contentSectionId: string;
    locale: string;
    content: Record<string, unknown>;
  }>,
  sectionId: string,
  locale: PublicLocale,
): Record<string, unknown> | null {
  for (const candidate of localeCandidates(locale)) {
    const row = rows.find(
      (translation) =>
        translation.contentSectionId === sectionId &&
        translation.locale === candidate,
    );
    if (row) return row.content;
  }
  return null;
}

async function readPageVersion(params: {
  propertyId: string;
  routeKey: string;
  versionId?: string;
  now: Date;
}) {
  const conditions = [
    eq(contentPages.propertyId, params.propertyId),
    eq(contentPages.routeKey, params.routeKey),
    eq(contentPages.status, "ACTIVE"),
  ];
  if (params.versionId) {
    conditions.push(eq(contentPageVersions.id, params.versionId));
  } else {
    conditions.push(eq(contentPageVersions.lifecycleStatus, "PUBLISHED"));
    conditions.push(
      or(
        isNull(contentPageVersions.effectiveFrom),
        lte(contentPageVersions.effectiveFrom, params.now),
      )!,
    );
  }

  const [version] = await getDatabase()
    .select({
      pageId: contentPages.id,
      versionId: contentPageVersions.id,
      versionNumber: contentPageVersions.versionNumber,
      lifecycleStatus: contentPageVersions.lifecycleStatus,
    })
    .from(contentPages)
    .innerJoin(
      contentPageVersions,
      eq(contentPageVersions.contentPageId, contentPages.id),
    )
    .where(and(...conditions))
    .orderBy(
      desc(contentPageVersions.publishedAt),
      desc(contentPageVersions.versionNumber),
    )
    .limit(1);
  return version ?? null;
}

async function readCmsSections(
  versionId: string,
  locale: PublicLocale,
): Promise<LandingSection[]> {
  const db = getDatabase();
  const sections = await db
    .select({
      id: contentSections.id,
      key: contentSections.sectionKey,
      type: contentSections.sectionType,
      sortOrder: contentSections.sortOrder,
      settings: contentSections.settings,
    })
    .from(contentSections)
    .where(eq(contentSections.pageVersionId, versionId))
    .orderBy(asc(contentSections.sortOrder), asc(contentSections.sectionKey));
  if (sections.length === 0) return [];

  const sectionIds = sections.map((section) => section.id);
  const translations = await db
    .select({
      contentSectionId: contentTranslations.contentSectionId,
      locale: contentTranslations.locale,
      content: contentTranslations.content,
    })
    .from(contentTranslations)
    .where(
      and(
        inArray(contentTranslations.contentSectionId, sectionIds),
        inArray(contentTranslations.locale, localeCandidates(locale)),
        eq(contentTranslations.translationStatus, "PUBLISHED"),
      ),
    );
  const media = await db
    .select({
      sectionId: mediaUsages.targetId,
      assetId: mediaAssets.id,
      sortOrder: mediaUsages.sortOrder,
      altId: mediaAssets.altId,
      altEn: mediaAssets.altEn,
      captionId: mediaAssets.captionId,
      captionEn: mediaAssets.captionEn,
    })
    .from(mediaUsages)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaUsages.mediaAssetId))
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .where(
      and(
        inArray(mediaUsages.targetId, sectionIds),
        eq(mediaUsages.usageType, "CONTENT_SECTION"),
        eq(mediaAssets.status, "PUBLISHED"),
        eq(storedFiles.scanStatus, "CLEAN"),
        isNull(storedFiles.purgedAt),
      ),
    )
    .orderBy(asc(mediaUsages.sortOrder));

  return sections.flatMap((section) => {
    const content = localizedContent(translations, section.id, locale);
    if (!content) return [];
    const sectionMedia: LandingMedia[] = media
      .filter((item) => item.sectionId === section.id)
      .map((item) => ({
        id: item.assetId,
        url: `/api/content/media/${item.assetId}`,
        alt:
          (locale === "en" ? item.altEn : item.altId) ??
          item.altId ??
          item.altEn ??
          "KOOKA Residence",
        caption:
          (locale === "en" ? item.captionEn : item.captionId) ??
          item.captionId ??
          item.captionEn,
        sortOrder: item.sortOrder,
      }));
    return [
      {
        key: section.key,
        type: section.type,
        content: { ...(section.settings ?? {}), ...content },
        media: sectionMedia,
      },
    ];
  });
}

async function readPublicRoomTypes(params: {
  propertyId: string;
  locale: PublicLocale;
  now: Date;
}): Promise<LandingRoomType[]> {
  const db = getDatabase();
  const rooms = await db
    .select({
      id: roomTypes.id,
      code: roomTypes.code,
      versionId: roomTypeVersions.id,
      nameId: roomTypeVersions.nameId,
      nameEn: roomTypeVersions.nameEn,
      descriptionId: roomTypeVersions.descriptionId,
      descriptionEn: roomTypeVersions.descriptionEn,
      bedConfiguration: roomTypeVersions.bedConfiguration,
      maximumAdults: roomTypeVersions.maximumAdults,
      maximumChildren: roomTypeVersions.maximumChildren,
      maximumTotalGuests: roomTypeVersions.maximumTotalGuests,
      extraBedAllowed: roomTypeVersions.extraBedAllowed,
      maximumExtraBeds: roomTypeVersions.maximumExtraBeds,
    })
    .from(roomTypes)
    .innerJoin(roomTypeVersions, eq(roomTypeVersions.roomTypeId, roomTypes.id))
    .where(
      and(
        eq(roomTypes.propertyId, params.propertyId),
        eq(roomTypes.status, "ACTIVE"),
        eq(roomTypeVersions.lifecycleStatus, "ACTIVE"),
        lte(roomTypeVersions.effectiveFrom, params.now),
        or(
          isNull(roomTypeVersions.effectiveTo),
          gt(roomTypeVersions.effectiveTo, params.now),
        ),
      ),
    )
    .orderBy(asc(roomTypes.code));
  if (rooms.length === 0) return [];

  const versionIds = rooms.map((room) => room.versionId);
  const roomTypeIds = rooms.map((room) => room.id);
  const amenityRows = await db
    .select({
      roomTypeVersionId: roomTypeAmenities.roomTypeVersionId,
      code: amenities.code,
      iconKey: amenities.iconKey,
      locale: amenityTranslations.locale,
      name: amenityTranslations.name,
    })
    .from(roomTypeAmenities)
    .innerJoin(amenities, eq(amenities.id, roomTypeAmenities.amenityId))
    .innerJoin(
      amenityTranslations,
      eq(amenityTranslations.amenityId, amenities.id),
    )
    .where(
      and(
        inArray(roomTypeAmenities.roomTypeVersionId, versionIds),
        eq(amenities.status, "ACTIVE"),
        inArray(amenityTranslations.locale, localeCandidates(params.locale)),
      ),
    );
  const mediaRows = await db
    .select({
      roomTypeId: mediaUsages.targetId,
      assetId: mediaAssets.id,
      sortOrder: mediaUsages.sortOrder,
      altId: mediaAssets.altId,
      altEn: mediaAssets.altEn,
      captionId: mediaAssets.captionId,
      captionEn: mediaAssets.captionEn,
    })
    .from(mediaUsages)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaUsages.mediaAssetId))
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .where(
      and(
        inArray(mediaUsages.targetId, roomTypeIds),
        inArray(mediaUsages.usageType, ["ROOM_TYPE_HERO", "ROOM_TYPE_GALLERY"]),
        eq(mediaAssets.status, "PUBLISHED"),
        eq(mediaAssets.authenticPropertyMedia, true),
        eq(storedFiles.scanStatus, "CLEAN"),
        isNull(storedFiles.purgedAt),
      ),
    )
    .orderBy(asc(mediaUsages.sortOrder));

  return rooms.map((room) => {
    const amenityByCode = new Map<
      string,
      { code: string; iconKey: string | null; name: string }
    >();
    for (const candidate of localeCandidates(params.locale).reverse()) {
      for (const amenity of amenityRows) {
        if (
          amenity.roomTypeVersionId === room.versionId &&
          amenity.locale === candidate
        ) {
          amenityByCode.set(amenity.code, {
            code: amenity.code,
            iconKey: amenity.iconKey,
            name: amenity.name,
          });
        }
      }
    }
    return {
      id: room.id,
      code: room.code,
      name: params.locale === "en" ? room.nameEn : room.nameId,
      description:
        (params.locale === "en" ? room.descriptionEn : room.descriptionId) ??
        room.descriptionId ??
        room.descriptionEn,
      bedConfiguration: room.bedConfiguration,
      maximumAdults: room.maximumAdults,
      maximumChildren: room.maximumChildren,
      maximumTotalGuests: room.maximumTotalGuests,
      extraBedAllowed: room.extraBedAllowed,
      maximumExtraBeds: room.maximumExtraBeds,
      amenities: [...amenityByCode.values()],
      media: mediaRows
        .filter((media) => media.roomTypeId === room.id)
        .map((media) => ({
          id: media.assetId,
          url: `/api/content/media/${media.assetId}`,
          alt:
            (params.locale === "en" ? media.altEn : media.altId) ??
            media.altId ??
            media.altEn ??
            room.nameId,
          caption:
            (params.locale === "en" ? media.captionEn : media.captionId) ??
            media.captionId ??
            media.captionEn,
          sortOrder: media.sortOrder,
        })),
    };
  });
}

export async function getPublicGalleryMedia(params: {
  propertyId: string;
  locale: PublicLocale;
}): Promise<PublicGalleryMedia[]> {
  const rows = await getDatabase()
    .select({
      id: mediaAssets.id,
      mediaType: mediaAssets.mediaType,
      altId: mediaAssets.altId,
      altEn: mediaAssets.altEn,
      captionId: mediaAssets.captionId,
      captionEn: mediaAssets.captionEn,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .where(
      and(
        eq(mediaAssets.propertyId, params.propertyId),
        eq(mediaAssets.status, "PUBLISHED"),
        eq(mediaAssets.authenticPropertyMedia, true),
        eq(storedFiles.scanStatus, "CLEAN"),
        isNull(storedFiles.purgedAt),
      ),
    )
    .orderBy(desc(mediaAssets.createdAt));

  return rows.flatMap((row, index) => {
    if (row.mediaType !== "IMAGE" && row.mediaType !== "VIDEO") return [];
    const alt =
      (params.locale === "en" ? row.altEn : row.altId) ??
      row.altId ??
      row.altEn ??
      "KOOKA Residence";
    return [
      {
        id: row.id,
        mediaType: row.mediaType,
        url: `/api/content/media/${row.id}`,
        alt,
        caption:
          (params.locale === "en" ? row.captionEn : row.captionId) ??
          row.captionId ??
          row.captionEn ??
          alt,
        sortOrder: index,
      },
    ];
  });
}

export async function getPublicLandingPage(params: {
  propertyId: string;
  locale: PublicLocale;
  routeKey?: string;
  versionId?: string;
  now?: Date;
}): Promise<PublicLandingData> {
  const now = params.now ?? new Date();
  const routeKey = normalizeRouteKey(params.routeKey ?? "home");
  const db = getDatabase();
  const [property] = await db
    .select({
      name: properties.name,
      address: properties.address,
      baseCurrency: properties.baseCurrency,
    })
    .from(properties)
    .where(
      and(
        eq(properties.id, params.propertyId),
        eq(properties.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!property) throw new AppError("NOT_FOUND", "Property not found");

  const version = await readPageVersion({
    propertyId: params.propertyId,
    routeKey,
    versionId: params.versionId,
    now,
  });
  const [sections, rooms] = await Promise.all([
    version
      ? readCmsSections(version.versionId, params.locale)
      : Promise.resolve(approvedBaselineSections(params.locale)),
    readPublicRoomTypes({
      propertyId: params.propertyId,
      locale: params.locale,
      now,
    }),
  ]);

  return {
    source: version ? "PUBLISHED_CMS" : "APPROVED_BASELINE",
    locale: params.locale,
    pageVersionId: version?.versionId ?? null,
    property: {
      name: property.name,
      address: property.address,
      baseCurrency: "IDR",
    },
    sections,
    rooms,
    generatedAt: now.toISOString(),
  };
}

export async function getContentOverview(params: {
  session: ContentStaffSession;
  propertyId: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.content.view",
  );
  return getDatabase()
    .select({
      pageId: contentPages.id,
      routeKey: contentPages.routeKey,
      pageStatus: contentPages.status,
      versionId: contentPageVersions.id,
      versionNumber: contentPageVersions.versionNumber,
      lifecycleStatus: contentPageVersions.lifecycleStatus,
      effectiveFrom: contentPageVersions.effectiveFrom,
      publishedAt: contentPageVersions.publishedAt,
      updatedAt: contentPageVersions.updatedAt,
    })
    .from(contentPages)
    .leftJoin(
      contentPageVersions,
      eq(contentPageVersions.contentPageId, contentPages.id),
    )
    .where(eq(contentPages.propertyId, params.propertyId))
    .orderBy(contentPages.routeKey, desc(contentPageVersions.versionNumber));
}

async function assertMediaBelongsToProperty(
  propertyId: string,
  mediaAssetIds: string[],
): Promise<void> {
  const ids = [...new Set(mediaAssetIds)];
  if (ids.length === 0) return;
  const rows = await getDatabase()
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.propertyId, propertyId),
        inArray(mediaAssets.id, ids),
        ne(mediaAssets.status, "ARCHIVED"),
      ),
    );
  if (rows.length !== ids.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "One or more media assets are invalid for this property",
    );
  }
}

export async function createContentPageDraft(params: {
  session: ContentStaffSession;
  propertyId: string;
  input: ContentPageDraftInput;
}): Promise<ContentMutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.content.edit",
  );
  assertDraftInput(params.input);
  const reason = assertReason(params.input.reason);
  const routeKey = normalizeRouteKey(params.input.routeKey);
  const mediaAssetIds = params.input.sections.flatMap(
    (section) => section.mediaAssetIds ?? [],
  );
  await assertMediaBelongsToProperty(params.propertyId, mediaAssetIds);

  return getDatabase().transaction(async (tx) => {
    await tx
      .insert(contentPages)
      .values({
        propertyId: params.propertyId,
        routeKey,
        status: "ACTIVE",
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .onConflictDoNothing();
    const [page] = await tx
      .select({ id: contentPages.id })
      .from(contentPages)
      .where(
        and(
          eq(contentPages.propertyId, params.propertyId),
          eq(contentPages.routeKey, routeKey),
        ),
      )
      .limit(1);
    if (!page) throw new Error("Failed to resolve content page");

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`content-page:${page.id}`}, 0))`,
    );
    const versions = await tx
      .select({ versionNumber: contentPageVersions.versionNumber })
      .from(contentPageVersions)
      .where(eq(contentPageVersions.contentPageId, page.id));
    const versionNumber =
      versions.reduce(
        (maximum, version) => Math.max(maximum, version.versionNumber),
        0,
      ) + 1;
    const [version] = await tx
      .insert(contentPageVersions)
      .values({
        contentPageId: page.id,
        versionNumber,
        lifecycleStatus: "DRAFT",
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .returning({ id: contentPageVersions.id });
    if (!version) throw new Error("Failed to create content version");

    for (const section of params.input.sections) {
      const [createdSection] = await tx
        .insert(contentSections)
        .values({
          pageVersionId: version.id,
          sectionKey: section.key,
          sectionType: section.type,
          sortOrder: section.sortOrder,
          settings: section.settings ?? null,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: contentSections.id });
      if (!createdSection) throw new Error("Failed to create content section");
      await tx.insert(contentTranslations).values([
        {
          contentSectionId: createdSection.id,
          locale: "id",
          translationStatus: "DRAFT",
          content: section.translations.id,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        },
        {
          contentSectionId: createdSection.id,
          locale: "en",
          translationStatus: "DRAFT",
          content: section.translations.en,
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        },
      ]);
      if (section.mediaAssetIds?.length) {
        await tx.insert(mediaUsages).values(
          section.mediaAssetIds.map((mediaAssetId, sortOrder) => ({
            mediaAssetId,
            usageType: "CONTENT_SECTION",
            targetId: createdSection.id,
            sortOrder,
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
        action: "cms.content.version.create",
        targetType: "content_page_version",
        targetId: version.id,
        after: {
          routeKey,
          versionNumber,
          sectionKeys: params.input.sections.map((section) => section.key),
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: version.id, versionNumber, lifecycleStatus: "DRAFT" };
  });
}

async function getOwnedVersion(versionId: string, propertyId: string) {
  const [version] = await getDatabase()
    .select({
      id: contentPageVersions.id,
      pageId: contentPages.id,
      routeKey: contentPages.routeKey,
      versionNumber: contentPageVersions.versionNumber,
      lifecycleStatus: contentPageVersions.lifecycleStatus,
    })
    .from(contentPageVersions)
    .innerJoin(
      contentPages,
      eq(contentPages.id, contentPageVersions.contentPageId),
    )
    .where(
      and(
        eq(contentPageVersions.id, versionId),
        eq(contentPages.propertyId, propertyId),
      ),
    )
    .limit(1);
  if (!version) throw new AppError("NOT_FOUND", "Content version not found");
  return version;
}

export async function submitContentForReview(params: {
  session: ContentStaffSession;
  propertyId: string;
  versionId: string;
  reason: string;
}): Promise<ContentMutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.content.edit",
  );
  const reason = assertReason(params.reason);
  const version = await getOwnedVersion(params.versionId, params.propertyId);
  if (version.lifecycleStatus !== "DRAFT") {
    throw new AppError("CONFLICT", "Only a draft can be submitted for review");
  }
  return getDatabase().transaction(async (tx) => {
    await tx
      .update(contentPageVersions)
      .set({
        lifecycleStatus: "IN_REVIEW",
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(contentPageVersions.id, version.id));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "cms.content.submit_review",
        targetType: "content_page_version",
        targetId: version.id,
        before: { lifecycleStatus: version.lifecycleStatus },
        after: { lifecycleStatus: "IN_REVIEW" },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: version.id, lifecycleStatus: "IN_REVIEW" };
  });
}

async function assertPublishReady(versionId: string): Promise<void> {
  const db = getDatabase();
  const sections = await db
    .select({ id: contentSections.id, type: contentSections.sectionType })
    .from(contentSections)
    .where(eq(contentSections.pageVersionId, versionId));
  const presentTypes = new Set(sections.map((section) => section.type));
  const missing = [...REQUIRED_HOME_SECTION_TYPES].filter(
    (type) => !presentTypes.has(type),
  );
  if (missing.length) {
    throw new AppError(
      "CONFLICT",
      `Required landing sections are missing: ${missing.join(", ")}`,
    );
  }
  const sectionIds = sections.map((section) => section.id);
  const translations = await db
    .select({
      sectionId: contentTranslations.contentSectionId,
      locale: contentTranslations.locale,
      content: contentTranslations.content,
    })
    .from(contentTranslations)
    .where(inArray(contentTranslations.contentSectionId, sectionIds));
  for (const sectionId of sectionIds) {
    for (const locale of ["id", "en"] as const) {
      const translation = translations.find(
        (item) => item.sectionId === sectionId && item.locale === locale,
      );
      if (!translation || Object.keys(translation.content).length === 0) {
        throw new AppError(
          "CONFLICT",
          `Translation ${locale} is incomplete for a required section`,
        );
      }
      assertEditorialBoundary(translation.content);
    }
  }

  const heroIds = sections
    .filter((section) => section.type === "HERO")
    .map((section) => section.id);
  const authenticHero = await db
    .select({ id: mediaAssets.id })
    .from(mediaUsages)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaUsages.mediaAssetId))
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .where(
      and(
        inArray(mediaUsages.targetId, heroIds),
        eq(mediaUsages.usageType, "CONTENT_SECTION"),
        eq(mediaAssets.authenticPropertyMedia, true),
        eq(mediaAssets.status, "PUBLISHED"),
        eq(storedFiles.scanStatus, "CLEAN"),
        isNull(storedFiles.purgedAt),
      ),
    )
    .limit(1);
  if (authenticHero.length === 0) {
    throw new AppError(
      "CONFLICT",
      "Published landing content requires an authentic, scanned hero image",
    );
  }
}

export async function publishContentVersion(params: {
  session: ContentStaffSession;
  propertyId: string;
  versionId: string;
  reason: string;
  effectiveFrom?: Date;
  now?: Date;
}): Promise<ContentMutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.content.publish",
  );
  const reason = assertReason(params.reason);
  const version = await getOwnedVersion(params.versionId, params.propertyId);
  if (version.lifecycleStatus !== "IN_REVIEW") {
    throw new AppError("CONFLICT", "Only reviewed content can be published");
  }
  await assertPublishReady(version.id);
  const now = params.now ?? new Date();
  const effectiveFrom = params.effectiveFrom ?? now;

  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`content-page:${version.pageId}`}, 0))`,
    );
    await tx
      .update(contentPageVersions)
      .set({
        lifecycleStatus: "ARCHIVED",
        updatedAt: now,
        updatedByUserId: params.session.user.id,
      })
      .where(
        and(
          eq(contentPageVersions.contentPageId, version.pageId),
          eq(contentPageVersions.lifecycleStatus, "PUBLISHED"),
          ne(contentPageVersions.id, version.id),
        ),
      );
    await tx
      .update(contentPageVersions)
      .set({
        lifecycleStatus: "PUBLISHED",
        effectiveFrom,
        publishedAt: now,
        publishedByUserId: params.session.user.id,
        updatedAt: now,
        updatedByUserId: params.session.user.id,
      })
      .where(eq(contentPageVersions.id, version.id));
    const sectionRows = await tx
      .select({ id: contentSections.id })
      .from(contentSections)
      .where(eq(contentSections.pageVersionId, version.id));
    await tx
      .update(contentTranslations)
      .set({
        translationStatus: "PUBLISHED",
        updatedAt: now,
        updatedByUserId: params.session.user.id,
      })
      .where(
        inArray(
          contentTranslations.contentSectionId,
          sectionRows.map((section) => section.id),
        ),
      );
    await enqueueOutboxEvent(
      {
        topic: "cms.content.published",
        aggregateType: "content_page_version",
        aggregateId: version.id,
        payload: {
          propertyId: params.propertyId,
          routeKey: version.routeKey,
          versionNumber: version.versionNumber,
        },
      },
      tx,
    );
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "cms.content.publish",
        targetType: "content_page_version",
        targetId: version.id,
        before: { lifecycleStatus: version.lifecycleStatus },
        after: {
          lifecycleStatus: "PUBLISHED",
          effectiveFrom: effectiveFrom.toISOString(),
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: version.id, lifecycleStatus: "PUBLISHED" };
  });
}

async function versionAsDraftInput(
  versionId: string,
  routeKey: string,
  reason: string,
): Promise<ContentPageDraftInput> {
  const db = getDatabase();
  const sections = await db
    .select({
      id: contentSections.id,
      key: contentSections.sectionKey,
      type: contentSections.sectionType,
      sortOrder: contentSections.sortOrder,
      settings: contentSections.settings,
    })
    .from(contentSections)
    .where(eq(contentSections.pageVersionId, versionId))
    .orderBy(asc(contentSections.sortOrder));
  const sectionIds = sections.map((section) => section.id);
  const translations = await db
    .select({
      sectionId: contentTranslations.contentSectionId,
      locale: contentTranslations.locale,
      content: contentTranslations.content,
    })
    .from(contentTranslations)
    .where(inArray(contentTranslations.contentSectionId, sectionIds));
  const usages = await db
    .select({
      sectionId: mediaUsages.targetId,
      mediaAssetId: mediaUsages.mediaAssetId,
      sortOrder: mediaUsages.sortOrder,
    })
    .from(mediaUsages)
    .where(
      and(
        inArray(mediaUsages.targetId, sectionIds),
        eq(mediaUsages.usageType, "CONTENT_SECTION"),
      ),
    )
    .orderBy(asc(mediaUsages.sortOrder));

  const draftSections: ContentSectionDraftInput[] = sections.map((section) => {
    const id = translations.find(
      (translation) =>
        translation.sectionId === section.id && translation.locale === "id",
    )?.content;
    const en = translations.find(
      (translation) =>
        translation.sectionId === section.id && translation.locale === "en",
    )?.content;
    if (!id || !en) {
      throw new AppError(
        "CONFLICT",
        "Source version is missing a bilingual translation",
      );
    }
    return {
      key: section.key,
      type: section.type,
      sortOrder: section.sortOrder,
      settings: section.settings ?? undefined,
      translations: { id, en },
      mediaAssetIds: usages
        .filter((usage) => usage.sectionId === section.id)
        .map((usage) => usage.mediaAssetId),
    };
  });
  return { routeKey, reason, sections: draftSections };
}

export async function restoreContentVersion(params: {
  session: ContentStaffSession;
  propertyId: string;
  sourceVersionId: string;
  reason: string;
}): Promise<ContentMutationResult> {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.content.edit",
  );
  const source = await getOwnedVersion(
    params.sourceVersionId,
    params.propertyId,
  );
  const reason = assertReason(params.reason);
  const input = await versionAsDraftInput(
    source.id,
    source.routeKey,
    `Restore v${source.versionNumber}: ${reason}`,
  );
  return createContentPageDraft({ ...params, input });
}

interface PreviewTokenPayload {
  propertyId: string;
  versionId: string;
  expiresAt: number;
}

function previewSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Preview signing secret is not configured",
    );
  }
  return secret;
}

function signPreview(encodedPayload: string): Buffer {
  return createHmac("sha256", previewSecret()).update(encodedPayload).digest();
}

export async function createContentPreviewToken(params: {
  session: ContentStaffSession;
  propertyId: string;
  versionId: string;
  ttlMinutes?: number;
}): Promise<{ token: string; expiresAt: string }> {
  await requirePermission(params.session, params.propertyId, "cms.preview");
  await getOwnedVersion(params.versionId, params.propertyId);
  const ttl = Math.min(Math.max(params.ttlMinutes ?? 15, 1), 60);
  const expiresAt = Date.now() + ttl * 60_000;
  const encodedPayload = Buffer.from(
    JSON.stringify({
      propertyId: params.propertyId,
      versionId: params.versionId,
      expiresAt,
    } satisfies PreviewTokenPayload),
  ).toString("base64url");
  const signature = signPreview(encodedPayload).toString("base64url");
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function verifyContentPreviewToken(token: string): PreviewTokenPayload {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) {
    throw new AppError("FORBIDDEN", "Invalid preview token");
  }
  const expected = signPreview(encodedPayload);
  const actual = Buffer.from(encodedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError("FORBIDDEN", "Invalid preview token");
  }
  let payload: PreviewTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as PreviewTokenPayload;
  } catch {
    throw new AppError("FORBIDDEN", "Invalid preview token");
  }
  if (
    typeof payload.propertyId !== "string" ||
    typeof payload.versionId !== "string" ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= Date.now()
  ) {
    throw new AppError("FORBIDDEN", "Preview token has expired");
  }
  return payload;
}
