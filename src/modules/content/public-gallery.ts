import type {
  LandingMedia,
  LandingSection,
  PublicGalleryMedia,
  PublicLandingData,
  PublicLocale,
} from "./contracts";

export type PublicGalleryCategory =
  "ROOMS" | "SPACES" | "FACILITIES" | "DINING" | "VIDEOS";

export interface PublicGalleryItem {
  id: string;
  kind: "IMAGE" | "VIDEO";
  category: PublicGalleryCategory;
  src: string;
  poster?: string;
  alt: string;
  caption: string;
}

const authenticImageReplacements: Record<string, string> = {
  "/images/kooka-hero.jpeg": "/images/kooka-assets/ark-05080.jpg",
  "/images/tropical-courtyard.jpg": "/images/kooka-assets/ark-05070.jpg",
  "/images/gallery-room.jpg": "/images/kooka-assets/ark-05100.jpg",
};

function authenticImage(value: string) {
  return authenticImageReplacements[value] ?? value;
}

function strings(section: LandingSection | undefined, key: string) {
  const value = section?.content[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function value(section: LandingSection | undefined, key: string) {
  const candidate = section?.content[key];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function imageCategory(
  media: Pick<LandingMedia, "alt" | "caption">,
): PublicGalleryCategory {
  const descriptor = `${media.alt} ${media.caption ?? ""}`.toLowerCase();
  if (
    /(bathroom|shower|amenity|facility|fasilitas|kamar mandi)/u.test(descriptor)
  ) {
    return "FACILITIES";
  }
  if (/(room|bed|bedroom|guestroom|kamar|tempat tidur)/u.test(descriptor)) {
    return "ROOMS";
  }
  if (
    /(food|drink|dish|dining|kitchen|makanan|minuman|hidangan)/u.test(
      descriptor,
    )
  ) {
    return "DINING";
  }
  return "SPACES";
}

export function buildPublicGalleryItems(
  data: PublicLandingData,
  publishedMedia: PublicGalleryMedia[] = [],
): PublicGalleryItem[] {
  const locale = data.locale;
  const byKey = new Map(data.sections.map((section) => [section.key, section]));
  const hero = byKey.get("hero");
  const gallery = byKey.get("gallery");
  const experience = byKey.get("experience");
  const items: PublicGalleryItem[] = [];
  const seenSources = new Set<string>();

  function add(item: PublicGalleryItem) {
    const src =
      item.kind === "IMAGE" ? authenticImage(item.src) : item.src.trim();
    const assetMatch = src.match(/^\/api\/content\/media\/([^/?#]+)/u);
    const mediaKey = assetMatch ? `asset:${assetMatch[1]}` : `src:${src}`;
    if (!src || seenSources.has(mediaKey)) return;
    seenSources.add(mediaKey);
    items.push({ ...item, src });
  }

  function addSectionImages(
    section: LandingSection | undefined,
    defaultCategory: PublicGalleryCategory,
    fallbackAlt: string,
  ) {
    for (const media of section?.media ?? []) {
      add({
        id: `${section?.key ?? "section"}-${media.id}`,
        kind: "IMAGE",
        category:
          defaultCategory === "SPACES" ? imageCategory(media) : defaultCategory,
        src: media.url,
        alt: media.alt || fallbackAlt,
        caption: media.caption || media.alt || fallbackAlt,
      });
    }
    strings(section, "images").forEach((src, index) =>
      add({
        id: `${section?.key ?? "section"}-image-${index}`,
        kind: "IMAGE",
        category: defaultCategory,
        src,
        alt: fallbackAlt,
        caption: fallbackAlt,
      }),
    );
  }

  const heroImage =
    hero?.media?.[0]?.url ||
    value(hero, "imageUrl") ||
    "/images/kooka-assets/ark-05080.jpg";
  add({
    id: "hero-image",
    kind: "IMAGE",
    category: "SPACES",
    src: heroImage,
    alt:
      hero?.media?.[0]?.alt ||
      (locale === "id"
        ? "Suasana KOOKA Residence Surabaya"
        : "The atmosphere at KOOKA Residence Surabaya"),
    caption:
      hero?.media?.[0]?.caption ||
      (locale === "id"
        ? "KOOKA Residence Surabaya"
        : "KOOKA Residence Surabaya"),
  });

  addSectionImages(
    gallery,
    "SPACES",
    locale === "id" ? "Momen di KOOKA" : "A moment at KOOKA",
  );
  addSectionImages(
    experience,
    "SPACES",
    locale === "id" ? "Suasana KOOKA" : "The KOOKA atmosphere",
  );
  for (const section of data.sections) {
    if (["hero", "gallery", "experience"].includes(section.key)) continue;
    addSectionImages(
      section,
      section.key === "rooms" ? "ROOMS" : "SPACES",
      locale === "id" ? "KOOKA Residence Surabaya" : "KOOKA Residence Surabaya",
    );
  }

  for (const room of data.rooms) {
    for (const media of room.media) {
      add({
        id: `room-${room.id}-${media.id}`,
        kind: "IMAGE",
        category: "ROOMS",
        src: media.url,
        alt: media.alt || room.name,
        caption: media.caption || room.name,
      });
    }
  }

  for (const media of publishedMedia) {
    add({
      id: `published-${media.id}`,
      kind: media.mediaType,
      category: media.mediaType === "VIDEO" ? "VIDEOS" : imageCategory(media),
      src: media.url,
      alt: media.alt,
      caption: media.caption || media.alt,
    });
  }

  const heroVideo = data.heroVideo;
  if (heroVideo) {
    add({
      id: "hero-video",
      kind: "VIDEO",
      category: "VIDEOS",
      src: heroVideo.url,
      poster: authenticImage(heroImage),
      alt:
        heroVideo.alt ||
        (locale === "id"
          ? "Video suasana KOOKA Residence"
          : "KOOKA Residence atmosphere video"),
      caption:
        heroVideo.caption ||
        (locale === "id"
          ? "Suasana tenang di KOOKA Residence"
          : "A quiet moment at KOOKA Residence"),
    });
  }

  if (data.menu?.categories.length) {
    add({
      id: "kooka-kitchen",
      kind: "IMAGE",
      category: "DINING",
      src: "/images/agoda-kooka/dining-food-beverages.jpg",
      alt:
        locale === "id"
          ? "Makanan dan minuman dari dapur KOOKA"
          : "Food and drinks from the KOOKA kitchen",
      caption: locale === "id" ? "Dari dapur KOOKA" : "From the KOOKA kitchen",
    });
  }

  return items;
}

export function galleryCategoryLabel(
  category: "ALL" | PublicGalleryCategory,
  locale: PublicLocale,
) {
  const labels: Record<
    "ALL" | PublicGalleryCategory,
    Record<PublicLocale, string>
  > = {
    ALL: { id: "Semua", en: "All" },
    ROOMS: { id: "Kamar", en: "Rooms" },
    SPACES: { id: "Taman & area bersama", en: "Garden & shared spaces" },
    FACILITIES: { id: "Fasilitas", en: "Facilities" },
    DINING: { id: "Makanan & minuman", en: "Food & drinks" },
    VIDEOS: { id: "Video", en: "Videos" },
  };
  return labels[category][locale];
}
