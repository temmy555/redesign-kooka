import { describe, expect, it } from "vitest";

import { approvedBaselineLanding } from "../../src/modules/content/default-content";
import {
  buildPublicGalleryItems,
  galleryCategoryLabel,
} from "../../src/modules/content/public-gallery";

describe("public gallery", () => {
  it("builds a deduplicated gallery from baseline content and video", () => {
    const items = buildPublicGalleryItems(approvedBaselineLanding("en"));

    expect(items.length).toBeGreaterThan(3);
    expect(items.some((item) => item.kind === "VIDEO")).toBe(true);
    expect(new Set(items.map((item) => item.src)).size).toBe(items.length);
  });

  it("includes all published CMS media while deduplicating linked assets", () => {
    const data = approvedBaselineLanding("id");
    data.sections[0]!.media = [
      {
        id: "asset-1",
        url: "/api/content/media/asset-1",
        alt: "Kamar Queen",
        caption: "Kamar Queen",
        sortOrder: 0,
      },
    ];
    const items = buildPublicGalleryItems(data, [
      {
        id: "asset-1",
        mediaType: "IMAGE",
        url: "/api/content/media/asset-1",
        alt: "Kamar Queen",
        caption: "Kamar Queen",
        sortOrder: 0,
      },
      {
        id: "asset-2",
        mediaType: "IMAGE",
        url: "/api/content/media/asset-2",
        alt: "Private bathroom",
        caption: "Private bathroom",
        sortOrder: 1,
      },
    ]);

    expect(
      items.filter((item) => item.src === "/api/content/media/asset-1"),
    ).toHaveLength(1);
    expect(
      items.find((item) => item.src === "/api/content/media/asset-2")?.category,
    ).toBe("FACILITIES");
  });

  it("localizes public category labels", () => {
    expect(galleryCategoryLabel("SPACES", "id")).toBe("Taman & area bersama");
    expect(galleryCategoryLabel("VIDEOS", "en")).toBe("Videos");
  });
});
