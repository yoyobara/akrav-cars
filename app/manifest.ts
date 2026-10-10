import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Akrav Cars",
    short_name: "Akrav Cars",
    description: "Who has which car, and where it was left.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
