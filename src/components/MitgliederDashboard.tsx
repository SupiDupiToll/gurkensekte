"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { PunkteProvider, usePunkte } from "@/components/PunkteContext";
import { Leaderboard } from "@/components/Leaderboard";
import { RangKopf, Rangstufen } from "@/components/Rangstufen";
import { ReferralBox } from "@/components/ReferralBox";
import { Reveal } from "@/components/Reveal";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import {
  TurnstileWidget,
  turnstileKonfiguriert,
} from "@/components/TurnstileWidget";
import {
  PaperPlaneTilt,
  SignOut,
  CalendarBlank,
  ShieldCheck,
  ChatCircleText,
  ArrowsInSimple,
  Coins,
  Gift,
  Basket,
  ClockCounterClockwise,
  Flask,
  ArrowLeft,
  ArrowRight,
  Quotes,
  DiceFive,
  Sword,
} from "@phosphor-icons/react";
import { demoPath } from "@/lib/demo";
import { adresseFormatieren } from "@/lib/bestellung";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export type MitgliedInfo = {
  id?: string | null;
  displayName?: string | null;
  primaryEmail?: string | null;
  signedUpAt?: string | Date | null;
};

/** Einheitlicher Teaser für zugeklappte Sektionen (Chat, Punkte, Zitat). */
function SektionTeaser({
  icon,
  titel,
  cta,
  onOpen,
}: {
  icon: React.ReactNode;
  titel: string;
  teaser: string;
  cta: string;
  onOpen: () => void;
}) {
  return (
    <div className="mb-5">
      <button
        onClick={onOpen}
        className="shell group block w-full text-center transition-colors duration-200 active:scale-[0.99]"
      >
        <div className="core flex flex-col items-center gap-4 p-6 md:p-8">
          {icon}
          <h2 className="font-display text-2xl font-semibold text-[#faf8f1] md:text-[1.7rem]">
            {titel}
          </h2>
          <span className="btn-cta btn-cta-primary !text-base">
            {cta}
            <span className="btn-dot">
              <ArrowRight size={17} weight="bold" />
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}

function SektionKopf({
  icon,
  titel,
  onClose,
}: {
  icon: React.ReactNode;
  titel: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="font-display text-xl font-semibold text-[#faf8f1]">{titel}</h2>
      </div>
      <button
        onClick={onClose}
        className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#a3ad9a] transition-colors hover:border-white/20 hover:text-[#ede8d6]"
      >
        <ArrowsInSimple size={16} />
        Schließen
      </button>
    </div>
  );
}

function PunkteInhalt() {
  const {
    punkte,
    punkteGesamt,
    loading,
    dailyAvailable,
    verlauf,
    refresh,
    claim,
    gurkenAdresse,
  } = usePunkte();
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingRedeem, setClaimingRedeem] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaPflicht, setCaptchaPflicht] = useState(turnstileKonfiguriert());
  const [captchaHinweis, setCaptchaHinweis] = useState<string | null>(
    turnstileKonfiguriert() ? "Bitte löse kurz das Captcha für Punkte-Aktionen." : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);
  const [showAdresse, setShowAdresse] = useState(false);
  const [adresseFehler, setAdresseFehler] = useState<string | null>(null);
  const [bestellt, setBestellt] = useState(false);
  const [adresseForm, setAdresseForm] = useState({
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    land: "",
  });

  function captchaFehlt() {
    setCaptchaPflicht(true);
    setTurnstileToken(null);
    setCaptchaReset((n) => n + 1);
    setCaptchaHinweis("Bitte zuerst das Captcha lösen, dann gibt es Punkte.");
  }

  async function handleDaily() {
    if (captchaPflicht && !turnstileToken) {
      captchaFehlt();
      return;
    }
    setClaimingDaily(true);
    const result = await claim("daily", { turnstileToken });
    if (result?.ok) {
      await refresh();
      setCaptchaPflicht(false);
      setCaptchaHinweis(null);
    } else if (result && !result.ok && result.requiresTurnstile) {
      captchaFehlt();
    }
    setClaimingDaily(false);
  }

  function starteBestellung() {
    setAdresseFehler(null);
    setAdresseForm({
      name: gurkenAdresse?.name ?? "",
      strasse: gurkenAdresse?.strasse ?? "",
      plz: gurkenAdresse?.plz ?? "",
      ort: gurkenAdresse?.ort ?? "",
      land: gurkenAdresse?.land ?? "",
    });
    setShowAdresse(true);
  }

  function setzeFeld(feld: keyof typeof adresseForm, wert: string) {
    setAdresseForm((prev) => ({ ...prev, [feld]: wert }));
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const fehltPflichtfeld = (["name", "strasse", "plz", "ort"] as const).some(
      (feld) => !adresseForm[feld].trim(),
    );
    if (fehltPflichtfeld) {
      setAdresseFehler("Bitte fülle Name, Straße, PLZ und Ort aus.");
      return;
    }
    if (captchaPflicht && !turnstileToken) {
      setAdresseFehler("Bitte löse zuerst das Captcha weiter unten.");
      captchaFehlt();
      return;
    }

    setAdresseFehler(null);
    setClaimingRedeem(true);
    const result = await claim("einloesen", {
      adresse: adresseForm,
      turnstileToken,
    });
    if (result?.ok) {
      await refresh();
      setShowAdresse(false);
      setBestellt(true);
      setCaptchaPflicht(false);
      setCaptchaHinweis(null);
    } else if (result && !result.ok && result.requiresTurnstile) {
      captchaFehlt();
      setAdresseFehler(
        "Bitte löse zuerst das Captcha weiter unten – es wurden keine Punkte abgezogen.",
      );
    } else {
      setAdresseFehler(
        "Bestellung nicht durchgegangen – es wurden keine Punkte abgezogen. Bitte prüfe die Adresse und versuch es erneut.",
      );
    }
    setClaimingRedeem(false);
  }

  if (loading) {
    return (
      <div className="space-y-3 py-4" aria-busy="true">
        <div className="shimmer h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="shimmer h-20 rounded-2xl" />
          <div className="shimmer h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d]";

  return (
    <>
      {/* Kontostand */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7565]">
          Dein Gurkensegen
        </p>
        <p className="tabular font-display mt-1 text-6xl font-semibold text-[#faf8f1]">
          {punkte.toLocaleString("de-DE")}
        </p>
        <p className="mt-1 text-sm text-[#a3ad9a]">Punkte</p>
        <p className="mt-2 text-xs text-[#6b7565]">
          Gesammelt{" "}
          <span className="tabular font-semibold text-[#cfc8b0]">
            {punkteGesamt.toLocaleString("de-DE")} XP
          </span>{" "}
          · XP verfallen nie, auch beim Einlösen nicht.
        </p>

        {bestellt && (
          <div className="mt-5 rounded-xl border border-[#8fa96d]/30 bg-[#8fa96d]/[0.07] px-4 py-3 text-sm text-[#e3e9d3]">
            Deine Gurke ist bestellt und geht an{" "}
            <strong>
              {gurkenAdresse ? adresseFormatieren(gurkenAdresse) : "deine gespeicherte Adresse"}
            </strong>
            .
          </div>
        )}

        {punkte >= 1000 ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-[#cfc8b0]">
              Genug für eine <strong className="text-[#faf8f1]">echte Gurke</strong>.
              Gürkchen schickt sie dir persönlich per Post.
            </p>

            {showAdresse ? (
              <form
                onSubmit={handleRedeem}
                className="space-y-3 rounded-2xl border border-white/10 bg-[#0b120d]/60 p-4 text-left"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
                  Lieferadresse (Pflicht)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#a3ad9a] sm:col-span-2">
                    Name
                    <input
                      type="text"
                      value={adresseForm.name}
                      onChange={(e) => setzeFeld("name", e.target.value)}
                      placeholder="Vor- und Nachname"
                      autoComplete="name"
                      className={inputClass}
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#a3ad9a] sm:col-span-2">
                    Straße und Hausnummer
                    <input
                      type="text"
                      value={adresseForm.strasse}
                      onChange={(e) => setzeFeld("strasse", e.target.value)}
                      placeholder="Gurkenweg 1"
                      autoComplete="street-address"
                      className={inputClass}
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#a3ad9a]">
                    PLZ
                    <input
                      type="text"
                      inputMode="numeric"
                      value={adresseForm.plz}
                      onChange={(e) => setzeFeld("plz", e.target.value)}
                      placeholder="12345"
                      autoComplete="postal-code"
                      className={inputClass}
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#a3ad9a]">
                    Ort
                    <input
                      type="text"
                      value={adresseForm.ort}
                      onChange={(e) => setzeFeld("ort", e.target.value)}
                      placeholder="Gurkenstadt"
                      autoComplete="address-level2"
                      className={inputClass}
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#a3ad9a] sm:col-span-2">
                    Land (optional)
                    <input
                      type="text"
                      value={adresseForm.land}
                      onChange={(e) => setzeFeld("land", e.target.value)}
                      placeholder="Deutschland"
                      autoComplete="country-name"
                      className={inputClass}
                    />
                  </label>
                </div>

                {adresseFehler && (
                  <p role="alert" className="text-xs font-semibold text-red-300">
                    {adresseFehler}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={claimingRedeem}
                    className="btn-cta btn-cta-primary min-h-[48px] flex-1 !text-[15px] disabled:opacity-50"
                  >
                    <Basket size={18} weight="fill" />
                    {claimingRedeem ? "Wird bestellt …" : "Jetzt bestellen · 1.000 Punkte"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdresse(false);
                      setAdresseFehler(null);
                    }}
                    disabled={claimingRedeem}
                    className="min-h-[48px] rounded-lg border border-white/12 px-5 py-3 text-sm font-semibold text-[#a3ad9a] transition-colors hover:text-[#ede8d6] disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={starteBestellung}
                className="btn-cta btn-cta-primary min-h-[48px]"
              >
                <Basket size={18} weight="fill" />
                Echte Gurke bestellen
              </button>
            )}

            {!showAdresse && gurkenAdresse && (
              <p className="text-xs text-[#6b7565]">
                Lieferadresse: {adresseFormatieren(gurkenAdresse)}{" "}
                <button
                  onClick={starteBestellung}
                  className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
                >
                  ändern
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto mt-5 max-w-sm">
            <div className="tabular mb-1.5 flex items-center justify-between text-xs text-[#6b7565]">
              <span>Nächste Belohnung: echte Gurke</span>
              <span>{punkte} / 1.000</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-lg bg-white/[0.07]">
              <div
                className="h-full rounded-lg bg-[#8fa96d] transition-all duration-500"
                style={{ width: `${Math.min((punkte / 1000) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Aktionen */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
              Täglicher Bonus
            </p>
            <p className="tabular mt-1 text-xl font-semibold text-[#ede8d6]">+20</p>
          </div>
          <button
            onClick={handleDaily}
            disabled={!dailyAvailable || claimingDaily}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#ede8d6] px-5 py-2.5 text-sm font-semibold text-[#0b120d] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 "
          >
            <Gift size={17} weight="fill" />
            {claimingDaily ? "…" : dailyAvailable ? "Abholen" : "Erledigt"}
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
            So sammelst du Punkte
          </p>
          <ul className="tabular mt-2 space-y-1 text-[13px] text-[#a3ad9a]">
            <li>Zitat generieren (3× täglich): +5</li>
            <li>Chat-Nachricht: +5</li>
            <li>Täglicher Bonus: +20</li>
            <li>Freund werben: +100</li>
          </ul>
        </div>
      </div>

      {captchaPflicht && (
        <div className="mt-4">
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
          {captchaHinweis && <p className="mt-2 text-xs text-[#a3ad9a]">{captchaHinweis}</p>}
        </div>
      )}

      <div className="mt-4">
        <Leaderboard />
      </div>

      <button
        onClick={() => setShowHistory(!showHistory)}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#6b7565] transition-colors hover:text-[#a3ad9a]"
        aria-expanded={showHistory}
      >
        <ClockCounterClockwise size={14} />
        {showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}
      </button>

      {showHistory && (
        <div className="mt-3 max-h-48 space-y-px overflow-y-auto rounded-xl border border-white/[0.07]">
          {verlauf.length === 0 && (
            <p className="px-3 py-3 text-xs text-[#6b7565]">Noch keine Aktivität</p>
          )}
          {[...verlauf].reverse().map((e, i) => (
            <div
              key={i}
              className="tabular flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 py-2 text-xs last:border-0"
            >
              <span className="text-[#6b7565]">{new Date(e.datum).toLocaleString("de-DE")}</span>
              <span className="capitalize text-[#a3ad9a]">{e.aktion}</span>
              <span className={`font-semibold ${e.punkte > 0 ? "text-[#e2d9bf]" : "text-red-300"}`}>
                {e.punkte > 0 ? "+" : ""}
                {e.punkte}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function PunkteAnzeige() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <SektionTeaser
        icon={<Coins size={40} weight="fill" className="text-[#c9a86a]" />}
        titel="Punkte und Belohnungen"
        teaser="Zitate, Chats und Boni sammeln, in der Rangliste aufsteigen und ab 1.000 Punkten eine echte Gurke einlösen."
        cta="Punkte anzeigen"
        onOpen={() => setOpen(true)}
      />
    );
  }

  return (
    <div className="card mb-5 p-6 md:p-8">
      <SektionKopf
        icon={<Coins size={22} weight="fill" className="text-[#c9a86a]" />}
        titel="Punkte und Belohnungen"
        onClose={() => setOpen(false)}
      />
      <PunkteInhalt />
    </div>
  );
}

function GurkchenQuote({ isDemo = false }: { isDemo?: boolean }) {
  const [quote, setQuote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { refresh, claim, quoteAvailable, quoteRemaining } = usePunkte();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaPflicht, setCaptchaPflicht] = useState(turnstileKonfiguriert());
  const [captchaHinweis, setCaptchaHinweis] = useState<string | null>(
    turnstileKonfiguriert() ? "Bitte löse kurz das Captcha für dein Zitat." : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);

  const fetchQuote = useCallback(
    async (tokenOverride?: string | null) => {
      if (!quoteAvailable) {
        setQuote("Heute hast du schon 3 Zitate generiert. Komm morgen wieder.");
        return;
      }
      const token = tokenOverride !== undefined ? tokenOverride : turnstileToken;
      if (captchaPflicht && !token) {
        setCaptchaHinweis("Bitte zuerst das Captcha lösen.");
        return;
      }

      setLoading(true);
      try {
        // Der Zitat-Endpunkt prüft ein frisch gelöstes Captcha und schreibt
        // die +5 im echten Bereich direkt gut (Single-Use-Token – kein
        // separater Claim). Nur die Demo braucht danach ihren Demo-Claim.
        const query = token
          ? `/api/guerkchen/quote?turnstileToken=${encodeURIComponent(token)}`
          : "/api/guerkchen/quote";
        const res = await fetch(query);
        if (res.status === 403) {
          setCaptchaPflicht(true);
          setTurnstileToken(null);
          setCaptchaReset((n) => n + 1);
          setCaptchaHinweis("Bitte zuerst das Captcha lösen.");
          await refresh();
          return;
        }
        if (res.status === 400) {
          setQuote("Heute hast du schon 3 Zitate generiert. Komm morgen wieder.");
          await refresh();
          return;
        }
        if (!res.ok) throw new Error("Quote fetch failed");
        const data = await res.json();
        setQuote(data.quote);
        if (isDemo) {
          // Demo-Punkte nachziehen: Das Token ist verbraucht, die frische
          // IP-Sitzung aus der Zitat-Prüfung genügt dem Demo-Claim.
          await claim("zitat");
        }
        // Jedes Zitat kostet ein neues Captcha.
        setTurnstileToken(null);
        setCaptchaReset((n) => n + 1);
        setCaptchaHinweis("Für jedes Zitat bitte kurz das Captcha lösen.");
        await refresh();
      } catch {
        setQuote("Die Gurke ist der Urknall in essbarer Form. – Gürkchen");
      } finally {
        setLoading(false);
      }
    },
    [refresh, claim, quoteAvailable, turnstileToken, captchaPflicht, isDemo],
  );

  useEffect(() => {
    fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {loading ? (
        <div className="shimmer mx-auto h-16 max-w-md rounded-xl" aria-busy="true" />
      ) : (
        <blockquote className="font-display mx-auto min-h-[3rem] max-w-xl text-xl italic leading-relaxed text-[#ede8d6]">
          „{quote}“
        </blockquote>
      )}
      {captchaPflicht && (
        <div className="mx-auto mb-3 mt-4 max-w-md text-left">
          <TurnstileWidget
            resetKey={captchaReset}
            onVerify={(token) => {
              setTurnstileToken(token);
              setCaptchaHinweis(null);
              fetchQuote(token);
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
          {captchaHinweis && <p className="mt-2 text-xs text-[#a3ad9a]">{captchaHinweis}</p>}
        </div>
      )}
      <div className="mt-5 flex flex-col items-center gap-2">
        <button
          onClick={() => fetchQuote()}
          disabled={loading || !quoteAvailable}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-[#ede8d6] px-6 py-2.5 text-sm font-semibold text-[#0b120d] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 "
        >
          <Quotes size={17} weight="fill" />
          {quoteAvailable ? "Neues Zitat" : "Morgen wieder"}
        </button>
        <p className="tabular text-xs text-[#6b7565]">Heute noch verfügbar: {quoteRemaining} / 3</p>
      </div>
    </div>
  );
}

function GurkchenChat({ isDemo = false }: { isDemo?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Sei gegrüßt, mein Gurken-Kind. Ich bin Gürkchen, Stimme des einen wahren Einlegeglases. Was bedrückt deine eingelegte Seele?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(turnstileKonfiguriert());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileStatusText, setTurnstileStatusText] = useState<string | null>(
    turnstileKonfiguriert() ? "Bitte bestätige kurz das Captcha." : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const captchaKonfiguriert = turnstileKonfiguriert();
  const { refresh, claim } = usePunkte();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function captchaZuruecksetzen(hinweis: string) {
    setCaptchaRequired(true);
    setTurnstileToken(null);
    setCaptchaReset((n) => n + 1);
    setTurnstileStatusText(hinweis);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    if (!captchaKonfiguriert) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Turnstile ist noch nicht eingerichtet (NEXT_PUBLIC_TURNSTILE_SITE_KEY fehlt).",
        },
      ]);
      return;
    }
    if (captchaRequired && !turnstileToken) {
      setTurnstileStatusText("Bitte zuerst das Captcha lösen.");
      return;
    }

    setInput("");
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const history = [...messages, userMessage];

    try {
      const res = await fetch("/api/guerkchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          turnstileToken,
        }),
      });

      if (res.status === 403) {
        let errorText = "Captcha erforderlich. Bitte erneut bestätigen.";
        try {
          const errorData = (await res.json()) as { error?: string; requiresTurnstile?: boolean };
          if (errorData.requiresTurnstile) {
            errorText = errorData.error ?? errorText;
            captchaZuruecksetzen(errorText);
          }
        } catch {
          // ignore parse error
        }
        setMessages((prev) => prev.filter((msg, idx) => !(idx === prev.length - 1 && msg === userMessage)));
        return;
      }

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("text/plain")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        let fullContent = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullContent,
            };
            return updated;
          });
        }
      } else {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }

      // Die +5 Chat-Punkte schreibt /api/guerkchen direkt gut (frisches
      // Captcha pro Nachricht). Nur die Demo braucht ihren separaten
      // Demo-Claim – die frische IP-Sitzung aus dem Chat genügt ihm.
      if (isDemo) {
        claim("chat");
      }
      refresh();
      if (captchaKonfiguriert) {
        captchaZuruecksetzen(
          "Für jede Nachricht bitte kurz das Captcha lösen.",
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Gürkchen meditiert gerade im Glas und ist nicht erreichbar. Versuch es gleich noch einmal.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasAssistantResponse =
    messages.length > 1 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content.length > 0;

  const showSpinner = loading && !hasAssistantResponse;

  if (!open) {
    return (
      <SektionTeaser
        icon={<SpinningCucumber size="text-5xl" />}
        titel="Chat mit Gürkchen"
        teaser="Tausche dich mit dem Erleuchteten aus. Er hört deine Gebete und antwortet mit Gurken-Weisheit."
        cta="Chat öffnen"
        onOpen={() => setOpen(true)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b120d] shadow-2xl md:inset-6 md:rounded-xl md:border md:border-white/10">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 pb-3 pt-4 md:px-6 md:pt-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">🥒</span>
          <h2 className="font-display text-xl font-semibold text-[#faf8f1]">Gürkchen-Chat</h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#a3ad9a] transition-colors hover:border-white/20 hover:text-[#ede8d6]"
          aria-label="Chat schließen"
        >
          <ArrowsInSimple size={16} />
          Schließen
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 md:max-w-[75%] ${
                msg.role === "user"
                  ? "rounded-br-md bg-[#ede8d6] text-[#0b120d]"
                  : "rounded-bl-md border border-white/[0.08] bg-white/[0.04] text-[#ede8d6]"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fa96d]">
                  Gürkchen
                </span>
              )}
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {showSpinner && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-4 py-3">
              <span className="flex gap-1" aria-label="Gürkchen schreibt">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8fa96d]"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.08] px-4 py-3 md:px-6">
        {captchaKonfiguriert ? (
          <div className="mx-auto mb-2 w-full max-w-4xl">
            {captchaRequired && (
              <div>
                <TurnstileWidget
                  resetKey={captchaReset}
                  onVerify={(token) => {
                    setTurnstileToken(token);
                    setTurnstileStatusText(null);
                  }}
                  onExpire={() => captchaZuruecksetzen("Captcha abgelaufen. Bitte erneut bestätigen.")}
                  onError={() =>
                    captchaZuruecksetzen("Captcha konnte nicht geladen werden. Bitte erneut versuchen.")
                  }
                />
                {turnstileStatusText && <p className="mt-2 text-xs text-[#a3ad9a]">{turnstileStatusText}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto mb-2 w-full max-w-4xl rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-200">
            Turnstile ist nicht konfiguriert (NEXT_PUBLIC_TURNSTILE_SITE_KEY fehlt).
          </div>
        )}
        <div className="mx-auto flex w-full max-w-4xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Schreib deine Nachricht an Gürkchen …"
            rows={2}
            disabled={loading}
            inputMode="text"
            enterKeyHint="send"
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-base text-[#ede8d6] outline-none transition-colors placeholder:text-[#6b7565]/70 focus:border-[#8fa96d] disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || (captchaRequired && !turnstileToken)}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg bg-[#ede8d6] text-[#0b120d] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 "
            aria-label="Nachricht senden"
          >
            <PaperPlaneTilt size={20} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

function GurkchenQuoteCard({ isDemo = false }: { isDemo?: boolean }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <SektionTeaser
        icon={<Quotes size={40} weight="fill" className="text-[#8fa96d]" />}
        titel="Gürkchens Zitat"
        teaser="Lausche den heiligen Gurken-Weisheiten. Drei frische Zitate pro Tag, jedes gibt +5 Punkte."
        cta="Zitat anzeigen"
        onOpen={() => setOpen(true)}
      />
    );
  }

  return (
    <div className="card mb-5 p-6 text-center md:p-8">
      <SektionKopf
        icon={<Quotes size={22} weight="fill" className="text-[#8fa96d]" />}
        titel="Gürkchens Zitat"
        onClose={() => setOpen(false)}
      />
      <GurkchenQuote isDemo={isDemo} />
    </div>
  );
}

export function MitgliederDashboard({
  user,
  isDemo = false,
  punkteApiBase = "/api/mitglieder/punkte",
  onSignOut,
}: {
  user: MitgliedInfo;
  isDemo?: boolean;
  punkteApiBase?: string;
  onSignOut?: () => void;
}) {
  const email = user.primaryEmail ?? "unbekannt@sektenmitglied.de";

  return (
    <PunkteProvider apiBase={punkteApiBase}>
      <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-24 pt-12 md:pt-20">
        {isDemo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#c9a86a]/25 bg-[#c9a86a]/[0.06] px-4 py-3 text-sm text-[#e2d9bf]">
            <Flask size={20} weight="fill" className="mt-0.5 flex-shrink-0 text-[#c9a86a]" />
            <p>
              <strong>Demo-Modus:</strong> Du bist nicht eingeloggt — alle Funktionen sind frei
              testbar. Punkte werden nur für diese Demo gespeichert.
            </p>
          </div>
        )}

        <Reveal>
          <p className="eyebrow">Mitgliederbereich</p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
            Willkommen zurück, {user.displayName ?? "Gurkenfreund"}.
          </h1>
          <p className="tabular mt-3 text-sm text-[#6b7565]">{email}</p>
        </Reveal>

        <Reveal delay={1}>
          <div className="shell mt-8">
            <div className="core p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">🥒</span>
                <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
                  Dein spirituelles Dashboard
                </h2>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7565]">
                    <CalendarBlank size={14} />
                    Mitglied seit
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[#ede8d6]">
                    {user.signedUpAt
                      ? new Date(user.signedUpAt).toLocaleDateString("de-DE")
                      : "Urzeiten der Gurke"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7565]">
                    <ShieldCheck size={14} />
                    Status
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold text-[#ede8d6]">
                    Erleuchtet
                    <ShieldCheck size={16} weight="fill" className="text-[#8fa96d]" />
                  </p>
                </div>
              </div>

              <RangKopf />
            </div>
          </div>
        </Reveal>

        <div className="mt-5">
          <GurkchenChat isDemo={isDemo} />
        </div>

        <PunkteAnzeige />
        <Rangstufen />

        <ReferralBox code={user.id ?? (isDemo ? "demo-mitglied" : null)} isDemo={isDemo} />

        <GurkchenQuoteCard isDemo={isDemo} />

        <Reveal>
          <div className="mb-5">
            <Link
              href={isDemo ? demoPath("/mitglieder/casino") : "/mitglieder/casino"}
              className="shell group block"
            >
              <div className="core flex items-center gap-4 p-6 md:p-7">
                <DiceFive size={32} weight="fill" className="shrink-0 text-[#c9a86a]" />
                <div className="min-w-0 text-left">
                  <p className="font-display text-xl font-semibold text-[#faf8f1]">
                    Gurken Casino
                  </p>
                  <p className="mt-1 text-sm text-[#a3ad9a]">
                    Slots und Roulette gegen die Bank – reines Spielgeld.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </Reveal>

        <Reveal>
          <div className="mb-5">
            <Link
              href={isDemo ? demoPath("/mitglieder/duell") : "/mitglieder/duell"}
              className="shell group block"
            >
              <div className="core flex items-center gap-4 p-6 md:p-7">
                <Sword size={32} weight="fill" className="shrink-0 text-[#8fa96d]" />
                <div className="min-w-0 text-left">
                  <p className="font-display text-xl font-semibold text-[#faf8f1]">
                    Gurken Duell
                  </p>
                  <p className="mt-1 text-sm text-[#a3ad9a]">
                    Tic Tac Toe gegen echte Mitglieder – Einsatz setzen, Pot kassieren.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 text-center">
          {isDemo ? (
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
            >
              <ArrowLeft size={16} />
              Zur echten Gurken Sekte
            </Link>
          ) : (
            <button
              onClick={onSignOut}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
            >
              <SignOut size={16} />
              Ausloggen
            </button>
          )}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-[#4a5548]">
          <ChatCircleText size={15} />
          Gürkchen wacht über dein Glas.
        </div>
      </div>
    </PunkteProvider>
  );
}
