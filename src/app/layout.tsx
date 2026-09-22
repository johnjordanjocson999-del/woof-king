import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist } from "next/font/google";
import { BRAND, palette, paletteCssVars } from "@/lib/brand";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

/*
  Instrument Serif carries the brand: high stroke contrast, narrow, and it holds
  up at the very large display sizes the hero uses. Geist handles body copy and
  every number, where a neutral grotesque is easier to scan than a serif.
*/
const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const body = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s — ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/brand/icon-32.png?v=sticker3", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png?v=sticker3", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png?v=sticker3", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/icon-180.png?v=sticker3", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.description,
    type: "website",
    images: [{ url: "/brand/icon-512.png?v=sticker3" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: palette.ink,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      style={paletteCssVars()}
    >
      <body className="grain">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
