import type { Metadata } from "next";
import { GurkenMailClient } from "@/components/GurkenMailClient";

export const metadata: Metadata = {
  title: "GurkenMail – dein Postfach | Gurken Sekte",
  description:
    "Deine name@gurkensekte.de Adresse: 3 Mails pro Tag senden, Posteingang lesen, als App-Symbol installieren.",
};

export default function GurkenMailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 md:pt-20">
      <p className="eyebrow">Mitgliederbereich</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
        🥒 GurkenMail
      </h1>
      <p className="mt-3 text-sm text-[#a3ad9a]">
        Deine Adresse auf <strong className="text-[#ede8d6]">gurkensekte.de</strong> – 3 Mails pro Tag,
        Posteingang inklusive.
      </p>
      <div className="mt-8">
        <GurkenMailClient />
      </div>
    </div>
  );
}
