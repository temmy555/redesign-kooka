import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDatabase } from "../../db";
import {
  contentPages,
  contentPageVersions,
  contentSections,
  mediaAssets,
  mediaUsages,
  roomTypes,
  storedFiles,
} from "../../db/schema";
import { recordAuditEvent } from "../../platform/audit";
import { requirePermission } from "../../platform/authorization";
import { AppError } from "../../platform/errors";
import {
  noopMalwareScanner,
  purgeStoredFile,
  readPublicStoredFile,
  runMalwareScan,
  saveStoredFile,
} from "../../platform/file-storage";
import type { ContentStaffSession } from "./contracts";

function textOrNull(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export interface MediaMetadataInput {
  title?: string | null;
  altId: string;
  altEn: string;
  captionId?: string | null;
  captionEn?: string | null;
  rightsSource: string;
  authenticPropertyMedia: boolean;
}

export type CmsMediaUsageType =
  "CONTENT_SECTION" | "ROOM_TYPE_HERO" | "ROOM_TYPE_GALLERY";

export async function getMediaOverview(params: {
  session: ContentStaffSession;
  propertyId: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.media.manage",
  );
  const rows = await getDatabase()
    .select({
      id: mediaAssets.id,
      status: mediaAssets.status,
      mediaType: mediaAssets.mediaType,
      title: mediaAssets.title,
      altId: mediaAssets.altId,
      altEn: mediaAssets.altEn,
      rightsSource: mediaAssets.rightsSource,
      authenticPropertyMedia: mediaAssets.authenticPropertyMedia,
      fileId: storedFiles.id,
      mimeType: storedFiles.mimeType,
      byteSize: storedFiles.byteSize,
      scanStatus: storedFiles.scanStatus,
      createdAt: mediaAssets.createdAt,
      usageId: mediaUsages.id,
      usageType: mediaUsages.usageType,
      targetId: mediaUsages.targetId,
      sortOrder: mediaUsages.sortOrder,
    })
    .from(mediaAssets)
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .leftJoin(mediaUsages, eq(mediaUsages.mediaAssetId, mediaAssets.id))
    .where(eq(mediaAssets.propertyId, params.propertyId))
    .orderBy(desc(mediaAssets.createdAt));

  const assets = new Map<
    string,
    Omit<
      (typeof rows)[number],
      "usageId" | "usageType" | "targetId" | "sortOrder"
    > & {
      usages: Array<{
        id: string;
        usageType: string;
        targetId: string;
        sortOrder: number;
      }>;
    }
  >();
  for (const row of rows) {
    const { usageId, usageType, targetId, sortOrder, ...asset } = row;
    const current = assets.get(row.id) ?? { ...asset, usages: [] };
    if (usageId && usageType && targetId) {
      current.usages.push({
        id: usageId,
        usageType,
        targetId,
        sortOrder: sortOrder ?? 0,
      });
    }
    assets.set(row.id, current);
  }
  return [...assets.values()];
}

export async function uploadCmsMedia(params: {
  session: ContentStaffSession;
  propertyId: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  metadata: MediaMetadataInput;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.media.manage",
  );
  const altId = params.metadata.altId.trim();
  const altEn = params.metadata.altEn.trim();
  const rightsSource = params.metadata.rightsSource.trim();
  if (!altId || !altEn || !rightsSource) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Bilingual alt text and media rights source are required",
    );
  }
  if (!params.mimeType.startsWith("image/")) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Phase 1 CMS accepts JPEG or PNG images only",
    );
  }

  const file = await saveStoredFile({
    propertyId: params.propertyId,
    mimeType: params.mimeType,
    bytes: params.bytes,
    originalName: params.originalName,
    classification: "PUBLIC_CONTENT",
    purpose: "CMS_MEDIA",
    retentionCategory: "CMS_PUBLISHED_MEDIA",
    actorUserId: params.session.user.id,
  });
  try {
    const scanStatus = await runMalwareScan(file.id, noopMalwareScanner);
    if (scanStatus !== "CLEAN") {
      throw new AppError(
        "CONFLICT",
        "Uploaded media did not pass file inspection",
      );
    }
    return await getDatabase().transaction(async (tx) => {
      const [asset] = await tx
        .insert(mediaAssets)
        .values({
          propertyId: params.propertyId,
          fileId: file.id,
          mediaType: "IMAGE",
          title: textOrNull(params.metadata.title),
          altId,
          altEn,
          captionId: textOrNull(params.metadata.captionId),
          captionEn: textOrNull(params.metadata.captionEn),
          rightsSource,
          authenticPropertyMedia: params.metadata.authenticPropertyMedia,
          status: "DRAFT",
          createdByUserId: params.session.user.id,
          updatedByUserId: params.session.user.id,
        })
        .returning({ id: mediaAssets.id });
      if (!asset) throw new Error("Failed to create media asset");
      await recordAuditEvent(
        {
          propertyId: params.propertyId,
          actorUserId: params.session.user.id,
          actorType: "user",
          action: "cms.media.upload",
          targetType: "media_asset",
          targetId: asset.id,
          after: {
            fileId: file.id,
            mimeType: params.mimeType,
            authenticPropertyMedia: params.metadata.authenticPropertyMedia,
            scanStatus,
          },
          result: "SUCCESS",
        },
        tx,
      );
      return { id: asset.id, fileId: file.id, scanStatus };
    });
  } catch (error) {
    await purgeStoredFile(file.id, params.session.user.id).catch(
      () => undefined,
    );
    throw error;
  }
}

