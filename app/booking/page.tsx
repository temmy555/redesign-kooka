import type { Metadata } from "next";

import BookingResults from "./BookingResults";
import type {
  PublicDisplayCurrency,
  PublicLocale,
} from "../../src/modules/content/contracts";

export const metadata: Metadata = {
  title: "Cari Kamar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export function nonNegativeInteger(
  value: string | string[] | undefined,
  fallback: number,
) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const locale: PublicLocale = query.locale === "en" ? "en" : "id";
  const currency: PublicDisplayCurrency =
    query.currency === "USD" || query.currency === "AUD"
      ? query.currency
      : "IDR";
  return (
    <BookingResults
      search={{
        checkInDate: String(query.checkInDate ?? ""),
        checkoutDate: String(query.checkoutDate ?? ""),
        rooms: Math.max(1, nonNegativeInteger(query.rooms, 1)),
        adults: Math.max(1, nonNegativeInteger(query.adults, 2)),
        children: nonNegativeInteger(query.children, 0),
        infants: nonNegativeInteger(query.infants, 0),
        locale,
        currency,
      }}
    />
  );
}
