import type { Metadata } from "next";

import BookingLookup from "./BookingLookup";

export const metadata: Metadata = {
  title: "Lihat Booking",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BookingLookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const code = Array.isArray(query.code) ? query.code[0] : query.code;
  const locale = query.locale === "en" ? "en" : "id";
  return <BookingLookup initialCode={code ?? ""} locale={locale} />;
}