async function getOwnedMedia(assetId: string, propertyId: string) {
  const [asset] = await getDatabase()
    .select({
      id: mediaAssets.id,
      fileId: mediaAssets.fileId,
      status: mediaAssets.status,
      authenticPropertyMedia: mediaAssets.authenticPropertyMedia,
      rightsSource: mediaAssets.rightsSource,
      altId: mediaAssets.altId,
      altEn: mediaAssets.altEn,
      scanStatus: storedFiles.scanStatus,
      purgedAt: storedFiles.purgedAt,
    })
    .from(mediaAssets)
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .where(
      and(eq(mediaAssets.id, assetId), eq(mediaAssets.propertyId, propertyId)),
    )
    .limit(1);
  if (!asset) throw new AppError("NOT_FOUND", "Media asset not found");
  return asset;
}

export async function publishCmsMedia(params: {
  session: ContentStaffSession;
  propertyId: string;
  assetId: string;
  reason: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.media.publish",
  );
  const asset = await getOwnedMedia(params.assetId, params.propertyId);
  if (asset.status !== "DRAFT") {
    throw new AppError("CONFLICT", "Only draft media can be published");
  }
  const scanStatus =
    asset.scanStatus === "PENDING"
      ? await runMalwareScan(asset.fileId, noopMalwareScanner)
      : asset.scanStatus;
  if (
    scanStatus !== "CLEAN" ||
    asset.purgedAt ||
    !asset.rightsSource ||
    !asset.altId ||
    !asset.altEn
  ) {
    throw new AppError(
      "CONFLICT",
      "Media must pass scanning and have rights plus bilingual alt text",
    );
  }
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new AppError("VALIDATION_ERROR", "A publish reason is required");
  }
  return getDatabase().transaction(async (tx) => {
    await tx
      .update(mediaAssets)
      .set({
        status: "PUBLISHED",
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(mediaAssets.id, asset.id));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "cms.media.publish",
        targetType: "media_asset",
        targetId: asset.id,
        before: { status: asset.status },
        after: {
          status: "PUBLISHED",
          authenticPropertyMedia: asset.authenticPropertyMedia,
        },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: asset.id, status: "PUBLISHED" };
  });
}

export async function archiveCmsMedia(params: {
  session: ContentStaffSession;
  propertyId: string;
  assetId: string;
  reason: string;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.media.publish",
  );
  const asset = await getOwnedMedia(params.assetId, params.propertyId);
  if (asset.status === "ARCHIVED") return { id: asset.id, status: "ARCHIVED" };
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new AppError("VALIDATION_ERROR", "An archive reason is required");
  }
  return getDatabase().transaction(async (tx) => {
    await tx
      .update(mediaAssets)
      .set({
        status: "ARCHIVED",
        updatedAt: new Date(),
        updatedByUserId: params.session.user.id,
      })
      .where(eq(mediaAssets.id, asset.id));
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "cms.media.archive",
        targetType: "media_asset",
        targetId: asset.id,
        before: { status: asset.status },
        after: { status: "ARCHIVED" },
        reason,
        result: "SUCCESS",
      },
      tx,
    );
    return { id: asset.id, status: "ARCHIVED" };
  });
}

async function assertMediaTarget(params: {
  propertyId: string;
  usageType: CmsMediaUsageType;
  targetId: string;
}) {
  if (params.usageType === "CONTENT_SECTION") {
    const [target] = await getDatabase()
      .select({ id: contentSections.id })
      .from(contentSections)
      .innerJoin(
        contentPageVersions,
        eq(contentPageVersions.id, contentSections.pageVersionId),
      )
      .innerJoin(
        contentPages,
        eq(contentPages.id, contentPageVersions.contentPageId),
      )
      .where(
        and(
          eq(contentSections.id, params.targetId),
          eq(contentPages.propertyId, params.propertyId),
        ),
      )
      .limit(1);
    if (!target) throw new AppError("NOT_FOUND", "CMS section not found");
    return;
  }

  const [target] = await getDatabase()
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(
      and(
        eq(roomTypes.id, params.targetId),
        eq(roomTypes.propertyId, params.propertyId),
      ),
    )
    .limit(1);
  if (!target) throw new AppError("NOT_FOUND", "Room type not found");
}

