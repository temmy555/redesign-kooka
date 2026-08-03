export type PublicLocale = "id" | "en";
export type PublicDisplayCurrency = "IDR" | "USD" | "AUD";

export interface LocalizedText {
  id: string;
  en: string;
}

export interface LandingSection {
  key: string;
  type: string;
  content: Record<string, unknown>;
  media?: LandingMedia[];
}

export interface LandingMedia {
  id: string;
  url: string;
  alt: string;
  caption?: string | null;
  sortOrder: number;
}

export interface LandingAmenity {
  code: string;
  name: string;
  iconKey?: string | null;
}

export interface LandingRoomType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  bedConfiguration?: string | null;
  maximumAdults: number;
  maximumChildren: number;
  maximumTotalGuests: number;
  extraBedAllowed: boolean;
  maximumExtraBeds: number;
  amenities: LandingAmenity[];
  media: LandingMedia[];
}

export interface PublicMenuItem {
  id: string;
  code: string;
  versionId: string;
  versionNumber: number;
  name: string;
  description?: string | null;
  available: boolean;
  priceIdr: number;
  estimatedTotalIdr: number;
  taxIncluded: boolean;
  serviceChargeIncluded: boolean;
}

export interface PublicMenuCategory {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  items: PublicMenuItem[];
}

export interface PublicMenuData {
  locale: PublicLocale;
  officialCurrency: "IDR";
  displayRates: Partial<Record<Exclude<PublicDisplayCurrency, "IDR">, number>>;
  categories: PublicMenuCategory[];
  generatedAt: string;
}

export interface PublicLandingData {
  source: "PUBLISHED_CMS" | "APPROVED_BASELINE";
  locale: PublicLocale;
  pageVersionId?: string | null;
  property: {
    name: string;
    address?: string | null;
    baseCurrency: "IDR";
  };
  sections: LandingSection[];
  rooms: LandingRoomType[];
  menu?: PublicMenuData;
  generatedAt: string;
}

export interface ContentSectionDraftInput {
  key: string;
  type: string;
  sortOrder: number;
  settings?: Record<string, unknown>;
  translations: {
    id: Record<string, unknown>;
    en: Record<string, unknown>;
  };
  mediaAssetIds?: string[];
}

export interface ContentPageDraftInput {
  routeKey: string;
  reason: string;
  sections: ContentSectionDraftInput[];
}

export interface ContentStaffSession {
  user: { id: string };
}

export interface ContentMutationResult {
  id: string;
  versionNumber?: number;
  lifecycleStatus?: string;
}
