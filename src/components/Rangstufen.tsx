"use client";

import { Check, Lock, Medal } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  RANG_TITEL,
  naechsterRang,
  rangTitelFuer,
  rangstufeVon,
} from "@/lib/leaderboard";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

/**
 * Glühender Rang-Balken für den Kopfbereich des Dashboards: eigener Titel,
 * wie viele Punkte bis zur nächsten Stufe fehlen und ein Fortschrittsbalken.
 */
export function RangKopf() {
  const { punkte, loading } = usePunkte();
  if (loading) return null;

  const titel = rangTitelFuer(punkte);
  const naechster = naechsterRang(punkte);
  const von = rangstufeVon(punkte);
  const fortschritt = (() => {
    if (!naechster) return 100;
    const spanne = naechster.ab - von;
    if (spanne <= 0) return 100;
    return Math.min(((punkte - von) / spanne) * 100, 100);
  })();

  return (
    <div className="flex flex-col items-center rounded-xl border border-yellow-400/25 bg-yellow-400/5 px-5 py-4 text-center shadow-[0_0_25px_rgba(250,204,21,0.15)]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gurken-500">
        Dein Rang
      </span>
      <span className="font-heading text-xl font-bold text-yellow-300 [text-shadow:0_0_14px_rgba(250,204,21,0.55)]">
        {titel}
      </span>
      <span className="mt-0.5 text-[11px] text-gurken-400">
        {naechster ? (
          <>
            Noch{" "}
            <strong className="text-yellow-300">{zahl(naechster.fehlt)}</strong>{" "}
            Punkte bis{" "}
            <strong className="text-gurken-200">{naechster.titel}</strong>
          </>
        ) : (
          <>Höchster Rang erreicht 🏆</>
        )}
      </span>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gurken-800/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gurken-600 to-yellow-400 transition-all duration-500"
          style={{ width: `${fortschritt}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Übersichtskarte aller Rangzeichen: zeigt, welche Stufen bereits erreicht
 * sind, welche man gerade trägt und wie viele Punkte bis zur nächsten fehlen.
 * Steht als eigene Karte direkt im Mitgliederbereich – bewusst außerhalb von
 * „Punkte & Belohnungen“.
 */
export function Rangstufen() {
  const { punkte, loading } = usePunkte();
  if (loading) return null;

  const aktuell = rangTitelFuer(punkte);
  const naechster = naechsterRang(punkte);

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="mb-1 flex items-center gap-2">
        <Medal size={20} weight="fill" className="text-yellow-400" />
        <h2 className="text-xl font-heading font-bold text-gurken-200">
          🥒 Rangzeichen 🥒
        </h2>
        <span className="ml-auto text-xs text-gurken-500">
          {zahl(punkte)} Punkte
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-gurken-500">
        Je mehr Punkte du sammelst, desto höher steigst du – von Nano Gurke bis
        Extremst riesige Gurke.
      </p>

      <ol className="space-y-1.5">
        {RANG_TITEL.map((stufe) => {
          const erreicht = punkte >= stufe.ab;
          const traegtMan = stufe.titel === aktuell;
          return (
            <li
              key={stufe.titel}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                traegtMan
                  ? "border-yellow-400/40 bg-yellow-400/5"
                  : erreicht
                    ? "border-gurken-500/15 bg-gurken-800/20"
                    : "border-transparent bg-gurken-800/10"
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                  erreicht
                    ? "bg-gurken-500/20 text-gurken-300"
                    : "bg-gurken-800/60 text-gurken-600"
                }`}
              >
                {erreicht ? (
                  <Check size={13} weight="bold" />
                ) : (
                  <Lock size={12} weight="bold" />
                )}
              </span>

              <span
                className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                  traegtMan
                    ? "text-yellow-300"
                    : erreicht
                      ? "text-gurken-200"
                      : "text-gurken-500"
                }`}
              >
                {stufe.titel}
                {traegtMan && (
                  <span className="ml-2 rounded border border-yellow-400/30 px-1 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                    du
                  </span>
                )}
              </span>

              <span
                className={`flex-shrink-0 text-right text-[11px] font-bold ${
                  traegtMan
                    ? "text-yellow-300"
                    : erreicht
                      ? "text-gurken-500"
                      : "text-gurken-600"
                }`}
              >
                {traegtMan
                  ? `${zahl(punkte)} Punkte`
                  : erreicht
                    ? "erreicht"
                    : `ab ${zahl(stufe.ab)}`}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 border-t border-dashed border-gurken-500/20 pt-3 text-xs text-gurken-400">
        {naechster ? (
          <>
            Noch{" "}
            <span className="font-bold text-yellow-300">
              {zahl(naechster.fehlt)} Punkte
            </span>{" "}
            bis <strong className="text-gurken-200">{naechster.titel}</strong>
          </>
        ) : (
          <>
            <span className="font-bold text-yellow-300">
              Höchster Rang erreicht
            </span>{" "}
            – die Sekte verbeugt sich. 🏆
          </>
        )}
      </div>
    </div>
  );
}
