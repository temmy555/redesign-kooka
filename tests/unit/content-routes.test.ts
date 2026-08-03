import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  getActivePropertyId: vi.fn(),
  getPublicLandingPage: vi.fn(),
  getPublicMenu: vi.fn(),
  readPublishedMedia: vi.fn(),
  getContentOverview: vi.fn(),
  createContentPageDraft: vi.fn(),
  submitContentForReview: vi.fn(),
  publishContentVersion: vi.fn(),
  restoreContentVersion: vi.fn(),
  createContentPreviewToken: vi.fn(),
  getMediaOverview: vi.fn(),
  uploadCmsMedia: vi.fn(),
  publishCmsMedia: vi.fn(),
  archiveCmsMedia: vi.fn(),
  linkCmsMedia: vi.fn(),
}));

vi.mock("../../src/platform/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("../../src/platform/property", () => ({
  getActivePropertyId: mocks.getActivePropertyId,
}));
vi.mock("../../src/modules/content/cms-service", () => ({
  getPublicLandingPage: mocks.getPublicLandingPage,
  getContentOverview: mocks.getContentOverview,
  createContentPageDraft: mocks.createContentPageDraft,
  submitContentForReview: mocks.submitContentForReview,
  publishContentVersion: mocks.publishContentVersion,
  restoreContentVersion: mocks.restoreContentVersion,
  createContentPreviewToken: mocks.createContentPreviewToken,
}));
vi.mock("../../src/modules/commerce/fnb-service", () => ({
  getPublicMenu: mocks.getPublicMenu,
}));
vi.mock("../../src/modules/content/media-service", () => ({
  readPublishedMedia: mocks.readPublishedMedia,
  getMediaOverview: mocks.getMediaOverview,
  uploadCmsMedia: mocks.uploadCmsMedia,
  publishCmsMedia: mocks.publishCmsMedia,
  archiveCmsMedia: mocks.archiveCmsMedia,
  linkCmsMedia: mocks.linkCmsMedia,
}));

import { GET as landingGet } from "../../app/api/content/landing/route";
import { GET as publicMediaGet } from "../../app/api/content/media/[assetId]/route";
import {
  GET as contentGet,
  POST as contentPost,
} from "../../app/api/staff/admin/content/route";
import {
  GET as mediaGet,
  PATCH as mediaPatch,
  POST as mediaPost,
} from "../../app/api/staff/admin/media/route";

const U1 = "11111111-1111-4111-a111-111111111111";
const U2 = "22222222-2222-4222-a222-222222222222";

