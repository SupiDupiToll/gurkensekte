"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Spinner } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  TurnstileWidget,
  turnstileKonfiguriert,
} from "@/components/TurnstileWidget";
import { CASINO_EINSAETZE, CASINO_MAX_VERLUST_FAKTOR } from "@/lib/casino";

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
 * nachziehen. Höchster Gewinn 3×, größter Verlust 3× – deshalb braucht jeder
 * Dreh den 3-fachen Einsatz als Puffer. Jeder Dreh braucht ein frisch
 * gelöstes Turnstile-Captcha (keine Sitzungswiederverwendung).
 */
export function Slotmaschine({ apiBase }: { apiBase: string }) {
  const { punkte, loading, refresh } = usePunkte();
  const [einsatz, setEinsatz] = useState<number>(CASINO_EINSAETZE[0]);
  const [rollen, setRollen] = useState<string[]>(["🫙", "🫙", "🫙"]);
  const [dreht, setDreht] = useState(false);
  const [ergebnis, setErgebnis] = useState<SpinErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [captchaPflicht, setCaptchaPflicht] = useState(turnstileKonfiguriert());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaHinweis, setCaptchaHinweis] = useState<string | null>(
    turnstileKonfiguriert() ? "Bitte löse kurz das Captcha, dann dreht der Automat." : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);
  const intervallRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Beim Verlassen der Seite die Walzen-Animation abschalten.
  useEffect(() => {
    return () => {
      if (intervallRef.current) clearInterval(intervallRef.current);
    };
  }, []);

  const puffer = einsatz * CASINO_MAX_VERLUST_FAKTOR;
  const pufferFehlt = punkte < puffer;

  async function drehen() {
    if (dreht || loading) return;
    if (pufferFehlt) {
      setFehler(
        `Für ${zahl(einsatz)} Punkte Einsatz brauchst du mindestens ${zahl(puffer)} Punkte Puffer – sammel erst ein paar.`,
      );
      return;
    }
    if (captchaPflicht && !turnstileToken) {
      setCaptchaHinweis("Bitte zuerst das Captcha lösen, dann darfst du drehen.");
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
          body: JSON.stringify({ einsatz, turnstileToken }),
          signal: controller.signal,
        }),
        // Mindestdauer, damit die Drehung auch wirklich sichtbar ist.
        new Promise((r) => setTimeout(r, 1200)),
      ]);

      if (res.status === 403) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          requiresTurnstile?: boolean;
        };
        if (data.requiresTurnstile) {
          setCaptchaPflicht(true);
          setTurnstileToken(null);
          setCaptchaReset((n) => n + 1);
          setCaptchaHinweis(
            "Captcha erforderlich – bitte erneut bestätigen, dann nochmal drehen.",
          );
          setFehler(null);
          await refresh();
          return;
        }
      }

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
      // Jeder Dreh kostet ein frisches Captcha: Widget für den nächsten
      // Dreh zurücksetzen (der Server akzeptiert keine Sitzung).
      setTurnstileToken(null);
      setCaptchaReset((n) => n + 1);
      setCaptchaHinweis("Für jeden Dreh bitte kurz das Captcha lösen.");
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

  const kannDrehen =
    !dreht && !loading && !pufferFehlt && (!captchaPflicht || turnstileToken);

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Coins size={22} weight="fill" className="text-[#c9a86a]" />
          <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
            Slotmaschine
          </h2>
        </div>
        <span className="tabular rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-[#e2d9bf]">
          {zahl(punkte)} Punkte
        </span>
      </div>

      {/* Walzen */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {rollen.map((symbol, i) => (
          <div
            key={i}
            className={`flex items-center justify-center rounded-lg border text-5xl md:text-6xl h-24 md:h-28 transition-all duration-300 ${
              ergebnis
                ? ergebnis.delta > 0
                  ? "border-[#c9a86a]/40 bg-[#c9a86a]/[0.07]"
                  : ergebnis.delta < 0
                    ? "border-red-500/30 bg-red-950/25"
                    : "border-white/10 bg-white/[0.03]"
                : "border-white/10 bg-white/[0.03]"
            } ${dreht ? "animate-pulse" : ""}`}
          >
            <span className={dreht ? "opacity-70 blur-[1px]" : ""}>{symbol}</span>
          </div>
        ))}
      </div>

      {/* Ergebnis */}
      {ergebnis && (
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-center ${
            ergebnis.delta > 0
              ? "border-[#c9a86a]/30 bg-[#c9a86a]/[0.07]"
              : ergebnis.delta < 0
                ? "border-red-500/25 bg-red-950/25"
                : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <p
            className={`tabular font-display text-lg font-semibold ${
              ergebnis.delta > 0
                ? "text-[#e2d9bf]"
                : ergebnis.delta < 0
                  ? "text-red-300"
                  : "text-[#ede8d6]"
            }`}
          >
            {ergebnis.delta > 0 ? "+" : ""}
            {zahl(ergebnis.delta)} Punkte
            <span className="ml-2 text-sm font-semibold opacity-70">
              ({ergebnis.faktor > 0 ? "+" : ""}
              {zahl(ergebnis.faktor)}× Einsatz)
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[#a3ad9a]">{ergebnis.label}</p>
        </div>
      )}

      {fehler && (
        <div className="mb-5 rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-3 text-center text-sm text-red-200">
          {fehler}
        </div>
      )}

      {/* Einsatz */}
      <div className="mb-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
          Einsatz (braucht 3× Puffer)
        </div>
        <div className="flex flex-wrap gap-2">
          {CASINO_EINSAETZE.map((wert) => {
            const braucht = wert * CASINO_MAX_VERLUST_FAKTOR;
            const reicht = punkte >= braucht;
            return (
              <button
                key={wert}
                onClick={() => setEinsatz(wert)}
                disabled={dreht}
                title={
                  reicht
                    ? `${zahl(wert)} Punkte Einsatz`
                    : `Braucht ${zahl(braucht)} Punkte Puffer`
                }
                className={`tabular min-h-[44px] rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all duration-300 active:scale-[0.97] disabled:opacity-50 ${
                  einsatz === wert
                    ? "border-transparent bg-[#ede8d6] text-[#0b120d]"
                    : "border-white/10 bg-white/[0.03] text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6]"
                } ${reicht ? "" : "opacity-60"}`}
              >
                {zahl(wert)}
              </button>
            );
          })}
        </div>
        {pufferFehlt && !loading && (
          <p className="mt-2 text-xs text-red-300">
            Für {zahl(einsatz)} Punkte Einsatz brauchst du mindestens{" "}
            {zahl(puffer)} Punkte – bis zu 3× kann verloren gehen.
          </p>
        )}
      </div>

      {/* Bot-Schutz */}
      {captchaPflicht && (
        <div className="mb-4">
          <TurnstileWidget
            resetKey={captchaReset}
            onVerify={(token) => {
              setTurnstileToken(token);
              setCaptchaHinweis(null);
            }}
            onExpire={() => {
              setTurnstileToken(null);
              setCaptchaHinweis("Captcha abgelaufen. Bitte erneut bestätigen.");
            }}
            onError={() => {
              setTurnstileToken(null);
              setCaptchaHinweis(
                "Captcha konnte nicht geladen werden. Bitte erneut versuchen.",
              );
            }}
          />
          {captchaHinweis && (
            <p className="mt-2 text-center text-xs text-[#a3ad9a]">
              {captchaHinweis}
            </p>
          )}
        </div>
      )}

      <button
        onClick={drehen}
        disabled={!kannDrehen}
        className="btn-cta btn-cta-primary min-h-[52px] w-full !text-base disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dreht ? (
          <>
            <Spinner size={20} weight="fill" className="animate-spin" />
            Dreht …
          </>
        ) : (
          <>Drehen für {zahl(einsatz)} Punkte</>
        )}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-[#6b7565]">
        Spielgeld-Regeln: höchstens <strong className="text-[#a3ad9a]">3×</strong>{" "}
        Gewinn, aber auch bis zu <strong className="text-[#a3ad9a]">3×</strong>{" "}
        Verlust. Für den Totalverlust brauchst du den 3-fachen Einsatz als
        Puffer auf dem Konto.
      </p>
    </div>
  );
}
