"use client";

import { useEffect, useRef, useState } from "react";
import {
  Armchair,
  ArrowLeft,
  BellRinging,
  Check,
  CoatHanger,
  Flag,
  Handshake,
  Spinner,
  Ticket,
  Timer,
  X,
} from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  TurnstileWidget,
  turnstileKonfiguriert,
} from "@/components/TurnstileWidget";
import {
  DUELL_ACCESSOIRES,
  DUELL_EINSAETZE,
  DUELL_GURKEN_BASEN,
  STANDARD_AVATAR,
  type DuellAvatar,
  type OeffentlicheChallenge,
  type OeffentlicherGast,
  type OeffentlichesDuell,
} from "@/lib/duell";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

type RaumDaten = {
  gaeste: OeffentlicherGast[];
  eingehende: OeffentlicheChallenge[];
  ausgehende: OeffentlicheChallenge | null;
};

type Profil = { name: string; avatar: DuellAvatar };

const PROFIL_KEY = "gurken-duell-profil";

function ladeProfil(): Profil {
  if (typeof window === "undefined") return { name: "", avatar: STANDARD_AVATAR };
  try {
    const roh = window.localStorage.getItem(PROFIL_KEY);
    if (!roh) return { name: "", avatar: STANDARD_AVATAR };
    const parsed = JSON.parse(roh) as Partial<Profil>;
    const avatar =
      parsed.avatar &&
      typeof parsed.avatar.basis === "number" &&
      typeof parsed.avatar.accessoire === "number"
        ? {
            basis: Math.min(
              Math.max(parsed.avatar.basis, 0),
              DUELL_GURKEN_BASEN.length - 1,
            ),
            accessoire: Math.min(
              Math.max(parsed.avatar.accessoire, 0),
              DUELL_ACCESSOIRES.length - 1,
            ),
          }
        : STANDARD_AVATAR;
    return {
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 24) : "",
      avatar,
    };
  } catch {
    return { name: "", avatar: STANDARD_AVATAR };
  }
}

/** Gurken-Avatar: Basis-Gurke mit Tönung plus aufgesetztem Accessoire. */
export function GurkenAvatar({
  avatar,
  groesse = "text-5xl",
}: {
  avatar: DuellAvatar;
  groesse?: string;
}) {
  const basis =
    DUELL_GURKEN_BASEN[avatar.basis] ?? DUELL_GURKEN_BASEN[0];
  const extra =
    DUELL_ACCESSOIRES[avatar.accessoire] ?? DUELL_ACCESSOIRES[0];
  // Die Brille sitzt mitten im Gesicht, alles andere obenauf.
  const extraKlasse =
    avatar.accessoire === 1
      ? "absolute inset-0 flex items-center justify-center text-[0.5em]"
      : "absolute -right-1 -top-2 text-[0.55em]";
  return (
    <span
      className={`relative inline-block leading-none ${groesse}`}
      aria-hidden="true"
    >
      <span style={basis.filter === "none" ? undefined : { filter: basis.filter }}>
        {basis.emoji}
      </span>
      {extra.emoji && <span className={extraKlasse}>{extra.emoji}</span>}
    </span>
  );
}

