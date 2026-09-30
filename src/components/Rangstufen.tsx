"use client";

import { useState } from "react";
import { Check, Lock, Medal } from "@phosphor-icons/react";
import { AppKachel } from "@/components/AppKachel";
import { Popup } from "@/components/Popup";
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
    <div className="rounded-2xl border border-[#c9a86a]/20 bg-[#c9a86a]/[0.05] px-5 py-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b7565]">
        Dein Rang
      </p>
      <p className="font-display mt-0.5 text-2xl font-semibold text-[#e2d9bf]">{titel}</p>
      <p className="tabular mt-0.5 text-xs text-[#a3ad9a]">
        {naechster ? (
          <>
            Noch <strong className="text-[#e2d9bf]">{zahl(naechster.fehlt)}</strong> Punkte bis{" "}
            <strong className="text-[#ede8d6]">{naechster.titel}</strong>
          </>
        ) : (
          <>Höchster Rang erreicht</>
        )}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-lg bg-white/[0.07]">
        <div
          className="h-full rounded-lg bg-[#8fa96d] transition-all duration-500"
          style={{ width: `${fortschritt}%` }}
        />
      </div>
    </div>
  );
}

export function Rangstufen() {
  const { punkte, loading } = usePunkte();
  const [open, setOpen] = useState(false);

  const aktuell = rangTitelFuer(punkte);
  const naechster = naechsterRang(punkte);

  if (!open) {
    return (
      <AppKachel
        icon={<Medal size={44} weight="fill" className="text-[#c9a86a]" />}
        titel="Ränge"
        hinweis={aktuell}
        index={3}
        onOpen={() => setOpen(true)}
      />
    );
  }

  return (
    <Popup
      titel="Rangzeichen"
      icon={<Medal size={22} weight="fill" className="text-[#c9a86a]" />}
      onClose={() => setOpen(false)}
    >
      {loading ? (
        <div className="space-y-2 py-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-10 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <p className="tabular mb-4 text-sm leading-relaxed text-[#a3ad9a]">
            Je mehr Punkte du sammelst, desto höher steigst du. Aktuell trägst du{" "}
            <strong className="text-[#e2d9bf]">{aktuell}</strong> mit{" "}
            <strong className="text-[#ede8d6]">{zahl(punkte)}</strong> Punkten.
          </p>

          <ol className="space-y-px overflow-hidden rounded-xl border border-white/[0.07]">
            {RANG_TITEL.map((stufe) => {
              const erreicht = punkte >= stufe.ab;
              const traegtMan = stufe.titel === aktuell;
              return (
                <li
                  key={stufe.titel}
                  className={`flex items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-0 ${
                    traegtMan ? "bg-[#c9a86a]/[0.07]" : erreicht ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                      erreicht ? "bg-[#8fa96d]/20 text-[#abc189]" : "bg-white/[0.05] text-[#6b7565]"
                    }`}
                  >
                    {erreicht ? <Check size={13} weight="bold" /> : <Lock size={12} weight="bold" />}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm font-medium ${
                      traegtMan ? "text-[#e2d9bf]" : erreicht ? "text-[#ede8d6]" : "text-[#6b7565]"
                    }`}
                  >
                    {stufe.titel}
                    {traegtMan && (
                      <span className="ml-2 rounded-lg border border-[#c9a86a]/30 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c9a86a]">
                        du
                      </span>
                    )}
                  </span>
                  <span
                    className={`tabular flex-shrink-0 text-right text-[11px] font-semibold ${
                      traegtMan ? "text-[#e2d9bf]" : "text-[#6b7565]"
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

          <div className="tabular mt-3 border-t border-dashed border-white/10 pt-3 text-xs text-[#a3ad9a]">
            {naechster ? (
              <>
                Noch <span className="font-semibold text-[#e2d9bf]">{zahl(naechster.fehlt)} Punkte</span>{" "}
                bis <strong className="text-[#ede8d6]">{naechster.titel}</strong>
              </>
            ) : (
              <span className="font-semibold text-[#e2d9bf]">Höchster Rang erreicht.</span>
            )}
          </div>
        </>
      )}
    </Popup>
  );
}
