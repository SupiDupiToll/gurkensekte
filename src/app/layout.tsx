import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import { CultHeader } from "@/components/CultHeader";
import { Footer } from "@/components/Footer";
import { PwaRegister } from "@/components/PwaRegister";
import { ReferralCapture } from "@/components/ReferralCapture";
import "./globals.css";

// Taste-Regel 3.A: Fonts immer via next/font (self-hosted, display:swap),
// nie via <link> oder @import. Sans (Outfit) ist der Default für alles;
// Fraunces-Serif nur für Zitate (font-serif) – siehe Fix 4.
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const seitenUrl =
  (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://gurkensekte.de")
    .trim()
    .replace(/\/+$/, "") || "https://gurkensekte.de";

export const metadata: Metadata = {
  metadataBase: new URL(seitenUrl),
  title: "Gurken Sekte – Offizielle Kult-Website",
  description:
    "Tritt der Gurken Sekte bei: Gürkchen-Chat, tägliche Zitate, Punkte & Casino, GurkenMail-Adresse und Spenden – sammle 1.000 Segen für eine echte Gurke.",
  applicationName: "Gurken Sekte",
  keywords: [
    "Gurken Sekte",
    "Gürkchen",
    "GurkenMail",
    "Mitgliederbereich",
    "Punkte sammeln",
    "Casino",
    "Spenden",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: "Gurken Sekte",
    title: "Gurken Sekte – Offizielle Kult-Website",
    description:
      "Tritt der Gurken Sekte bei: Gürkchen-Chat, tägliche Zitate, Punkte & Casino, GurkenMail-Adresse und Spenden – sammle 1.000 Segen für eine echte Gurke.",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Gurken Sekte Logo" }],
  },
  twitter: {
    card: "summary",
    title: "Gurken Sekte – Offizielle Kult-Website",
    description:
      "Tritt der Gurken Sekte bei: Gürkchen-Chat, tägliche Zitate, Punkte & Casino, GurkenMail-Adresse und Spenden – sammle 1.000 Segen für eine echte Gurke.",
    images: ["/icon.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Gurken Sekte",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3226",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`h-full ${outfit.variable} ${fraunces.variable}`} data-stack-theme="dark">
      <head>
        <script
          src="https://embed.impressum.mangoe.de/impressum-embed.js"
          async
        />
        {/* Reveal startet bei opacity:0 – ohne JS bliebe alles unsichtbar. */}
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important;}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col">
        <HexclaveProvider app={hexclaveServerApp}>
          <ReferralCapture />
          <PwaRegister />
          <HexclaveTheme
            theme={{
              dark: {
                background: "#1e3226",
                foreground: "#ede8d6",
                card: "#101b14",
                cardForeground: "#ede8d6",
                popover: "#182219",
                popoverForeground: "#ede8d6",
                primary: "#abc189",
                primaryForeground: "#0b120d",
                secondary: "#2b3826",
                secondaryForeground: "#e3e9d3",
                muted: "#1c2820",
                mutedForeground: "#a3ad9a",
                accent: "#abc189",
                accentForeground: "#0b120d",
                destructive: "#ef4444",
                destructiveForeground: "#ffffff",
                border: "#2b3826",
                input: "#2b3826",
                ring: "#8fa96d",
              },
              radius: "0.5rem",
            }}
          >
            <CultHeader />
            <main className="flex-1">{children}</main>
            <Footer />
          </HexclaveTheme>
        </HexclaveProvider>
      </body>
    </html>
  );
}