/** Spieler-Chip im Versus-Kopf: Gurke, Name, Zug-Punkt. */
function SpielerChip({
  name,
  avatar,
  symbol,
  aktiv,
  ich,
  offen,
}: {
  name: string;
  avatar: DuellAvatar;
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
      <GurkenAvatar avatar={avatar} groesse="text-xl" />
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

type ApiFehler = { ok: false; error: string; requiresTurnstile?: boolean };

/**
 * Gurken Duell – Wartezimmer mit Tic-Tac-Toe um Punkte-Einsätze.
 *
 * Wer die Seite öffnet, nimmt mit Gurke und Namen im Wartezimmer Platz.
 * Per Klick auf eine andere Gurke schickt man eine Herausforderung; nimmt
 * die andere Seite an, startet das Spiel sofort. Der Server verwaltet Brett,
 * Sieg und Punkte – der Client fragt per Heartbeat/Polling nach.
 */
export function GurkenDuell({ duellApiBase }: { duellApiBase: string }) {
  const { punkte, loading, refresh } = usePunkte();
  const [session, setSession] = useState<OeffentlichesDuell | null>(null);
  const [einsatz, setEinsatz] = useState<number>(DUELL_EINSAETZE[0]);
  const [profil, setProfil] = useState<Profil>(ladeProfil);
  const [gaeste, setGaeste] = useState<OeffentlicherGast[]>([]);
  const [eingehende, setEingehende] = useState<OeffentlicheChallenge[]>([]);
  const [ausgehende, setAusgehende] = useState<OeffentlicheChallenge | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<OeffentlicherGast | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [captchaPflicht, setCaptchaPflicht] = useState(turnstileKonfiguriert());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaHinweis, setCaptchaHinweis] = useState<string | null>(
    turnstileKonfiguriert() ? "Bitte löse kurz das Captcha fürs Duell." : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);
  const speicherKey = `gurken-duell:${duellApiBase}`;
  // Echter Benutzername (nur Realbereich): Der Server zeigt ihn im Duell
  // maßgeblich an – das freie Namensfeld ist dann gesperrt.
  const istDemo = duellApiBase.startsWith("/demo/");
  const [benutzername, setBenutzername] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bereits übernommene angenommene Challenge: Der Heartbeat lädt die Session
  // genau einmal – sonst zieht er Gewinner nach „Zurück ins Wartezimmer"
  // per Polling immer wieder auf die Gewinn-Seite zurück.
  const uebernommeneChallengeRef = useRef<string | null>(null);
  // Offene Session-ID synchron aus dem Browser-Speicher lesen (kein Effect
  // nötig – reines Auslesen, kein setState).
  const [sessionId, setSessionId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(speicherKey),
  );

  function profilSpeichern(neu: Profil) {
    setProfil(neu);
    try {
      window.localStorage.setItem(PROFIL_KEY, JSON.stringify(neu));
    } catch {
      // Privater Modus o. ä. – Profil gilt nur für diese Sitzung.
    }
  }

  /** POST mit zentraler Captcha- und Fehlerbehandlung (Rohdaten zurück). */
  async function post(
    aktion: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ ok: true; data: Record<string, unknown> } | ApiFehler> {
    try {
      const res = await fetch(duellApiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion, turnstileToken, ...extra }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      > & { error?: string; requiresTurnstile?: boolean };
      if (res.status === 403 && data.requiresTurnstile) {
        setCaptchaPflicht(true);
        setTurnstileToken(null);
        setCaptchaReset((n) => n + 1);
        setCaptchaHinweis("Captcha erforderlich – bitte erneut bestätigen.");
        return {
          ok: false,
          error: data.error ?? "Captcha erforderlich",
          requiresTurnstile: true,
        };
      }
      if (!res.ok) {
        return { ok: false, error: data.error ?? `Fehler ${res.status}` };
      }
      return { ok: true, data };
    } catch {
      return {
        ok: false,
        error: "Der Server meldet sich nicht – bitte erneut versuchen.",
      };
    }
  }

  /** Session per ID nachladen (nach Annahme oder Seiten-Reload). */
  async function ladeSession(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${duellApiBase}?id=${encodeURIComponent(id)}`);
      if (!res.ok) return false;
      const data = (await res.json()) as { session: OeffentlichesDuell };
      merkeSession(data.session);
      return true;
    } catch {
      return false;
    }
  }

  function merkeSession(s: OeffentlichesDuell) {
    setSession(s);
    setSessionId(s.id);
    window.localStorage.setItem(speicherKey, s.id);
  }

  function zurueckInsWartezimmer() {
    if (ausgehende && ausgehende.status === "angenommen") {
      uebernommeneChallengeRef.current = ausgehende.id;
    }
    setSession(null);
    setSessionId(null);
    setFehler(null);
    setAusgewaehlt(null);
    window.localStorage.removeItem(speicherKey);
  }

  // Gespeichertes Duell beim Öffnen fortsetzen.
  useEffect(() => {
    if (!sessionId) return;
    let aktiv = true;
    fetch(`${duellApiBase}?id=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!aktiv) return null;
        if (!res.ok) return null;
        return res.json() as Promise<{ session: OeffentlichesDuell }>;
      })
      .then((data) => {
        if (!aktiv || !data) {
          if (aktiv) {
            window.localStorage.removeItem(speicherKey);
            setSessionId(null);
          }
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

  // Echten Benutzernamen laden (nur Realbereich): Er ersetzt den lokalen
  // Profilnamen und wird im Wartezimmer/Spiel für alle sichtbar angezeigt.
  useEffect(() => {
    if (istDemo) return;
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/mitglieder/benutzername");
        const data = await res.json().catch(() => ({}));
        if (!aktiv) return;
        if (typeof data.benutzername === "string" && data.benutzername) {
          setBenutzername(data.benutzername);
          setProfil((prev) => {
            if (prev.name === data.benutzername) return prev;
            const neu = { ...prev, name: data.benutzername as string };
            try {
              window.localStorage.setItem(PROFIL_KEY, JSON.stringify(neu));
            } catch {
              // Privater Modus – gilt nur für diese Sitzung.
            }
            return neu;
          });
        }
      } catch {
        // Fail-open: freier Profilname wie bisher.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [istDemo]);

  // Live-Polling der laufenden Session alle 2 s.
  const sessionStatus = session?.status;
  const sessionKennung = session?.id;
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (!sessionKennung || sessionStatus !== "playing") return;
    pollRef.current = setInterval(() => {
      fetch(`${duellApiBase}?id=${encodeURIComponent(sessionKennung)}`)
        .then((res) => {
          if (!res.ok) return undefined;
          return res.json() as Promise<{ session: OeffentlichesDuell }>;
        })
        .then((data) => {
          if (data === undefined) return;
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
  }, [sessionKennung, sessionStatus, duellApiBase]);

  // Heartbeat: Platz im Wartezimmer melden + Gäste und Anfragen holen.
  // Läuft nur ohne aktive Session – wer spielt, verlässt automatisch den Raum.
  useEffect(() => {
    if (session) return;
    let aktiv = true;
    const heartbeat = async () => {
      const antwort = await post("raum", {
        name: profil.name,
        avatar: profil.avatar,
        stake: einsatz,
      });
      if (!aktiv || !antwort.ok) return;
      const daten = antwort.data as unknown as RaumDaten;
      setGaeste(daten.gaeste ?? []);
      setEingehende(daten.eingehende ?? []);
      const aus = daten.ausgehende ?? null;
      setAusgehende(aus);
      // Angenommen? Dann Session genau einmal laden und ab ans Brett.
      if (
        aus &&
        aus.status === "angenommen" &&
        aus.sessionId &&
        uebernommeneChallengeRef.current !== aus.id
      ) {
        uebernommeneChallengeRef.current = aus.id;
        await ladeSession(aus.sessionId);
        await refresh();
      }
    };
    heartbeat();
    const tick = setInterval(heartbeat, 5000);
    return () => {
      aktiv = false;
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duellApiBase, session, profil.name, profil.avatar, einsatz]);

  function captchaFehlt(schluessel: string): boolean {
    if (
      (schluessel === "herausfordern" || schluessel.startsWith("antwort")) &&
      captchaPflicht &&
      !turnstileToken
    ) {
      setFehler("Bitte zuerst das Captcha lösen.");
      return true;
    }
    return false;
  }

  async function herausfordern(gast: OeffentlicherGast) {
    if (busy || captchaFehlt("herausfordern")) return;
    setBusy("herausfordern");
    setFehler(null);
    const antwort = await post("herausfordern", {
      zielUserId: gast.userId,
      stake: einsatz,
      name: profil.name,
      avatar: profil.avatar,
    });
    if (antwort.ok) {
      setAusgehende(
        (antwort.data as unknown as { challenge: OeffentlicheChallenge })
          .challenge,
      );
      setAusgewaehlt(null);
      await refresh();
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  async function beantworten(challengeId: string, annehmen: boolean) {
    const schluessel = `antwort-${challengeId}-${annehmen ? "ja" : "nein"}`;
    if (busy || captchaFehlt("antwort")) return;
    setBusy(schluessel);
    setFehler(null);
    const antwort = await post("antwort", {
      challengeId,
      annehmen,
      name: profil.name,
      avatar: profil.avatar,
    });
    if (antwort.ok) {
      const daten = antwort.data as unknown as {
        challenge: OeffentlicheChallenge;
        session?: OeffentlichesDuell;
      };
      if (daten.session) {
        uebernommeneChallengeRef.current = daten.challenge.id;
        merkeSession(daten.session);
        await refresh();
      } else {
        setEingehende((prev) => prev.filter((c) => c.id !== challengeId));
      }
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  async function stornieren(challengeId: string) {
    if (busy) return;
    setBusy("stornieren");
    setFehler(null);
    const antwort = await post("stornieren", { challengeId });
    if (antwort.ok) {
      setAusgehende(null);
      await refresh();
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  async function challengeRefund(challengeId: string) {
    if (busy) return;
    setBusy("challenge-claim");
    setFehler(null);
    const antwort = await post("challenge-claim", { challengeId });
    if (antwort.ok) {
      setAusgehende(null);
      await refresh();
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  async function zugSetzen(index: number) {
    if (busy || !session) return;
    setBusy(`move-${index}`);
    setFehler(null);
    const antwort = await post("move", { sessionId: session.id, index });
    if (antwort.ok) {
      setSession(
        (antwort.data as unknown as { session: OeffentlichesDuell }).session,
      );
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  async function abholen() {
    if (busy || !session) return;
    setBusy("claim");
    setFehler(null);
    // Timeout-Sieg und Claim in einem Rutsch: Erst Sieg feststellen, dann Pot holen.
    if (session.zugTimeout) {
      const t = await post("timeout", { sessionId: session.id });
      if (!t.ok) {
        if (!t.requiresTurnstile) setFehler(t.error);
        setBusy(null);
        return;
      }
      setSession(
        (t.data as unknown as { session: OeffentlichesDuell }).session,
      );
    }
    const antwort = await post("claim", { sessionId: session.id });
    if (antwort.ok) {
      setSession(
        (antwort.data as unknown as { session: OeffentlichesDuell }).session,
      );
      await refresh();
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  async function aufgeben() {
    if (busy || !session) return;
    setBusy("forfeit");
    setFehler(null);
    const antwort = await post("forfeit", { sessionId: session.id });
    if (antwort.ok) {
      setSession(
        (antwort.data as unknown as { session: OeffentlichesDuell }).session,
      );
    } else if (!antwort.requiresTurnstile) {
      setFehler(antwort.error);
    }
    setBusy(null);
  }

  const reichtEinsatz = punkte >= einsatz;

  // ---------- Wartezimmer ----------
  if (!session) {
    const andere = gaeste.filter((g) => !g.ich);
    return (
      <div className="mb-8 space-y-5">
        {/* Anmeldung: Umkleide */}
        <div className="card p-6 md:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CoatHanger size={22} weight="fill" className="text-[#c9a86a]" />
              <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
                Anmeldung
              </h2>
            </div>
            <span className="tabular rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-[#e2d9bf]">
              {loading ? "…" : `${zahl(punkte)} Punkte`}
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
            {/* Spiegel: Vorschau */}
            <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-8 py-6">
              <span
                key={`${profil.avatar.basis}-${profil.avatar.accessoire}`}
                className="stein-pop"
              >
                <GurkenAvatar avatar={profil.avatar} groesse="text-7xl" />
              </span>
              <span className="max-w-[14ch] truncate text-sm font-semibold text-[#ede8d6]">
                {profil.name.trim() || "Deine Gurke"}
              </span>
              <span className="text-xs text-[#6b7565]">
                spielt um {zahl(einsatz)} Punkte
              </span>
            </div>

            <div className="min-w-0 space-y-4">
              <label className="block text-xs font-semibold text-[#a3ad9a]">
                Dein Name
                <input
                  type="text"
                  value={benutzername ?? profil.name}
                  onChange={(e) =>
                    profilSpeichern({
                      ...profil,
                      name: e.target.value.slice(0, 24),
                    })
                  }
                  placeholder="z. B. Gurkenkönig"
                  maxLength={24}
                  autoComplete="off"
                  disabled={benutzername !== null}
                  title={
                    benutzername !== null
                      ? "Dein Benutzername – änderbar in den Einstellungen"
                      : undefined
                  }
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d] disabled:opacity-60"
                />
              </label>
              {benutzername !== null && (
                <p className="-mt-2 text-xs text-[#6b7565]">
                  @{benutzername} · aus deinem Konto – änderbar in den{" "}
                  <a
                    href="/mitglieder/einstellungen"
                    className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
                  >
                    Einstellungen
                  </a>
                  .
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold text-[#a3ad9a]">
                  Welche Gurke bist du?
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {DUELL_GURKEN_BASEN.map((basis, i) => (
                    <button
                      key={basis.label}
                      type="button"
                      aria-label={basis.label}
                      aria-pressed={profil.avatar.basis === i}
                      onClick={() =>
                        profilSpeichern({
                          ...profil,
                          avatar: { ...profil.avatar, basis: i },
                        })
                      }
                      className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-3xl transition-[transform,border-color,background-color] duration-200 ease-out active:scale-[0.95] ${
                        profil.avatar.basis === i
                          ? "border-[#8fa96d]/60 bg-[#8fa96d]/[0.1]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/25"
                      }`}
                    >
                      <span
                        style={
                          basis.filter === "none"
                            ? undefined
                            : { filter: basis.filter }
                        }
                      >
                        {basis.emoji}
                      </span>
                      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight text-[#a3ad9a]">
                        {basis.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-[#a3ad9a]">
                  Was ziehst du an?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {DUELL_ACCESSOIRES.map((extra, i) => (
                    <button
                      key={extra.label}
                      type="button"
                      aria-label={extra.label}
                      aria-pressed={profil.avatar.accessoire === i}
                      onClick={() =>
                        profilSpeichern({
                          ...profil,
                          avatar: { ...profil.avatar, accessoire: i },
                        })
                      }
                      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-2xl transition-[transform,border-color,background-color] duration-200 ease-out active:scale-[0.95] ${
                        profil.avatar.accessoire === i
                          ? "border-[#8fa96d]/60 bg-[#8fa96d]/[0.1]"
                          : "border-white/10 bg-white/[0.02] hover:border-white/25"
                      }`}
                    >
                      {extra.emoji ?? (
                        <span className="text-base font-semibold text-[#6b7565]">
                          ∅
                        </span>
                      )}
                      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight text-[#a3ad9a]">
                        {extra.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-[#a3ad9a]">
                  Einsatz pro Spiel (Pot: 2×)
                </p>
                <div className="flex flex-wrap gap-2">
                  {DUELL_EINSAETZE.map((wert) => (
                    <button
                      key={wert}
                      type="button"
                      onClick={() => setEinsatz(wert)}
                      disabled={!!busy}
                      className={`tabular min-h-[44px] rounded-lg border px-5 py-2.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-200 ease-out active:scale-[0.97] disabled:opacity-50 ${
                        einsatz === wert
                          ? "border-transparent bg-[#ede8d6] text-[#0b120d]"
                          : "border-white/10 bg-white/[0.03] text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6]"
                      }`}
                    >
                      {zahl(wert)}
                    </button>
                  ))}
                </div>
                {!reichtEinsatz && !loading && (
                  <p className="mt-2 text-xs text-red-300">
                    Für {zahl(einsatz)} Punkte Einsatz brauchst du mindestens{" "}
                    {zahl(einsatz)} Punkte auf dem Konto.
                  </p>
                )}
              </div>

              {captchaPflicht && (
                <div>
                  <TurnstileWidget
                    resetKey={captchaReset}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                      setCaptchaHinweis(null);
                    }}
                    onExpire={() => {
                      setTurnstileToken(null);
                      setCaptchaHinweis(
                        "Captcha abgelaufen. Bitte erneut bestätigen.",
                      );
                    }}
                    onError={() => {
                      setTurnstileToken(null);
                      setCaptchaHinweis(
                        "Captcha konnte nicht geladen werden. Bitte erneut versuchen.",
                      );
                    }}
                  />
                  {captchaHinweis && (
                    <p className="mt-2 text-xs text-[#a3ad9a]">{captchaHinweis}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Eingehende Anfragen */}
        {eingehende.map((anfrage) => (
          <div
            key={anfrage.id}
            className="card border-[#8fa96d]/40 p-5 md:p-6"
            role="alert"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#8fa96d]">
              <BellRinging size={16} weight="fill" />
              Neue Herausforderung
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#8fa96d] animate-pulse"
                aria-hidden="true"
              />
              <GurkenAvatar avatar={anfrage.von.avatar} groesse="text-4xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#ede8d6]">
                  {anfrage.von.name} fordert dich heraus
                </p>
                <p className="tabular mt-0.5 text-xs text-[#a3ad9a]">
                  Einsatz {zahl(anfrage.stake)} · Pot {zahl(anfrage.pot)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => beantworten(anfrage.id, false)}
                  disabled={!!busy}
                  aria-label="Anfrage ablehnen"
                  className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border border-white/10 px-4 text-[#a3ad9a] transition-[transform,border-color,color] duration-200 ease-out active:scale-[0.95] hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                >
                  <X size={20} weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => beantworten(anfrage.id, true)}
                  disabled={!!busy || loading}
                  className="btn-cta btn-cta-primary min-h-[48px] !text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy?.startsWith(`antwort-${anfrage.id}`) ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} weight="bold" />
                  )}
                  Annehmen
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Eigene ausgehende Anfrage */}
        {ausgehende && (
          <div className="card border-[#c9a86a]/30 p-5 md:p-6">
            {ausgehende.status === "offen" && (
              <div className="flex flex-wrap items-center gap-3">
                <Ticket size={22} weight="fill" className="text-[#c9a86a]" />
                <p className="min-w-0 flex-1 text-sm text-[#a3ad9a]">
                  <strong className="text-[#ede8d6]">
                    {ausgehende.anName}
                  </strong>{" "}
                  überlegt noch … (Einsatz {zahl(ausgehende.stake)} ist
                  reserviert)
                </p>
                <button
                  type="button"
                  onClick={() => stornieren(ausgehende.id)}
                  disabled={!!busy}
                  className="flex min-h-[44px] items-center rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                >
                  {busy === "stornieren" ? (
                    <Spinner size={16} className="animate-spin" />
                  ) : (
                    "Zurückziehen"
                  )}
                </button>
              </div>
            )}
            {(ausgehende.status === "abgelehnt" ||
              ausgehende.status === "abgelaufen" ||
              ausgehende.status === "storniert") && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-[#a3ad9a]">
                  {ausgehende.status === "abgelehnt" &&
                    `${ausgehende.anName} hat abgelehnt.`}{" "}
                  {ausgehende.status === "abgelaufen" &&
                    "Die Anfrage ist verfallen."}{" "}
                  {ausgehende.status === "storniert" &&
                    "Du hast die Anfrage zurückgezogen."}{" "}
                  {ausgehende.bereitsAbgeholt
                    ? "Der Einsatz ist zurück auf deinem Konto."
                    : `Hole deinen Einsatz (${zahl(ausgehende.stake)} Punkte) zurück.`}
                </p>
                {!ausgehende.bereitsAbgeholt && (
                  <button
                    type="button"
                    onClick={() => challengeRefund(ausgehende.id)}
                    disabled={!!busy}
                    className="btn-cta btn-cta-primary min-h-[48px] !text-[15px] disabled:opacity-50"
                  >
                    {busy === "challenge-claim" ? (
                      <Spinner size={18} className="animate-spin" />
                    ) : (
                      <Check size={18} weight="bold" />
                    )}
                    Einsatz zurückholen
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Wartezimmer: Stühle */}
        <div className="card p-6 md:p-8">
          <div className="mb-1 flex items-center gap-3">
            <Armchair size={22} weight="fill" className="text-[#c9a86a]" />
            <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
              Wartezimmer
            </h2>
          </div>
          <p className="mb-5 text-sm text-[#a3ad9a]">
            {andere.length === 0
              ? "Noch niemand da – nimm Platz, gleich kommt jemand."
              : `${andere.length} ${andere.length === 1 ? "Gurke wartet" : "Gurken warten"} – tippe eine an, um sie herauszufordern.`}
          </p>

          {andere.length > 0 && (
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              role="list"
              aria-label="Anwesende Spieler"
            >
              {andere.map((gast, i) => {
                const aktiv = ausgewaehlt?.userId === gast.userId;
                return (
                  <button
                    key={gast.userId}
                    type="button"
                    onClick={() =>
                      setAusgewaehlt(aktiv ? null : gast)
                    }
                    disabled={!!busy || !reichtEinsatz}
                    aria-pressed={aktiv}
                    aria-label={`${gast.name} herausfordern, Einsatz ${gast.stake} Punkte`}
                    style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                    className={`duell-zelle-enter flex min-h-[148px] flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-[transform,border-color,background-color] duration-200 ease-out active:scale-[0.97] disabled:opacity-60 ${
                      aktiv
                        ? "border-[#8fa96d]/60 bg-[#8fa96d]/[0.08]"
                        : "border-white/10 bg-white/[0.02] hover:border-[#8fa96d]/40 hover:bg-[#8fa96d]/[0.04]"
                    }`}
                  >
                    <span className="tabular w-full text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[#4a5548]">
                      Stuhl {i + 1}
                    </span>
                    <GurkenAvatar avatar={gast.avatar} groesse="text-5xl" />
                    <span className="w-full truncate text-sm font-semibold text-[#ede8d6]">
                      {gast.name}
                    </span>
                    <span className="tabular rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-[#e2d9bf]">
                      {zahl(gast.stake)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Herausforderung bestätigen */}
          {ausgewaehlt && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-[#8fa96d]/40 bg-[#8fa96d]/[0.05] p-4">
              <GurkenAvatar avatar={ausgewaehlt.avatar} groesse="text-4xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#ede8d6]">
                  {ausgewaehlt.name} herausfordern?
                </p>
                <p className="tabular mt-0.5 text-xs text-[#a3ad9a]">
                  Dein Einsatz {zahl(einsatz)} · Pot {zahl(einsatz * 2)} bei Sieg
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAusgewaehlt(null)}
                  disabled={!!busy}
                  className="flex min-h-[48px] items-center rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                >
                  Doch nicht
                </button>
                <button
                  type="button"
                  onClick={() => herausfordern(ausgewaehlt)}
                  disabled={!!busy || loading || !reichtEinsatz}
                  className="btn-cta btn-cta-primary min-h-[48px] !text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === "herausfordern" ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <Handshake size={18} weight="fill" />
                  )}
                  Herausfordern
                </button>
              </div>
            </div>
          )}

          {fehler && (
            <div className="mt-4 rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-3 text-center text-sm text-red-200">
              {fehler}
            </div>
          )}

          <p className="mt-4 text-center text-xs leading-relaxed text-[#6b7565]">
            Spielgeld-Regeln: Dein Einsatz wird beim Herausfordern sofort
            abgezogen. Sieg holt den Pot, Niederlage verliert den Einsatz,
            Unentschieden erstattet ihn. Abgelehnte Anfragen kannst du dir
            zurückholen.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Session ----------
  const ichBinDran =
    session.status === "playing" && session.meinSymbol === session.amZug;
  const gegner = session.spieler.find((s) => !s.ich);
  const meinEintrag = session.spieler.find((s) => s.ich);
  const ichSymbol = session.meinSymbol;

  let statusText: string;
  let statusKlasse = "text-[#ede8d6]";
  if (session.status === "playing") {
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
            avatar={meinEintrag.avatar}
            symbol={meinEintrag.symbol}
            aktiv={
              session.status === "playing" &&
              session.amZug === meinEintrag.symbol
            }
            ich
          />
        ) : (
          <SpielerChip
            name="Zuschauer"
            avatar={STANDARD_AVATAR}
            symbol="–"
            aktiv={false}
          />
        )}
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4a5548]">
          vs
        </span>
        {gegner ? (
          <SpielerChip
            name={gegner.name}
            avatar={gegner.avatar}
            symbol={gegner.symbol}
            aktiv={
              session.status === "playing" && session.amZug === gegner.symbol
            }
          />
        ) : (
          <SpielerChip
            name="Noch offen"
            avatar={STANDARD_AVATAR}
            symbol="?"
            aktiv={false}
            offen
          />
        )}
      </div>

      <p
        aria-live="polite"
        className={`mb-1 flex items-center justify-center gap-2 text-center text-sm font-semibold ${statusKlasse}`}
      >
        {session.status === "playing" && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-[#8fa96d]"
            aria-hidden="true"
          />
        )}
        {statusText}
      </p>
      <p className="tabular mb-5 text-center text-xs text-[#6b7565]">
        Einsatz {zahl(session.stake)} ·{" "}
        <span className="font-semibold text-[#e2d9bf]">
          Pot {zahl(session.pot)}
        </span>
      </p>

      <div className="mx-auto mb-5 grid max-w-[320px] grid-cols-3 gap-2">
        {session.board.map((zelle, i) => {
          const inLinie = session.gewinnLinie?.includes(i) ?? false;
          const letzter = session.letzterZug === i && !inLinie;
          const klickbar = ichBinDran && !zelle && !busy;
          const steinAvatar =
            meinEintrag && zelle === meinEintrag.symbol
              ? meinEintrag.avatar
              : (gegner?.avatar ?? STANDARD_AVATAR);
          const steinName = zelle
            ? (session.spieler.find((s) => s.symbol === zelle)?.name ?? "")
            : "";
          return (
            <button
              key={i}
              onClick={() => zugSetzen(i)}
              disabled={!klickbar}
              aria-label={`Feld ${i + 1}${zelle ? `, belegt mit ${zelle}` : ""}`}
              style={{ animationDelay: `${i * 35}ms` }}
              className={`duell-zelle-enter flex h-20 flex-col items-center justify-center rounded-xl border text-4xl transition-[transform,background-color,border-color] duration-200 ease-out md:h-24 ${
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
              <span
                key={`${i}-${zelle ?? "leer"}`}
                className={zelle ? "stein-pop" : undefined}
              >
                {zelle ? (
                  <span className="flex max-w-full flex-col items-center gap-0.5 leading-none">
                    <GurkenAvatar avatar={steinAvatar} groesse="text-3xl" />
                    {steinName && (
                      <span className="max-w-full truncate px-1 text-[10px] font-semibold text-[#a3ad9a]">
                        {steinName}
                      </span>
                    )}
                  </span>
                ) : (
                  ""
                )}
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
            onClick={abholen}
            disabled={!!busy}
            className="btn-cta btn-cta-primary min-h-[52px] !text-base disabled:opacity-50"
          >
            {busy === "claim" ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <Timer size={20} weight="fill" />
            )}
            Gegner inaktiv – Sieg + Pot abholen
          </button>
        )}

        {session.kannClaimen && !session.zugTimeout && (
          <button
            onClick={abholen}
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
            onClick={aufgeben}
            disabled={!!busy}
            className="mx-auto flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#6b7565] transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
          >
            <Flag size={14} />
            Aufgeben
          </button>
        )}

        {(session.status === "finished" ||
          session.status === "cancelled" ||
          session.status === "expired") && (
          <button
            onClick={zurueckInsWartezimmer}
            className="mx-auto flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            <ArrowLeft size={16} />
            Zurück ins Wartezimmer
          </button>
        )}
      </div>

    </div>
  );
}
