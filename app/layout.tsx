import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import {
  isMaintenanceModeEnabled,
  isValidMaintenancePreviewToken,
  MAINTENANCE_PREVIEW_COOKIE,
} from "../src/platform/maintenance-preview";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "KOOKA Residence Surabaya",
    template: "%s · KOOKA Residence Surabaya",
  },
  description:
    "Urban Tropical Retreat di Surabaya — penginapan yang tenang, hangat, hijau, dan personal dengan direct booking.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: { id: "/", en: "/?locale=en" },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    alternateLocale: "en_US",
    siteName: "KOOKA Residence Surabaya",
    title: "KOOKA Residence Surabaya · Urban Tropical Retreat",
    description:
      "Tempat tenang, hangat, dan hijau untuk beristirahat di Surabaya.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "KOOKA Residence Surabaya · Urban Tropical Retreat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KOOKA Residence Surabaya",
    description: "Urban Tropical Retreat di Surabaya.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#123f35",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const previewActive =
    isMaintenanceModeEnabled() &&
    isValidMaintenancePreviewToken(
      cookieStore.get(MAINTENANCE_PREVIEW_COOKIE)?.value,
    );

  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        {children}
        {previewActive ? (
          <aside className="maintenance-preview-banner">
            <span>Production preview · public maintenance remains active</span>
            <form action="/api/maintenance-preview/logout" method="post">
              <button type="submit">Exit preview</button>
            </form>
          </aside>
        ) : null}
      </body>
    </html>
  );
}
