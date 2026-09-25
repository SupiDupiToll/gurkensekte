"use client";

import { useEffect, useState } from "react";
import { Trophy } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import { type LeaderboardDaten, type LeaderboardEintrag } from "@/lib/leaderboard";

const MEDAILLEN = ["🥇", "🥈", "🥉"];

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
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
        istDu
          ? "border-yellow-400/40 bg-yellow-400/5"
          : "border-transparent bg-gurken-800/20"
      }`}
    >
      <span
        className={`w-7 flex-shrink-0 text-center font-heading font-bold ${
          rang <= 3 ? "text-base" : "text-sm text-gurken-500"
        }`}
      >
        {rang <= 3 ? MEDAILLEN[rang - 1] : rang}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-gurken-200 uppercase tracking-wide">
        {/* Nur die ersten zwei Buchstaben – den vollen Namen zeigt die Rangliste bewusst nicht. */}
        {eintrag.name.trim().slice(0, 2)}
        {istDu && (
          <span className="ml-2 rounded border border-yellow-400/30 px-1 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-yellow-400">
            du
          </span>
        )}
      </span>
      <span className="flex-shrink-0 text-right leading-tight">
        <span className="block text-sm font-bold text-yellow-300">
          {zahl(eintrag.punkte)} Punkte
        </span>
      </span>
    </li>
  );
}

/**
 * Gurken-Rangliste in der Punkte-Sektion: zeigt die Top-Mitglieder nach den
 * normalen Punkten und heftet die eigene Position darunter fest an.
 */
export function Leaderboard() {
  const { leaderboardApiBase, punkte } = usePunkte();
  const [daten, setDaten] = useState<LeaderboardDaten | null>(null);
  const [fehler, setFehler] = useState(false);
  const [geladen, setGeladen] = useState(false);
  // Zähler, damit der Neuladen-Button denselben Effekt erneut anstößt.
  const [ladung, setLadung] = useState(0);

  // Nach jedem Punkte-Claim neu ziehen, damit der eigene Rang sofort stimmt.
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
    du !== null &&
    daten !== null &&
    daten.eintraege.some((e) => e.id === du.eintrag.id);

  return (
    <div className="mb-4 rounded-xl border border-gurken-500/10 bg-gurken-800/30 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Trophy size={18} weight="fill" className="text-yellow-400" />
        <h3 className="text-sm font-bold text-gurken-200">Gurken-Rangliste</h3>
        {daten && (
          <span className="ml-auto text-[11px] text-gurken-500">
            {zahl(daten.gesamt)} {daten.gesamt === 1 ? "Mitglied" : "Mitglieder"}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-gurken-500">
        Geranking nach den <strong className="text-gurken-400">normalen Punkten</strong>{" "}
        – bei Gleichstand gewinnt das ältere Mitglied. Wer eine echte Gurke
        einlöst, verliert 1000 Punkte und kann dafür rutschen.
      </p>

      {!geladen && (
        <div className="py-4 text-center">
          <SpinningCucumber size="text-2xl" />
        </div>
      )}

      {geladen && fehler && (
        <div className="py-3 text-center">
          <p className="text-xs text-gurken-400">
            Die Rangliste harrt hinter eingelegtem Glas – versuch es gleich noch
            einmal.
          </p>
          <button
            onClick={() => setLadung((n) => n + 1)}
            className="mt-2 rounded-lg border border-gurken-600/40 px-4 py-2 text-xs font-bold text-gurken-400 transition-all hover:border-gurken-500 hover:text-gurken-300 touch-manipulation"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {geladen && !fehler && daten && (
        <>
          <ul className="space-y-1.5">
            {daten.eintraege.map((eintrag, i) => (
              <RangZeile
                key={eintrag.id}
                eintrag={eintrag}
                rang={i + 1}
                istDu={du?.eintrag.id === eintrag.id}
              />
            ))}
            {daten.eintraege.length === 0 && (
              <li className="py-2 text-center text-xs text-gurken-500">
                Noch kein Mitglied gesammelt – du kannst die Rangliste eröffnen!
              </li>
            )}
          </ul>

          {du && !duInTop && (
            <div className="mt-2 border-t border-dashed border-gurken-500/20 pt-2">
              <RangZeile eintrag={du.eintrag} rang={du.rang} istDu />
            </div>
          )}
        </>
      )}
    </div>
  );
}
