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
    <html lang="de" className="h-full">
      <head>
        <script
          src="https://embed.impressum.mangoe.de/impressum-embed.js"
          async
        />
      </head>
      <body className="min-h-full flex flex-col">
        <HexclaveProvider app={hexclaveServerApp}>
          <HexclaveTheme>
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
