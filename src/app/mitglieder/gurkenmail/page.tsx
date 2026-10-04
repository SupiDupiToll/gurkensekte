import type { Metadata } from "next";
import { GurkenMailClient } from "@/components/GurkenMailClient";

export const metadata: Metadata = {
  title: "GurkenMail – dein Postfach | Gurken Sekte",
  description:
    "Deine name@gurkensekte.de Adresse: 3 Mails pro Tag senden, Posteingang lesen, Punkte sammeln, als App-Symbol installieren.",
  // Eigenes Manifest: Installation von hier startet direkt im Postfach.
  manifest: "/mitglieder/gurkenmail/manifest.webmanifest",
};

export default function GurkenMailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 md:pt-20">
      <p className="eyebrow">Mitgliederbereich</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
        GurkenMail
      </h1>
      <p className="mt-3 text-sm text-[#a3ad9a]">
        Deine Adresse auf <strong className="text-[#ede8d6]">gurkensekte.de</strong> – pro Tag 3 Mails
        schreiben, unbegrenzt empfangen. Fürs Versenden gibt es +10 Punkte, fürs Empfangen +5
        (max. 2 vergütete Mails pro Stunde).
      </p>
      <div className="mt-8">
        <GurkenMailClient />
      </div>
    </div>
  );
}
