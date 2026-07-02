import type { Metadata } from "next";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import { CultHeader } from "@/components/CultHeader";
import { CultMarquee } from "@/components/CultMarquee";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gurken Sekte – Offizielle Kult-Website",
  description:
    "Willkommen bei der Gurken Sekte! Tritt unserem exklusiven Kult bei und spende Gurken für die Erleuchtung.",
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
          <HexclaveTheme
            theme={{
              dark: {
                background: "#052e16",
                foreground: "#e8f5e9",
                card: "#14532d",
                cardForeground: "#e8f5e9",
                popover: "#14532d",
                popoverForeground: "#e8f5e9",
                primary: "#22c55e",
                primaryForeground: "#052e16",
                secondary: "#166534",
                secondaryForeground: "#bbf7d0",
                muted: "#14532d",
                mutedForeground: "#86efac",
                accent: "#22c55e",
                accentForeground: "#052e16",
                destructive: "#ef4444",
                destructiveForeground: "#ffffff",
                border: "#1f6e3a",
                input: "#166534",
                ring: "#22c55e",
              },
              radius: "1rem",
            }}
          >
            <CultHeader />
            <CultMarquee />
            <main className="flex-1">{children}</main>
            <Footer />
          </HexclaveTheme>
        </HexclaveProvider>
      </body>
    </html>
  );
}
