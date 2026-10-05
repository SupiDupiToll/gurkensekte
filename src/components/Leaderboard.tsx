"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  FLAMME_AB_STREAK,
  type LeaderboardDaten,
  type LeaderboardEintrag,
  rangTitelFuer,
} from "@/lib/leaderboard";

const MEDAILLEN = ["1", "2", "3"];

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

function RangZeile({
  eintrag,
  rang,
  istDu,
}: {
  eintrag: LeaderboardEintrag;
  rang: number;
  istDu: boolean;
}) {
  const streak =
    typeof eintrag.streak === "number" && Number.isFinite(eintrag.streak)
      ? Math.floor(eintrag.streak)
      : 0;
  const brennt = streak >= FLAMME_AB_STREAK;
  return (
    <li
      className={`flex items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-0 ${
        istDu ? "bg-[#c9a86a]/[0.06]" : ""
      }`}
    >
      <span
        className={`tabular flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-center font-display font-semibold ${
          rang <= 3
            ? "bg-[#c9a86a]/15 text-sm text-[#e2d9bf]"
            : "bg-white/[0.04] text-xs text-[#6b7565]"
        }`}
      >
        {rang <= 3 ? MEDAILLEN[rang - 1] : rang}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm uppercase tracking-[0.06em] text-[#ede8d6]">
        {eintrag.benutzername ? (
          <span className="normal-case tracking-normal">@{eintrag.benutzername}</span>
        ) : (
          eintrag.name.trim().slice(0, 2)
        )}
        {brennt && (
          <span
            className="ml-1.5 inline-flex align-middle text-[#e8933c]"
            title={`Serie: ${streak} Tage in Folge`}
            aria-label={`Serie: ${streak} Tage in Folge`}
          >
            <Flame size={15} weight="fill" />
          </span>
        )}
        <span
          className="ml-2 inline-block rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 align-middle text-[10px] font-semibold normal-case tracking-normal text-[#a3ad9a]"
          title={`${zahl(eintrag.punkte)} Punkte`}
        >
          {rangTitelFuer(eintrag.punkte)}
        </span>
        {istDu && (
          <span className="ml-2 rounded-lg border border-[#c9a86a]/30 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c9a86a]">
            du
          </span>
        )}
      </span>
      <span className="tabular block flex-shrink-0 text-sm font-semibold text-[#e2d9bf]">
        {zahl(eintrag.punkte)}
      </span>
    </li>
  );
}

export function Leaderboard() {
  const { leaderboardApiBase, punkte } = usePunkte();
  const [daten, setDaten] = useState<LeaderboardDaten | null>(null);
  const [fehler, setFehler] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [ladung, setLadung] = useState(0);

  useEffect(() => {
    let aktiv = true;
    fetch(leaderboardApiBase)
      .then((res) => {
        if (!res.ok) throw new Error("Rangliste nicht erreichbar");
        return res.json() as Promise<LeaderboardDaten>;
      })
      .then((data) => {
        if (!aktiv) return;
        setDaten(data);
        setFehler(false);
      })
      .catch(() => {
        if (aktiv) setFehler(true);
      })
      .finally(() => {
        if (aktiv) setGeladen(true);
      });
    return () => {
      aktiv = false;
    };
  }, [leaderboardApiBase, punkte, ladung]);

  const du = daten?.du ?? null;
  const duInTop =
    du !== null && daten !== null && daten.eintraege.some((e) => e.id === du.eintrag.id);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-1 flex items-center gap-2">
        <Trophy size={17} weight="fill" className="text-[#c9a86a]" />
        <h3 className="text-sm font-semibold text-[#ede8d6]">Gurken-Rangliste</h3>
        {daten && (
          <span className="tabular ml-auto text-[11px] text-[#6b7565]">
            {zahl(daten.gesamt)} {daten.gesamt === 1 ? "Mitglied" : "Mitglieder"}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs leading-relaxed text-[#6b7565]">
        Nach je gesammelten XP sortiert, bei Gleichstand gewinnt das ältere
        Mitglied. Wer eine echte Gurke einlöst, behält seinen Rang. Flamme =
        Serie ab {FLAMME_AB_STREAK} Tagen.
      </p>

      {!geladen && (
        <div className="space-y-2 py-1" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-11 rounded-xl" />
          ))}
        </div>
      )}

      {geladen && fehler && (
        <div className="py-3 text-center">
          <p className="text-xs text-[#a3ad9a]">
            Die Rangliste harrt hinter eingelegtem Glas. Versuch es gleich noch einmal.
          </p>
          <button
            onClick={() => setLadung((n) => n + 1)}
            className="mt-2 rounded-lg border border-white/12 px-4 py-2 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {geladen && !fehler && daten && (
        <>
          <ul className="overflow-hidden rounded-xl border border-white/[0.07]">
            {daten.eintraege.map((eintrag, i) => (
              <RangZeile key={eintrag.id} eintrag={eintrag} rang={i + 1} istDu={du?.eintrag.id === eintrag.id} />
            ))}
            {daten.eintraege.length === 0 && (
              <li className="py-3 text-center text-xs text-[#6b7565]">
                Noch kein Mitglied gesammelt. Du kannst die Rangliste eröffnen.
              </li>
            )}
          </ul>

          {du && !duInTop && (
            <div className="mt-2 border-t border-dashed border-white/10 pt-2">
              <ul className="overflow-hidden rounded-xl border border-[#c9a86a]/25">
                <RangZeile eintrag={du.eintrag} rang={du.rang} istDu />
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
