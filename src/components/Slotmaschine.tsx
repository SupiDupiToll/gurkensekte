"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Spinner } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import { CASINO_EINSAETZE } from "@/lib/casino";

type SpinErgebnis = {
  einsatz: number;
  faktor: number;
  delta: number;
  label: string;
  symbole: string[];
  punkte: number;
  punkteGesamt: number;
};

/** Symbole, die während der Drehung durchlaufen. */
const DREH_SYMBOLE = ["🥒", "🫙", "💧", "💥", "🫠", "✨", "🍀"];

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

/**
 * Spielbare Slotmaschine des Gurken Casinos: Einsatz wählen, Walzen drehen
 * lassen, serverseitiges Ergebnis anzeigen und die Punkte per refresh()
 * nachziehen. Höchster Gewinn 3×, größter Verlust 1×.
 */
export function Slotmaschine({ apiBase }: { apiBase: string }) {
  const { punkte, loading, refresh } = usePunkte();
  const [einsatz, setEinsatz] = useState<number>(CASINO_EINSAETZE[0]);
  const [rollen, setRollen] = useState<string[]>(["🫙", "🫙", "🫙"]);
  const [dreht, setDreht] = useState(false);
  const [ergebnis, setErgebnis] = useState<SpinErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const intervallRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Beim Verlassen der Seite die Walzen-Animation abschalten.
  useEffect(() => {
    return () => {
      if (intervallRef.current) clearInterval(intervallRef.current);
    };
  }, []);

  async function drehen() {
    if (dreht || loading) return;
    if (punkte < einsatz) {
      setFehler("Nicht genug Punkte für diesen Einsatz – sammel erst ein paar.");
      return;
    }

    setDreht(true);
    setFehler(null);
    setErgebnis(null);

    intervallRef.current = setInterval(() => {
      setRollen(() =>
        DREH_SYMBOLE.slice().sort(() => Math.random() - 0.5).slice(0, 3),
      );
    }, 90);

    // Der Wurf passiert ausschließlich serverseitig: Kommt keine saubere
    // Antwort an, wird nichts gebucht und keine Bewegung angezeigt.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const [res] = await Promise.all([
        fetch(`${apiBase}/casino`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ einsatz }),
          signal: controller.signal,
        }),
        // Mindestdauer, damit die Drehung auch wirklich sichtbar ist.
        new Promise((r) => setTimeout(r, 1200)),
      ]);

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFehler(
          (data.error ?? `Der Automat meldet Fehler ${res.status}`) +
            " – es wurden keine Punkte abgezogen oder vergeben.",
        );
        await refresh();
        return;
      }

      const data = (await res.json()) as SpinErgebnis;
      setRollen(data.symbole);
      setErgebnis(data);
      await refresh();
    } catch {
      setFehler(
        controller.signal.aborted
          ? "Der Automat meldet sich nicht – es wurden keine Punkte abgezogen oder vergeben."
          : "Der Automat ist außer Betrieb – es wurden keine Punkte abgezogen oder vergeben.",
      );
      // Serverstand nachziehen, damit die Anzeige immer dem Konto entspricht.
      await refresh();
    } finally {
      clearTimeout(timeout);
      if (intervallRef.current) clearInterval(intervallRef.current);
      intervallRef.current = null;
      setDreht(false);
    }
  }

  const kannDrehen = !dreht && !loading && punkte >= einsatz;

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Coins size={24} weight="fill" className="text-yellow-400" />
          <h2 className="text-xl font-heading font-bold text-gurken-200">
            🎰 Slotmaschine
          </h2>
        </div>
        <span className="rounded-lg border border-yellow-400/25 bg-yellow-400/5 px-3 py-1.5 text-sm font-bold text-yellow-300">
          {zahl(punkte)} Punkte
        </span>
      </div>

      {/* Walzen */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {rollen.map((symbol, i) => (
          <div
            key={i}
            className={`flex items-center justify-center rounded-2xl border text-5xl md:text-6xl h-24 md:h-28 transition-all duration-300 ${
              ergebnis
                ? ergebnis.delta > 0
                  ? "border-yellow-400/50 bg-yellow-400/10 shadow-[0_0_25px_rgba(250,204,21,0.25)]"
                  : ergebnis.delta < 0
                    ? "border-red-500/40 bg-red-950/30"
                    : "border-gurken-500/30 bg-gurken-800/40"
                : "border-gurken-500/20 bg-gurken-800/40"
            } ${dreht ? "animate-pulse" : ""}`}
          >
            <span className={dreht ? "opacity-70 blur-[1px]" : ""}>{symbol}</span>
          </div>
        ))}
      </div>

      {/* Ergebnis */}
      {ergebnis && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-center ${
            ergebnis.delta > 0
              ? "border-yellow-400/40 bg-yellow-400/10"
              : ergebnis.delta < 0
                ? "border-red-500/30 bg-red-950/30"
                : "border-gurken-500/20 bg-gurken-800/40"
          }`}
        >
          <p
            className={`font-heading text-lg font-bold ${
              ergebnis.delta > 0
                ? "text-yellow-300"
                : ergebnis.delta < 0
                  ? "text-red-300"
                  : "text-gurken-300"
            }`}
          >
            {ergebnis.delta > 0 ? "+" : ""}
            {zahl(ergebnis.delta)} Punkte
            <span className="ml-2 text-sm font-semibold opacity-80">
              ({ergebnis.faktor > 0 ? "+" : ""}
              {zahl(ergebnis.faktor)}× Einsatz)
            </span>
          </p>
          <p className="mt-0.5 text-xs text-gurken-400">{ergebnis.label}</p>
        </div>
      )}

      {fehler && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-center text-sm text-red-200">
          {fehler}
        </div>
      )}

      {/* Einsatz */}
      <div className="mb-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-gurken-500">
          Einsatz
        </div>
        <div className="flex flex-wrap gap-2">
          {CASINO_EINSAETZE.map((wert) => (
            <button
              key={wert}
              onClick={() => setEinsatz(wert)}
              disabled={dreht}
              className={`min-h-[44px] rounded-xl border px-5 py-2.5 text-sm font-bold transition-all touch-manipulation disabled:opacity-50 ${
                einsatz === wert
                  ? "border-yellow-400/50 bg-yellow-400/15 text-yellow-300"
                  : "border-gurken-500/20 bg-gurken-800/40 text-gurken-400 hover:border-gurken-500 hover:text-gurken-300"
              }`}
            >
              {zahl(wert)} Punkte
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={drehen}
        disabled={!kannDrehen}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-4 font-bold text-gurken-950 transition-all duration-200 hover:bg-yellow-300 hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-0 touch-manipulation min-h-[52px] text-base"
      >
        {dreht ? (
          <>
            <Spinner size={20} weight="fill" className="animate-spin" />
            Dreht…
          </>
        ) : (
          <>🎰 Drehen für {zahl(einsatz)} Punkte</>
        )}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-gurken-500">
        Spielgeld-Regeln: höchstens <strong className="text-gurken-400">3×</strong>{" "}
        Gewinn, aber auch bis zu <strong className="text-gurken-400">1×</strong>{" "}
        Verlust. Einsatz brauchst du wirklich auf dem Konto.
      </p>
    </div>
  );
}
