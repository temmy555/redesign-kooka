import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.UAT_DEV_ORIGIN
    ? [process.env.UAT_DEV_ORIGIN]
    : undefined,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  images: {
    qualities: [75],
  },
  experimental: {
    // Upload media melewati proxy.ts sebelum mencapai route handler. Beri ruang
    // untuk file maksimum 24 MB beserta metadata multipart request-nya.
    proxyClientMaxBodySize: "25mb",
  },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
