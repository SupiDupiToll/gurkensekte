"use client";

import Link from "next/link";
import { ArrowLeft, DiceFive, Cards } from "@phosphor-icons/react";
import { PunkteProvider, usePunkte } from "@/components/PunkteContext";
import { Slotmaschine } from "@/components/Slotmaschine";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

/** Der eigentliche Casino-Inhalt – liegt immer in einem PunkteProvider. */
function CasinoInhalt({
  apiBase,
  backHref,
}: {
  apiBase: string;
  backHref: string;
}) {
  const { punkte, loading } = usePunkte();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-24 relative pb-safe">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-gurken-500 hover:text-gurken-400 text-sm font-bold transition-all"
      >
        <ArrowLeft size={16} />
        Zurück zum Mitgliederbereich
      </Link>

      <div className="mt-6 mb-8 text-center">
        <DiceFive size={56} weight="fill" className="text-yellow-400 mx-auto" />
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-gurken-300 mt-4">
          🥒 Gurken Casino 🥒
        </h1>
        <p className="mt-2 text-sm md:text-base text-gurken-400 max-w-md mx-auto">
          Reines Spielgeld: hier wird mit deinen Punkten gezockt, niemals mit
          echtem Geld. Der Automat entscheidet, nicht dein Bauchgefühl.
        </p>
      </div>

      {/* Glühendes Guthaben */}
      <div className="mb-6 flex justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-yellow-400/25 bg-yellow-400/5 px-5 py-3 shadow-[0_0_25px_rgba(250,204,21,0.15)]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gurken-500">
            Dein Guthaben
          </span>
          <span className="font-heading text-xl font-bold text-yellow-300 [text-shadow:0_0_14px_rgba(250,204,21,0.55)]">
            {loading ? "…" : zahl(punkte)}
          </span>
          <span className="text-sm text-gurken-400">Punkte</span>
        </div>
      </div>

      <Slotmaschine apiBase={apiBase} />

      {/* Weitere Spiele */}
      <div className="card p-6 md:p-8 mb-8">
        <div className="mb-1 flex items-center gap-2">
          <Cards size={20} weight="fill" className="text-gurken-400" />
          <h2 className="text-xl font-heading font-bold text-gurken-200">
            🎲 Mehr im Casino 🎲
          </h2>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-gurken-500">
          Die Slotmaschine ist das erste Spiel – weitere Automaten sind bereits
          in der Werkstatt der Sekte.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-gurken-500/15 bg-gurken-800/20 px-4 py-3">
            <span className="text-sm font-semibold text-gurken-400">
              🎲 Gurken-Würfel
            </span>
            <span className="rounded border border-gurken-500/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gurken-500">
              bald
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gurken-500/15 bg-gurken-800/20 px-4 py-3">
            <span className="text-sm font-semibold text-gurken-400">
              🃏 Gurken-Poker
            </span>
            <span className="rounded border border-gurken-500/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gurken-500">
              bald
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hülle der Casino-Seite: liefert den PunkteProvider, damit Guthaben und
 * Slotmaschine denselben Stand sehen wie der Mitgliederbereich.
 */
export function CasinoPage({
  punkteApiBase,
  backHref,
}: {
  punkteApiBase: string;
  backHref: string;
}) {
  return (
    <PunkteProvider apiBase={punkteApiBase}>
      <CasinoInhalt apiBase={punkteApiBase} backHref={backHref} />
    </PunkteProvider>
  );
}
