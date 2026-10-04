"use client";

import Link from "next/link";
import { ArrowLeft, DiceFive } from "@phosphor-icons/react";
import { PunkteProvider, usePunkte } from "@/components/PunkteContext";
import { Slotmaschine } from "@/components/Slotmaschine";
import { GurkenRoulette } from "@/components/GurkenRoulette";
import { CasinoSection } from "@/components/CasinoSection";
import { Reveal } from "@/components/Reveal";
import { SpinningCucumber } from "@/components/SpinningCucumber";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

function CasinoInhalt({ apiBase, backHref }: { apiBase: string; backHref: string }) {
  const { punkte, loading } = usePunkte();

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-24 pt-12 md:pt-20">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7565] transition-colors hover:text-[#a3ad9a]"
      >
        <ArrowLeft size={16} />
        Zurück zum Mitgliederbereich
      </Link>

      <Reveal>
        <div className="mb-8 mt-6 text-left">
          <p className="eyebrow">Spielgeld · Punkte statt Euro</p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
            Gurken Casino
          </h1>
          <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-[#a3ad9a]">
            Reines Spielgeld: Hier wird mit deinen Punkten gezockt, niemals mit echtem
            Geld. Kessel und Walzen entscheiden, nicht dein Bauchgefühl.
          </p>
        </div>
      </Reveal>

      <div className="mb-6 flex justify-start">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-5 pr-6">
          <SpinningCucumber size="text-2xl" />
          <span className="text-sm font-semibold text-[#6b7565]">
            Guthaben
          </span>
          <span className="tabular font-display text-xl font-semibold text-[#ede8d6]">
            {loading ? "…" : zahl(punkte)}
          </span>
        </div>
      </div>

      <CasinoSection
        icon={<DiceFive size={40} weight="fill" className="text-[#c9a86a]" />}
        titel="Slotmaschine"
        teaser="Einsatz wählen, Walzen drehen lassen, bis zu 3× kassieren. Vorsicht: 3× kann auch baden gehen."
        cta="Slot öffnen"
      >
        <Slotmaschine apiBase={apiBase} />
      </CasinoSection>

      <CasinoSection
        icon={<SpinningCucumber size="text-5xl" />}
        titel="Gurken Roulette"
        teaser="Europäischer Kessel mit einer Null: Felder antippen, Kugel rollen lassen. Die Gewinnzahl zieht der Server."
        cta="Roulette öffnen"
      >
        <GurkenRoulette apiBase={apiBase} />
      </CasinoSection>
    </div>
  );
}

export function CasinoPage({ punkteApiBase, backHref }: { punkteApiBase: string; backHref: string }) {
  return (
    <PunkteProvider apiBase={punkteApiBase}>
      <CasinoInhalt apiBase={punkteApiBase} backHref={backHref} />
    </PunkteProvider>
  );
}
