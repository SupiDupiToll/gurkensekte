"use client";

import { useState, type ReactNode } from "react";
import { ArrowsInSimple } from "@phosphor-icons/react";

/**
 * Auf- und zuklappbare Casino-Sektion – derselbe Mechanismus wie die Karten
 * auf der Mitgliederseite (z. B. Punkte & Belohnungen): zugeklappt ein
 * Teaser zum Öffnen, aufgeklappt das Spiel plus Schließen-Knopf.
 */
export function CasinoSection({
  icon,
  titel,
  teaser,
  cta,
  children,
}: {
  icon: ReactNode;
  titel: string;
  teaser: string;
  cta: string;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState(false);

  if (!offen) {
    return (
      <div className="mb-8">
        <button
          onClick={() => setOffen(true)}
          className="relative w-full group overflow-hidden rounded-2xl border border-gurken-500/20 bg-gradient-to-br from-gurken-700/40 via-gurken-800/30 to-gurken-900/40 p-8 md:p-10 text-center transition-all duration-300 hover:border-gurken-400/40 hover:shadow-[0_0_40px_#22c55e33] hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#22c55e0a_0%,_transparent_70%)] group-hover:bg-[radial-gradient(ellipse_at_center,_#22c55e15_0%,_transparent_70%)] transition-all duration-500" />
          <div className="relative">
            <div className="text-6xl mb-4 flex justify-center">{icon}</div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-gurken-200 mb-2">
              {titel}
            </h2>
            <p className="text-gurken-400 text-sm md:text-base mb-6 max-w-md mx-auto">
              {teaser}
            </p>
            <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gurken-500 hover:bg-gurken-400 text-gurken-950 font-bold text-lg transition-all duration-200 shadow-[0_0_20px_#22c55e33] group-hover:shadow-[0_0_30px_#22c55e66]">
              {cta}
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-2 flex justify-end">
        <button
          onClick={() => setOffen(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-gurken-400 hover:text-gurken-200 hover:bg-gurken-800/50 text-sm font-bold transition-all touch-manipulation min-h-[44px]"
        >
          <ArrowsInSimple size={18} />
          Schließen
        </button>
      </div>
      {children}
    </div>
  );
}
