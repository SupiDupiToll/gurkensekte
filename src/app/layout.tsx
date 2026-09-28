import type { Metadata, Viewport } from "next";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import { CultHeader } from "@/components/CultHeader";
import { Footer } from "@/components/Footer";
import { ReferralCapture } from "@/components/ReferralCapture";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gurken Sekte – Offizielle Kult-Website",
  description:
    "Willkommen bei der Gurken Sekte! Tritt unserem exklusiven Kult bei und spende Gurken für die Erleuchtung.",
  applicationName: "Gurken Sekte",
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
    <html lang="de" className="h-full" data-stack-theme="dark">
      <head>
        <script
          src="https://embed.impressum.mangoe.de/impressum-embed.js"
          async
        />
      </head>
      <body className="min-h-full flex flex-col">
        <HexclaveProvider app={hexclaveServerApp}>
          <ReferralCapture />
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
