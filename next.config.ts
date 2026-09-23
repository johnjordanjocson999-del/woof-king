import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let sharp serve resized WebP on phone; /uploads stay in public/ and work
  // through the optimizer as local static files.
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 750, 1080, 1280, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },
  // Phone / tablet testing via LAN IP (http://192.168.x.x:3000).
  allowedDevOrigins: [
    "192.168.0.100",
    "192.168.0.*",
    "192.168.*.*",
    "10.*.*.*",
    "*.local",
    "localhost",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    // Soft navigations reuse recent RSC payloads so taps feel instant.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
