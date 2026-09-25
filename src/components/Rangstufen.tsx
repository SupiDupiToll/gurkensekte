"use client";

import { useState } from "react";
import { ArrowsInSimple, Check, Lock, Medal } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import { SpinningCucumber } from "@/components/SpinningCucumber";
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
 * Eingeklappte Karte aller Rangzeichen – im selben Stil wie „Punkte &
 * Belohnungen“ und „Chat mit Gürkchen“: zuklappen, Inhalt aufklappen.
 * Bewusst eine eigene Karte außerhalb von „Punkte & Belohnungen“.
 */
export function Rangstufen() {
  const { punkte, loading } = usePunkte();
  const [open, setOpen] = useState(false);

  const aktuell = rangTitelFuer(punkte);
  const naechster = naechsterRang(punkte);

  if (!open) {
    return (
      <div className="mb-8">
        <button
          onClick={() => setOpen(true)}
          className="relative w-full group overflow-hidden rounded-2xl border border-gurken-500/20 bg-gradient-to-br from-gurken-700/40 via-gurken-800/30 to-gurken-900/40 p-8 md:p-10 text-center transition-all duration-300 hover:border-yellow-400/40 hover:shadow-[0_0_40px_rgba(250,204,21,0.2)] hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#facc150a_0%,_transparent_70%)] group-hover:bg-[radial-gradient(ellipse_at_center,_#facc151f_0%,_transparent_70%)] transition-all duration-500" />
          <div className="relative">
            <div className="text-6xl mb-4">
              <Medal size={56} weight="fill" className="text-yellow-400 mx-auto" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-gurken-200 mb-2">
              🥒 Rangzeichen 🥒
            </h2>
            <p className="text-gurken-400 text-sm md:text-base mb-4 max-w-md mx-auto">
              Von Nano Gurke bis Extremst riesige Gurke – sieh alle Stufen, deine
              aktuelle und wie viele Punkte dir bis zur nächsten fehlen.
            </p>
            {!loading && (
              <p className="mb-6 text-sm text-gurken-500">
                Dein Rang:{" "}
                <strong className="text-yellow-300">{aktuell}</strong>
              </p>
            )}
            <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gurken-950 font-bold text-lg transition-all duration-200 shadow-[0_0_20px_rgba(250,204,21,0.3)] group-hover:shadow-[0_0_30px_rgba(250,204,21,0.5)]">
              <Medal size={22} weight="fill" />
              Ränge anzeigen
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Medal size={24} weight="fill" className="text-yellow-400" />
          <h2 className="text-xl font-heading font-bold text-gurken-200">
            🥒 Rangzeichen 🥒
          </h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-gurken-400 hover:text-gurken-200 hover:bg-gurken-800/50 text-sm font-bold transition-all touch-manipulation min-h-[44px]"
        >
          <ArrowsInSimple size={18} />
          Schließen
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <SpinningCucumber size="text-3xl" />
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm leading-relaxed text-gurken-500">
            Je mehr Punkte du sammelst, desto höher steigst du – von Nano Gurke
            bis Extremst riesige Gurke. Aktuell trägst du{" "}
            <strong className="text-yellow-300">{aktuell}</strong> mit{" "}
            <strong className="text-gurken-300">{zahl(punkte)}</strong> Punkten.
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
                bis{" "}
                <strong className="text-gurken-200">{naechster.titel}</strong>
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
        </>
      )}
    </div>
  );
}
