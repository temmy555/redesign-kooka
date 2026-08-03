import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOOKA Staff Operations",
    short_name: "KOOKA Staff",
    description: "Operasional dan absensi karyawan KOOKA Residence Surabaya.",
    start_url: "/staff",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#123f35",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/images/kooka-logo-official.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