export async function linkCmsMedia(params: {
  session: ContentStaffSession;
  propertyId: string;
  assetId: string;
  usageType: CmsMediaUsageType;
  targetId: string;
  sortOrder: number;
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.media.manage",
  );
  const asset = await getOwnedMedia(params.assetId, params.propertyId);
  if (asset.status === "ARCHIVED") {
    throw new AppError("CONFLICT", "Archived media cannot be linked");
  }
  await assertMediaTarget(params);

  return getDatabase().transaction(async (tx) => {
    await tx
      .insert(mediaUsages)
      .values({
        mediaAssetId: params.assetId,
        usageType: params.usageType,
        targetId: params.targetId,
        sortOrder: params.sortOrder,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })
      .onConflictDoUpdate({
        target: [
          mediaUsages.mediaAssetId,
          mediaUsages.usageType,
          mediaUsages.targetId,
        ],
        set: {
          sortOrder: params.sortOrder,
          updatedAt: new Date(),
          updatedByUserId: params.session.user.id,
        },
      });
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "cms.media.link",
        targetType: "media_usage",
        targetId: params.targetId,
        after: {
          assetId: params.assetId,
          usageType: params.usageType,
          sortOrder: params.sortOrder,
        },
        result: "SUCCESS",
      },
      tx,
    );
    return {
      assetId: params.assetId,
      usageType: params.usageType,
      targetId: params.targetId,
      sortOrder: params.sortOrder,
    };
  });
}

export async function setRoomTypeGallery(params: {
  session: ContentStaffSession;
  propertyId: string;
  roomTypeId: string;
  assetIds: string[];
}) {
  await requirePermission(
    params.session,
    params.propertyId,
    "cms.media.manage",
  );
  const assetIds = [...new Set(params.assetIds)];
  if (!assetIds.length || assetIds.length > 20) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Room gallery must contain between 1 and 20 photos",
    );
  }
  await assertMediaTarget({
    propertyId: params.propertyId,
    usageType: "ROOM_TYPE_GALLERY",
    targetId: params.roomTypeId,
  });
  const assets = await Promise.all(
    assetIds.map((assetId) => getOwnedMedia(assetId, params.propertyId)),
  );
  if (
    assets.some(
      (asset) =>
        asset.status !== "PUBLISHED" ||
        asset.scanStatus !== "CLEAN" ||
        asset.purgedAt ||
        !asset.authenticPropertyMedia,
    )
  ) {
    throw new AppError(
      "CONFLICT",
      "Only published, verified, authentic property photos can be used in a room gallery",
    );
  }

  return getDatabase().transaction(async (tx) => {
    await tx
      .delete(mediaUsages)
      .where(
        and(
          eq(mediaUsages.targetId, params.roomTypeId),
          inArray(mediaUsages.usageType, [
            "ROOM_TYPE_HERO",
            "ROOM_TYPE_GALLERY",
          ]),
        ),
      );
    await tx.insert(mediaUsages).values(
      assetIds.map((assetId, index) => ({
        mediaAssetId: assetId,
        usageType: index === 0 ? "ROOM_TYPE_HERO" : "ROOM_TYPE_GALLERY",
        targetId: params.roomTypeId,
        sortOrder: index,
        createdByUserId: params.session.user.id,
        updatedByUserId: params.session.user.id,
      })),
    );
    await recordAuditEvent(
      {
        propertyId: params.propertyId,
        actorUserId: params.session.user.id,
        actorType: "user",
        action: "cms.media.room_gallery.set",
        targetType: "room_type",
        targetId: params.roomTypeId,
        after: { assetIds },
        result: "SUCCESS",
      },
      tx,
    );
    return {
      roomTypeId: params.roomTypeId,
      assetIds,
      heroAssetId: assetIds[0],
    };
  });
}

export async function readPublishedMedia(assetId: string) {
  const [asset] = await getDatabase()
    .select({ fileId: mediaAssets.fileId })
    .from(mediaAssets)
    .innerJoin(storedFiles, eq(storedFiles.id, mediaAssets.fileId))
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.status, "PUBLISHED"),
        eq(storedFiles.scanStatus, "CLEAN"),
        isNull(storedFiles.purgedAt),
      ),
    )
    .limit(1);
  if (!asset) throw new AppError("NOT_FOUND", "Published media not found");
  return readPublicStoredFile(asset.fileId);
}
