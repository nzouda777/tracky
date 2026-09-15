import type { Metadata, Viewport } from "next";
import { Archivo, Spline_Sans_Mono } from "next/font/google";

import "./globals.css";

/**
 * Archivo carries the whole interface.
 *
 * It is a grotesque cut for signage and wayfinding, which is the right
 * register for a dispatch tool — and its `wdth` axis gives us the expanded cut
 * used on display headings without loading a second family. See
 * `.type-display` in globals.css.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/**
 * Mono is reserved for real codes — order numbers, tracking tokens, times —
 * where lining up digits is functional. Never for decorative labels.
 */
const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tracky",
    template: "%s · Tracky",
  },
  description:
    "Post-purchase order tracking and last-mile delivery management for Shopify stores.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
