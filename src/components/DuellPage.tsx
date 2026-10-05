"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { PunkteProvider, usePunkte } from "@/components/PunkteContext";
import { GurkenDuell } from "@/components/GurkenDuell";
import { Reveal } from "@/components/Reveal";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import { markiereSozialErledigt } from "@/components/TagesLiturgie";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

function DuellInhalt({
  duellApiBase,
  backHref,
}: {
  duellApiBase: string;
  backHref: string;
}) {
  const { punkte, loading } = usePunkte();

  // Besuch zählt als Sozial-Tat für die Tagesliturgie (Erscheinen = Ritual).
  useEffect(() => {
    markiereSozialErledigt();
  }, []);

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
          <p className="eyebrow">Spielgeld · Wartezimmer statt Bank</p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
            Gurken Duell
          </h1>
          <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-[#a3ad9a]">
            Nimm mit deiner Gurke im Wartezimmer Platz, fordere andere
            Mitglieder per Antippen heraus und spiele Tic Tac Toe um Punkte:
            Beide setzen denselben Einsatz, wer gewinnt, kassiert den ganzen
            Pot.
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

      <GurkenDuell duellApiBase={duellApiBase} />
    </div>
  );
}

export function DuellPage({
  punkteApiBase,
  duellApiBase,
  backHref,
}: {
  punkteApiBase: string;
  duellApiBase: string;
  backHref: string;
}) {
  return (
    <PunkteProvider apiBase={punkteApiBase}>
      <DuellInhalt duellApiBase={duellApiBase} backHref={backHref} />
    </PunkteProvider>
  );
}
