import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invotick — Invoices & Estimates",
    short_name: "Invotick",
    description: "Create, send and track invoices and estimates on any device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F7FB",
    theme_color: "#0D4DC0",
    icons: [
      { src: "/invotick-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/invotick-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
