import type { MetadataRoute } from "next";
import { BRAND, palette } from "@/lib/brand";

/**
 * Web App Manifest — makes the site installable on Android, iOS (Add to Home
 * Screen), tablets, and desktop as a standalone app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: palette.ink,
    theme_color: palette.ink,
    categories: ["food", "shopping", "lifestyle"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        // Cache-bust so reinstalled / refreshed PWAs drop the old yellow head tile.
        src: "/brand/icon-192.png?v=sticker3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png?v=sticker3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