function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Batch 4 content routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
      mock.mockResolvedValue({ ok: true });
    }
    mocks.requireCurrentSession.mockResolvedValue({ user: { id: U1 } });
    mocks.getActivePropertyId.mockResolvedValue(U2);
    mocks.getPublicMenu.mockResolvedValue({ categories: [] });
    mocks.createContentPreviewToken.mockResolvedValue({
      token: "preview-token",
      expiresAt: "2026-08-02T12:00:00.000Z",
    });
  });

  it("returns cacheable public landing content", async () => {
    mocks.getPublicLandingPage.mockResolvedValue({ locale: "en" });
    const response = await landingGet(
      new Request("http://localhost/api/content/landing?locale=en"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain(
      "stale-while-revalidate",
    );
    expect(mocks.getPublicLandingPage).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: U2, locale: "en" }),
    );
  });

  it("defaults public landing content to Indonesian", async () => {
    mocks.getPublicLandingPage.mockResolvedValue({ locale: "id" });
    const response = await landingGet(
      new Request("http://localhost/api/content/landing"),
    );
    expect(response.status).toBe(200);
    expect(mocks.getPublicLandingPage).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "id" }),
    );
  });

  it("keeps landing content available when the optional menu fails", async () => {
    mocks.getPublicLandingPage.mockResolvedValue({ locale: "id" });
    mocks.getPublicMenu.mockRejectedValue(new Error("menu unavailable"));
    const response = await landingGet(
      new Request("http://localhost/api/content/landing?locale=id"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locale: "id" });
  });

  it("does not expose unexpected public landing failures", async () => {
    mocks.getPublicLandingPage.mockRejectedValue(new Error("database detail"));
    const response = await landingGet(
      new Request("http://localhost/api/content/landing?locale=id"),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INTERNAL_ERROR" }),
      }),
    );
  });

  it("rejects an invalid public locale", async () => {
    const response = await landingGet(
      new Request("http://localhost/api/content/landing?locale=fr"),
    );
    expect(response.status).toBe(400);
  });

  it("delivers published media with safe headers", async () => {
    mocks.readPublishedMedia.mockResolvedValue({
      file: { mimeType: "image/jpeg" },
      bytes: Buffer.from([0xff, 0xd8, 0xff]),
    });
    const response = await publicMediaGet(
      new Request(`http://localhost/api/content/media/${U1}`),
      { params: Promise.resolve({ assetId: U1 }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns content and media overviews", async () => {
    const responses = await Promise.all([contentGet(), mediaGet()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
  });

  it.each([
    [
      "CREATE_DRAFT",
      {
        action: "CREATE_DRAFT",
        routeKey: "home",
        reason: "Initial approved content",
        sections: [
          {
            key: "hero",
            type: "HERO",
            sortOrder: 0,
            translations: {
              id: { title: "Tenang" },
              en: { title: "Calm" },
            },
          },
        ],
      },
      "createContentPageDraft",
      201,
    ],
    [
      "SUBMIT_REVIEW",
      { action: "SUBMIT_REVIEW", versionId: U1, reason: "Ready for review" },
      "submitContentForReview",
      200,
    ],
    [
      "PUBLISH",
      { action: "PUBLISH", versionId: U1, reason: "Approved to publish" },
      "publishContentVersion",
      200,
    ],
    [
      "RESTORE",
      { action: "RESTORE", sourceVersionId: U1, reason: "Restore revision" },
      "restoreContentVersion",
      201,
    ],
    [
      "CREATE_PREVIEW",
      { action: "CREATE_PREVIEW", versionId: U1, ttlMinutes: 10 },
      "createContentPreviewToken",
      200,
    ],
  ])("dispatches CMS action %s", async (_action, body, service, status) => {
    const response = await contentPost(
      jsonRequest("/api/staff/admin/content", body),
    );
    expect(response.status).toBe(status);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("uploads staged CMS media", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File([Buffer.from([0xff, 0xd8, 0xff])], "hero.jpg", {
        type: "image/jpeg",
      }),
    );
    form.set("altId", "Halaman KOOKA");
    form.set("altEn", "KOOKA courtyard");
    form.set("rightsSource", "Owned by KOOKA");
    form.set("authenticPropertyMedia", "true");
    const response = await mediaPost(
      new Request("http://localhost/api/staff/admin/media", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.uploadCmsMedia).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/jpeg" }),
    );
  });

  it.each([
    ["PUBLISH", "publishCmsMedia"],
    ["ARCHIVE", "archiveCmsMedia"],
  ])("dispatches media action %s", async (action, service) => {
    const response = await mediaPatch(
      jsonRequest(
        "/api/staff/admin/media",
        { action, assetId: U1, reason: "Approved media action" },
        "PATCH",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks[service as keyof typeof mocks]).toHaveBeenCalledOnce();
  });

  it("links media to an operational room type", async () => {
    const response = await mediaPatch(
      jsonRequest(
        "/api/staff/admin/media",
        {
          action: "LINK",
          assetId: U1,
          usageType: "ROOM_TYPE_HERO",
          targetId: U2,
          sortOrder: 0,
        },
        "PATCH",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.linkCmsMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: U1,
        propertyId: U2,
        targetId: U2,
        usageType: "ROOM_TYPE_HERO",
      }),
    );
  });

  it("returns unauthenticated on a missing CMS session", async () => {
    mocks.requireCurrentSession.mockRejectedValue(
      new Error("No authenticated staff session"),
    );
    expect((await contentGet()).status).toBe(401);
  });

  it("rejects invalid CMS and media input", async () => {
    const content = await contentPost(
      jsonRequest("/api/staff/admin/content", { action: "CREATE_DRAFT" }),
    );
    const media = await mediaPost(
      new Request("http://localhost/api/staff/admin/media", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(content.status).toBe(400);
    expect(media.status).toBe(400);
  });
});
