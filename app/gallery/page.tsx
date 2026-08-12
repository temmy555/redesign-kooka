import type { Metadata } from "next";

import { getPublicMenu } from "../../src/modules/commerce/fnb-service";
import {
  getPublicGalleryMedia,
  getPublicLandingPage,
} from "../../src/modules/content/cms-service";
import type { PublicGalleryMedia } from "../../src/modules/content/contracts";
import { approvedBaselineLanding } from "../../src/modules/content/default-content";
import { buildPublicGalleryItems } from "../../src/modules/content/public-gallery";
import { getActivePropertyId } from "../../src/platform/property";
import GalleryPage from "./GalleryPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Explore the rooms, garden, shared spaces, and quiet moments at KOOKA Residence Surabaya.",
  alternates: {
    canonical: "/gallery",
    languages: { en: "/gallery?locale=en", id: "/gallery?locale=id" },
  },
};

export default async function PublicGalleryPage({
  searchParams,
}: {
  searchParams?: Promise<{ locale?: string | string[] }>;
} = {}) {
  const query = searchParams ? await searchParams : undefined;
  const locale = query?.locale === "id" ? "id" : "en";
  let data = approvedBaselineLanding(locale);
  let publishedMedia: PublicGalleryMedia[] = [];
  try {
    const propertyId = await getActivePropertyId();
    const [landing, menu, media] = await Promise.all([
      getPublicLandingPage({ propertyId, locale }),
      getPublicMenu({ propertyId, locale }).catch(() => undefined),
      getPublicGalleryMedia({ propertyId, locale }).catch(() => []),
    ]);
    data = menu ? { ...landing, menu } : landing;
    publishedMedia = media;
  } catch {
    // Keep the public gallery available while CMS configuration is incomplete.
  }

  return (
    <GalleryPage
      items={buildPublicGalleryItems(data, publishedMedia)}
      locale={locale}
    />
  );
}
