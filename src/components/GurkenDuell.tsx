"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  DiceFive,
  Flag,
  Plus,
  Spinner,
  Sword,
  Timer,
} from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  TurnstileWidget,
  turnstileKonfiguriert,
} from "@/components/TurnstileWidget";
import {
  DUELL_EINSAETZE,
  type OeffentlichesDuell,
} from "@/lib/duell";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

const SYMBOL_EMOJI: Record<string, string> = { X: "🥒", O: "🫙" };

/** Spieler-Chip im Versus-Kopf: Name, Stein, Zug-Punkt. */
function SpielerChip({
  name,
  emoji,
  symbol,
  aktiv,
  ich,
  offen,
}: {
  name: string;
  emoji: string;
  symbol: string;
  aktiv: boolean;
  ich?: boolean;
  offen?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 transition-[border-color,background-color] duration-200 ease-out ${
        offen
          ? "border-dashed border-white/15 bg-transparent"
          : aktiv
            ? "border-[#8fa96d]/50 bg-[#8fa96d]/[0.07]"
            : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <span className="text-xl leading-none" aria-hidden="true">
        {emoji}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#ede8d6]">
        {name}
        {ich && (
          <span className="ml-1.5 text-[11px] font-medium text-[#6b7565]">
            Du
          </span>
        )}
      </span>
      <span className="tabular text-[11px] font-bold text-[#6b7565]">
        {symbol}
      </span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          aktiv ? "animate-pulse bg-[#8fa96d]" : "bg-white/10"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

type ApiAntwort =
  | { ok: true; session: OeffentlichesDuell }
  | { ok: false; error: string; requiresTurnstile?: boolean; keinGegner?: boolean };

/**
 * Gurken Duell – P2P-Tic-Tac-Toe um Punkte-Einsätze.
 *
 * Ablauf: Einsatz wählen, Duell per Code erstellen oder Zufallsgegner suchen
 * (oder fremden Code eingeben), spielen, Pot abholen. Der Server ist
 * Autorität für Brett und Sieg; der Stand wird per Polling (2 s) nachgezogen.
 */
export function GurkenDuell({ duellApiBase }: { duellApiBase: string }) {
  const { punkte, loading, refresh } = usePunkte();
  const [session, setSession] = useState<OeffentlichesDuell | null>(null);
  const [einsatz, setEinsatz] = useState<number>(DUELL_EINSAETZE[0]);
  const [name, setName] = useState("");
  const [codeEingabe, setCodeEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [captchaPflicht, setCaptchaPflicht] = useState(turnstileKonfiguriert());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaHinweis, setCaptchaHinweis] = useState<string | null>(
    turnstileKonfiguriert() ? "Bitte löse kurz das Captcha fürs Duell." : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);
  const [codeKopiert, setCodeKopiert] = useState(false);
  const speicherKey = `gurken-duell:${duellApiBase}`;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Offene Session-ID synchron aus dem Browser-Speicher lesen (kein Effect
  // nötig – reines Auslesen, kein setState).
  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(speicherKey),
  );

  async function api(
    aktion: string,
    extra: Record<string, unknown> = {},
  ): Promise<ApiAntwort> {
    try {
      const res = await fetch(duellApiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion, turnstileToken, ...extra }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        session?: OeffentlichesDuell;
        error?: string;
        requiresTurnstile?: boolean;
        code?: string;
      };
      if (res.status === 403 && data.requiresTurnstile) {
        setCaptchaPflicht(true);
        setTurnstileToken(null);
        setCaptchaReset((n) => n + 1);
        setCaptchaHinweis("Captcha erforderlich – bitte erneut bestätigen.");
        return { ok: false, error: data.error ?? "Captcha erforderlich", requiresTurnstile: true };
      }
      if (!res.ok || !data.session) {
        return {
          ok: false,
          error: data.error ?? `Fehler ${res.status}`,
          keinGegner: data.code === "KEIN_GEGNER",
        };
      }
      return { ok: true, session: data.session };
    } catch {
      return { ok: false, error: "Der Server meldet sich nicht – bitte erneut versuchen." };
    }
  }

  // Gespeichertes Duell beim Öffnen fortsetzen + Live-Polling alle 2 s.
  // Der Stand landet per nativem fetch-Promise im State (async, kein
  // synchrones setState im Effect) und wird danach per Intervall frisch
  // gehalten, solange gespielt oder gewartet wird.
  useEffect(() => {
    if (!sessionId) return;
    let aktiv = true;
    fetch(`${duellApiBase}?id=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!aktiv) return null;
        if (res.status === 404) return null;
        if (!res.ok) return undefined;
        return res.json() as Promise<{ session: OeffentlichesDuell }>;
      })
      .then((data) => {
        if (!aktiv || data === undefined) return;
        if (data === null) {
          window.localStorage.removeItem(speicherKey);
          setSessionId(null);
          return;
        }
        setSession(data.session);
      })
      .catch(() => {
        // Offline o. ä. – beim nächsten Öffnen erneut versuchen.
      });
    return () => {
      aktiv = false;
    };
  }, [duellApiBase, speicherKey, sessionId]);

  const sessionStatus = session?.status;
  const sessionKennung = session?.id;
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (!sessionKennung || (sessionStatus !== "playing" && sessionStatus !== "waiting")) return;
    pollRef.current = setInterval(() => {
      fetch(`${duellApiBase}?id=${encodeURIComponent(sessionKennung)}`)
        .then((res) => {
          if (res.status === 404) return null;
          if (!res.ok) return undefined;
          return res.json() as Promise<{ session: OeffentlichesDuell }>;
        })
        .then((data) => {
          if (data === undefined) return;
          if (data === null) {
            setSession(null);
            setSessionId(null);
            window.localStorage.removeItem(speicherKey);
            setFehler("Dieses Duell gibt es nicht mehr.");
            return;
          }
          setSession(data.session);
        })
        .catch(() => {
          // Einzelner Poll darf nie die Anzeige zerlegen.
        });
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [sessionKennung, sessionStatus, duellApiBase, speicherKey]);

  function merkeSession(s: OeffentlichesDuell) {
    setSession(s);
    setSessionId(s.id);
    window.localStorage.setItem(speicherKey, s.id);
  }

  function neuesDuell() {
    setSession(null);
    setSessionId(null);
    setFehler(null);
    setHinweis(null);
    window.localStorage.removeItem(speicherKey);
  }

  async function mitBusy(
    schluessel: string,
    arbeit: () => Promise<ApiAntwort>,
    geldAenderung = false,
  ) {
    if (busy) return;
    if ((schluessel === "create" || schluessel.startsWith("join")) && captchaPflicht && !turnstileToken) {
      setFehler("Bitte zuerst das Captcha lösen.");
      return;
    }
    setBusy(schluessel);
    setFehler(null);
    setHinweis(null);
    const antwort = await arbeit();
    if (antwort.ok) {
      merkeSession(antwort.session);
      if (geldAenderung) await refresh();
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
      if (antwort.keinGegner) {
        setHinweis("Tipp: Erstelle selbst ein Duell und schicke den Code an deine Gegnerin – oder warte kurz und versuche den Zufall erneut.");
      }
    }
    setBusy(null);
  }

  function beitretenPerCode() {
    if (codeEingabe.trim().length !== 6 || busy || loading) return;
    mitBusy("join-code", () => api("join-code", { code: codeEingabe, name }), true);
  }

  async function codeKopieren() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.code);
      setCodeKopiert(true);
      setTimeout(() => setCodeKopiert(false), 2000);
    } catch {
      // Zwischenablage blockiert – Code steht ja lesbar da.
    }
  }

  const reichtEinsatz = punkte >= einsatz;

  // ---------- Lobby ----------
  if (!session) {
    return (
      <div className="card mb-8 p-6 md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sword size={22} weight="fill" className="text-[#c9a86a]" />
            <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
              Tic Tac Toe Duell
            </h2>
          </div>
          <span className="tabular rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-[#e2d9bf]">
            {loading ? "…" : `${zahl(punkte)} Punkte`}
          </span>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-[#a3ad9a]">
          Fordere ein anderes Mitglied heraus: Beide setzen denselben Einsatz,
          der Sieger kassiert den ganzen Pot (2× Einsatz). Bei Unentschieden
          bekommt jeder seinen Einsatz zurück.
        </p>

        <div className="mb-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
            Einsatz pro Spieler (Pot: 2×)
          </div>
          <div className="flex flex-wrap gap-2">
            {DUELL_EINSAETZE.map((wert) => (
              <button
                key={wert}
                onClick={() => setEinsatz(wert)}
                disabled={!!busy}
                className={`tabular min-h-[44px] rounded-lg border px-5 py-2.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-200 ease-out active:scale-[0.97] disabled:opacity-50 ${
                  einsatz === wert
                    ? "border-transparent bg-[#ede8d6] text-[#0b120d]"
                    : "border-white/10 bg-white/[0.03] text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6]"
                }`}
              >
                {zahl(wert)} <span className="opacity-60">→ Pot {zahl(wert * 2)}</span>
              </button>
            ))}
          </div>
          {!reichtEinsatz && !loading && (
            <p className="mt-2 text-xs text-red-300">
              Für {zahl(einsatz)} Punkte Einsatz brauchst du mindestens {zahl(einsatz)} Punkte auf dem Konto.
            </p>
          )}
        </div>

        <label className="mb-4 block text-xs font-semibold text-[#a3ad9a]">
          Dein Kampf-Name (optional)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Gurkenkönig"
            maxLength={24}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d]"
          />
        </label>

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
                setCaptchaHinweis("Captcha konnte nicht geladen werden. Bitte erneut versuchen.");
              }}
            />
            {captchaHinweis && (
              <p className="mt-2 text-center text-xs text-[#a3ad9a]">{captchaHinweis}</p>
            )}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => mitBusy("create", () => api("create", { stake: einsatz, name }), true)}
            disabled={!!busy || loading || !reichtEinsatz}
            className="btn-cta btn-cta-primary min-h-[52px] !text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "create" ? <Spinner size={20} className="animate-spin" /> : <Plus size={18} weight="bold" />}
            Code erstellen
          </button>
          <button
            onClick={() => mitBusy("join-random", () => api("join-random", { stake: einsatz, name }), true)}
            disabled={!!busy || loading || !reichtEinsatz}
            className="btn-cta btn-cta-secondary min-h-[52px] !text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "join-random" ? <Spinner size={20} className="animate-spin" /> : <DiceFive size={20} weight="fill" />}
            Zufallsgegner
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
          <span className="h-px flex-1 bg-white/10" />
          oder Code einlösen
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={codeEingabe}
            onChange={(e) => setCodeEingabe(e.target.value.toUpperCase())}
            placeholder="z. B. Q7KX2P"
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === "Enter") beitretenPerCode();
            }}
            className="tabular min-h-[52px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-lg font-bold tracking-[0.2em] text-[#ede8d6] placeholder-[#6b7565]/50 outline-none transition-colors focus:border-[#8fa96d]"
          />
          <button
            onClick={beitretenPerCode}
            disabled={!!busy || loading || codeEingabe.trim().length !== 6}
            className="btn-cta btn-cta-primary min-h-[52px] px-6 !text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "join-code" ? <Spinner size={20} className="animate-spin" /> : "Beitreten"}
          </button>
        </div>

        {fehler && (
          <div className="mt-5 rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-3 text-center text-sm text-red-200">
            {fehler}
          </div>
        )}
        {hinweis && <p className="mt-3 text-center text-xs text-[#a3ad9a]">{hinweis}</p>}

        <p className="mt-4 text-center text-xs leading-relaxed text-[#6b7565]">
          Spielgeld-Regeln: Der Einsatz wird beim Erstellen/Beitreten sofort
          abgezogen. Sieg holt den Pot ({zahl(einsatz * 2)}), Niederlage
          verliert den Einsatz, Unentschieden erstattet ihn. Offene Duelle
          verfallen nach 10 Minuten (Einsatz zurückholbar).
        </p>
      </div>
    );
  }

  // ---------- Session ----------
  const ichBinDran = session.status === "playing" && session.meinSymbol === session.amZug;
  const gegner = session.spieler.find((s) => !s.ich);
  const meinEintrag = session.spieler.find((s) => s.ich);
  const ichSymbol = session.meinSymbol;

  let statusText: string;
  let statusKlasse = "text-[#ede8d6]";
  if (session.status === "waiting") {
    statusText = "Warte auf Gegner …";
    statusKlasse = "text-[#c9a86a]";
  } else if (session.status === "playing") {
    if (!ichSymbol) {
      statusText = "Du schaust nur zu.";
    } else if (ichBinDran) {
      statusText = "Du bist am Zug!";
      statusKlasse = "text-[#8fa96d]";
    } else {
      statusText = `${gegner?.name ?? "Gegner"} ist am Zug …`;
    }
  } else if (session.status === "finished") {
    if (session.gewinner === "draw") {
      statusText = "Unentschieden!";
    } else if (session.gewinner === ichSymbol) {
      statusText = "Gewonnen! Der Pot gehört dir.";
      statusKlasse = "text-[#8fa96d]";
    } else {
      statusText = `${gegner?.name ?? "Gegner"} hat gewonnen.`;
      statusKlasse = "text-red-300";
    }
  } else if (session.status === "cancelled") {
    statusText = "Duell storniert.";
  } else {
    statusText = "Duell abgelaufen.";
  }

  return (
    <div className="card mb-8 p-6 md:p-8">
      <div className="mb-4 flex items-center gap-2">
        {meinEintrag ? (
          <SpielerChip
            name={meinEintrag.name}
            emoji={SYMBOL_EMOJI[meinEintrag.symbol] ?? ""}
            symbol={meinEintrag.symbol}
            aktiv={session.status === "playing" && session.amZug === meinEintrag.symbol}
            ich
          />
        ) : (
          <SpielerChip name="Zuschauer" emoji="👁" symbol="–" aktiv={false} />
        )}
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4a5548]">
          vs
        </span>
        {gegner ? (
          <SpielerChip
            name={gegner.name}
            emoji={SYMBOL_EMOJI[gegner.symbol] ?? ""}
            symbol={gegner.symbol}
            aktiv={session.status === "playing" && session.amZug === gegner.symbol}
          />
        ) : (
          <SpielerChip name="Noch offen" emoji="…" symbol="?" aktiv={false} offen />
        )}
      </div>

      <p
        aria-live="polite"
        className={`mb-1 flex items-center justify-center gap-2 text-center text-sm font-semibold ${statusKlasse}`}
      >
        {(session.status === "playing" || session.status === "waiting") && (
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${
              session.status === "waiting" ? "bg-[#c9a86a]" : "bg-[#8fa96d]"
            }`}
            aria-hidden="true"
          />
        )}
        {statusText}
      </p>
      <p className="tabular mb-5 text-center text-xs text-[#6b7565]">
        Einsatz {zahl(session.stake)} ·{" "}
        <span className="font-semibold text-[#e2d9bf]">Pot {zahl(session.pot)}</span>{" "}
        · Code {session.code}
      </p>

      {session.status === "waiting" && (
        <div className="mb-5 rounded-xl border border-[#c9a86a]/30 bg-[#c9a86a]/[0.06] p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
            Einladungs-Code teilen
          </p>
          <p className="tabular font-display mt-1 text-4xl font-bold tracking-[0.18em] text-[#ede8d6]">
            {session.code}
          </p>
          <button
            onClick={codeKopieren}
            className="mx-auto mt-2 flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-1.5 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            {codeKopiert ? <Check size={14} /> : <Copy size={14} />}
            {codeKopiert ? "Kopiert!" : "Code kopieren"}
          </button>
        </div>
      )}

      <div className="mx-auto mb-5 grid max-w-[320px] grid-cols-3 gap-2">
        {session.board.map((zelle, i) => {
          const inLinie = session.gewinnLinie?.includes(i) ?? false;
          const letzter = session.letzterZug === i && !inLinie;
          const klickbar = ichBinDran && !zelle && !busy;
          return (
            <button
              key={i}
              onClick={() => mitBusy(`move-${i}`, () => api("move", { sessionId: session.id, index: i }))}
              disabled={!klickbar}
              aria-label={`Feld ${i + 1}${zelle ? `, belegt mit ${zelle}` : ""}`}
              style={{ animationDelay: `${i * 35}ms` }}
              className={`duell-zelle-enter flex h-20 items-center justify-center rounded-xl border text-4xl transition-[transform,background-color,border-color] duration-200 ease-out md:h-24 ${
                inLinie
                  ? "border-[#8fa96d]/60 bg-[#8fa96d]/[0.12]"
                  : zelle
                    ? letzter
                      ? "border-[#abc189]/50 bg-white/[0.05]"
                      : "border-white/10 bg-white/[0.04]"
                    : klickbar
                      ? "border-white/15 bg-white/[0.03] hover:border-[#8fa96d]/50 hover:bg-[#8fa96d]/[0.06] active:scale-[0.97]"
                      : "border-white/10 bg-white/[0.02]"
              } ${klickbar ? "cursor-pointer" : "cursor-default"}`}
            >
              {/* Key-Wechsel bei neuem Stein: Der Span mountet neu und der
                  Pop spielt genau einmal – Polling-Updates ohne Änderung
                  lösen nichts aus. */}
              <span key={`${i}-${zelle ?? "leer"}`} className={zelle ? "stein-pop" : undefined}>
                {zelle ? SYMBOL_EMOJI[zelle] : ""}
              </span>
            </button>
          );
        })}
      </div>

      {fehler && (
        <div className="mb-4 rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-3 text-center text-sm text-red-200">
          {fehler}
        </div>
      )}

      {/* Aktionen je nach Lage */}
      <div className="flex flex-col gap-2">
        {session.zugTimeout && (
          <button
            onClick={() =>
              mitBusy("timeout", async () => {
                const t = await api("timeout", { sessionId: session.id });
                if (!t.ok) return t;
                return api("claim", { sessionId: session.id });
              }, true)
            }
            disabled={!!busy}
            className="btn-cta btn-cta-primary min-h-[52px] !text-base disabled:opacity-50"
          >
            {busy === "timeout" ? <Spinner size={20} className="animate-spin" /> : <Timer size={20} weight="fill" />}
            Gegner inaktiv – Sieg + Pot abholen
          </button>
        )}

        {session.kannClaimen && !session.zugTimeout && (
          <button
            onClick={() => mitBusy("claim", () => api("claim", { sessionId: session.id }), true)}
            disabled={!!busy}
            className="btn-cta btn-cta-primary min-h-[52px] !text-base disabled:opacity-50"
          >
            {busy === "claim" ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <Check size={20} weight="bold" />
            )}
            {session.status === "finished" && session.gewinner !== "draw"
              ? `Pot abholen (+${zahl(session.pot)} Punkte)`
              : `Einsatz zurückholen (+${zahl(session.stake)} Punkte)`}
          </button>
        )}

        {session.bereitsAbgeholt && (
          <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-[#8fa96d]">
            <Check size={16} weight="bold" />
            Abgeholt – der Kontostand ist aktuell.
          </p>
        )}

        {session.status === "playing" && (
          <button
            onClick={() => mitBusy("forfeit", () => api("forfeit", { sessionId: session.id }))}
            disabled={!!busy}
            className="mx-auto flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#6b7565] transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
          >
            <Flag size={14} />
            Aufgeben
          </button>
        )}

        {session.status === "waiting" && session.meinSymbol === "X" && (
          <button
            onClick={() => mitBusy("cancel", () => api("cancel", { sessionId: session.id }), true)}
            disabled={!!busy}
            className="mx-auto flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#6b7565] transition-colors hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
          >
            Duell absagen (Einsatz zurückholbar)
          </button>
        )}

        {(session.status === "finished" ||
          session.status === "cancelled" ||
          session.status === "expired") && (
          <button
            onClick={neuesDuell}
            className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            <ArrowLeft size={16} />
            Neues Duell
          </button>
        )}
      </div>

      {session.status !== "finished" &&
        session.status !== "cancelled" &&
        session.status !== "expired" && (
          <button
            onClick={neuesDuell}
            className="mx-auto mt-4 block text-xs font-semibold text-[#4a5548] transition-colors hover:text-[#6b7565]"
          >
            Zurück zur Lobby (Duell läuft weiter)
          </button>
        )}
    </div>
  );
}
