"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { PunkteProvider, usePunkte } from "@/components/PunkteContext";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { Leaderboard } from "@/components/Leaderboard";
import { AppKachel } from "@/components/AppKachel";
import { Popup } from "@/components/Popup";
import { Rangstufen } from "@/components/Rangstufen";
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
  ChatCircleText,
  ArrowsInSimple,
  Coins,
  Gift,
  Basket,
  ClockCounterClockwise,
  Flask,
  ArrowLeft,
  Quotes,
  DiceFive,
  Sword,
  EnvelopeSimple,
  GearSix,
  Check,
  Lock,
} from "@phosphor-icons/react";
import { demoPath } from "@/lib/demo";
import { adresseFormatieren } from "@/lib/bestellung";
import { tagesBegruessung } from "@/lib/guerkchenStimmung";
import { TagesLiturgie } from "@/components/TagesLiturgie";
import {
  ChangelogButton,
  ChangelogPopup,
} from "@/components/ChangelogPopup";
import { GewinnPopup } from "@/components/GewinnPopup";
import {
  EinfuehrungsTour,
  TOUR_CHAT_ANTWORT,
  TOUR_CHAT_NACHRICHT,
} from "@/components/EinfuehrungsTour";

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

const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Wochen-Streak oben: 7 Tage (Mo–So) im Blick, bei 7/7 +100 Bonus. */
function WochenStreak() {
  const { wochenTage, wochenBonusGeholt, loading } = usePunkte();
  const [heuteIndex, setHeuteIndex] = useState(-1);
  useEffect(() => {
    setHeuteIndex((new Date().getDay() + 6) % 7);
  }, []);
  if (loading) return null;

  const geholt = wochenTage.filter(Boolean).length;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#ede8d6]">
          Wochen-Streak
        </h3>
        <span className="tabular text-[11px] font-semibold text-[#6b7565]">
          {geholt}/7{wochenBonusGeholt ? " · +100 gesichert!" : " · 7/7 = +100"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5" role="list" aria-label="Tage dieser Woche">
        {WOCHENTAGE_KURZ.map((tag, i) => {
          const done = wochenTage[i] === true;
          const istHeute = i === heuteIndex;
          const verpasst = !done && heuteIndex >= 0 && i < heuteIndex;
          return (
            <div
              key={tag}
              role="listitem"
              aria-label={`${tag}: ${done ? "abgeholt" : verpasst ? "verpasst" : istHeute ? "heute offen" : "offen"}`}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 ${
                done
                  ? "border-[#8fa96d]/40 bg-[#8fa96d]/[0.1]"
                  : istHeute
                    ? "motion-safe:animate-pulse border-[#c9a86a]/50 bg-[#c9a86a]/[0.06]"
                    : "border-white/[0.07]"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7565]">
                {tag}
              </span>
              {done ? (
                <Check size={15} weight="bold" className="text-[#8fa96d]" />
              ) : (
                <span
                  className={`h-[15px] w-[15px] rounded-full border ${
                    verpasst ? "border-red-300/40" : "border-white/15"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Streak angeben: WhatsApp + Kopieren, mit Werbe-Link wenn bekannt. */
function StreakTeilen({
  streak,
  code = null,
}: {
  streak: number;
  code?: string | null;
}) {
  const [kopiert, setKopiert] = useState(false);
  if (streak < 2) return null;

  function link(): string {
    const origin = window.location.origin;
    return code ? `${origin}/?ref=${encodeURIComponent(code)}` : `${origin}/`;
  }
  function text(): string {
    return `Ich bin Tag ${streak} im Glas der Gurken Sekte. Schaffst du das auch? ${link()}`;
  }
  function kopieren() {
    const t = text();
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      navigator.clipboard.writeText(t).catch(() => {});
    }
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 2000);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-[#6b7565]">
        Serie {streak} teilen:
      </span>
      <button
        type="button"
        onClick={() =>
          window.open(
            `https://wa.me/?text=${encodeURIComponent(text())}`,
            "_blank",
            "noopener,noreferrer",
          )
        }
        className="flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
      >
        Per WhatsApp angeben
      </button>
      <button
        type="button"
        onClick={kopieren}
        className="flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
      >
        {kopiert ? "Kopiert!" : "Text kopieren"}
      </button>
    </div>
  );
}

/** Monats-Verlosung: jeder Daily-Tag ist 1 Los (Ziehung manuell, 1. des Folgemonats). */
function VerlosungsBanner() {
  const [monat, setMonat] = useState("");
  const [ziehung, setZiehung] = useState("");
  useEffect(() => {
    const jetzt = new Date();
    setMonat(
      jetzt.toLocaleDateString("de-DE", { month: "long" }),
    );
    setZiehung(
      new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 1).toLocaleDateString(
        "de-DE",
        { day: "numeric", month: "long" },
      ),
    );
  }, []);
  if (!monat) return null;
  return (
    <div className="mt-3 rounded-2xl border border-[#c9a86a]/25 bg-[#c9a86a]/[0.05] px-5 py-3.5 text-center">
      <p className="text-[13px] leading-relaxed text-[#a3ad9a]">
        <strong className="text-[#e2d9bf]">
          {monat}-Verlosung:
        </strong>{" "}
        Jeder abgeholte Tages-Bonus ist 1 Los. Zu gewinnen gibt es eine{" "}
        <strong className="text-[#ede8d6]">echte Gurke</strong>. Der Gewinner
        wird automatisch gezogen, per Popup benachrichtigt und wählt: Gurke
        gratis oder +1.000 Punkte. Ziehung am {ziehung}.
      </p>
    </div>
  );
}

const GLAS_MEILENSTEINE = [100, 250, 500, 1000];

/** Mein Glas: Meilensteine + gesammelte Zitate (Sunk Cost zum Wiederkommen). */
function MeinGlas({
  sammlung,
  punkteGesamt,
}: {
  sammlung: string[];
  punkteGesamt: number;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#ede8d6]">Mein Glas</h3>
        <span className="tabular text-[11px] font-semibold text-[#6b7565]">
          {sammlung.length}/10 Zitate
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GLAS_MEILENSTEINE.map((m) => {
          const erreicht = punkteGesamt >= m;
          return (
            <span
              key={m}
              className={`tabular inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                erreicht
                  ? "border-[#8fa96d]/30 bg-[#8fa96d]/[0.07] text-[#abc189]"
                  : "border-white/10 text-[#6b7565]"
              }`}
            >
              {erreicht ? <Check size={12} weight="bold" /> : <Lock size={11} weight="bold" />}
              {m === 1000 ? "Gurke" : m}
            </span>
          );
        })}
      </div>
      {sammlung.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[#6b7565]">
          Noch leer. Generiere dein erstes Zitat, es landet hier im Glas.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {sammlung.map((zitat, i) => (
            <li
              key={`${i}-${zitat.slice(0, 12)}`}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] italic leading-relaxed text-[#cfc8b0]"
            >
              „{zitat}“
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PunkteInhalt({ code = null }: { code?: string | null } = {}) {
  const {
    punkte,
    punkteGesamt,
    loading,
    dailyAvailable,
    verlauf,
    refresh,
    claim,
    gurkenAdresse,
    streakAktuell,
    streakBest,
    bonusHeute,
    comebackMoeglich,
    freezeVerfuegbar,
    letzterExtra,
    sammlung,
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
            <p className="tabular mt-1 text-xl font-semibold text-[#ede8d6]">
              +{bonusHeute}
            </p>
            <p className="tabular mt-0.5 text-xs text-[#6b7565]">
              {streakAktuell > 0 ? (
                <>
                  Serie {streakAktuell} {streakAktuell === 1 ? "Tag" : "Tage"}
                  {streakBest > 0 ? `, Rekord ${streakBest}` : ""}.{" "}
                  {dailyAvailable
                    ? comebackMoeglich
                      ? "Comeback +50 inklusive, heute abholen."
                      : "Heute abholen, morgen weiter."
                    : letzterExtra === "comeback"
                      ? "Willkommen zurück im Glas!"
                      : letzterExtra === "freeze"
                        ? "Verzeih-Tag hat die Serie gerettet."
                        : letzterExtra === "wochenbonus"
                          ? "Wochenbonus +100. Starke Woche!"
                          : "Morgen weiter."}
                </>
              ) : (
                <>
                  {dailyAvailable
                    ? comebackMoeglich
                      ? "Comeback: +50 extra für deine Rückkehr!"
                      : "Täglich abholen, alle 7 Tage +50."
                    : "Morgen geht die Serie los."}
                </>
              )}
            </p>
            {dailyAvailable && (
              <p className="mt-1 text-[11px] text-[#6b7565]">
                {freezeVerfuegbar
                  ? "Verzeih-Tag bereit: 1 verpasster Tag pro Woche bricht die Serie nicht."
                  : "Verzeih-Tag verbraucht. Nächste Woche gibt es einen neuen."}
              </p>
            )}
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
            <li>GurkenMail versenden: +10</li>
            <li>GurkenMail empfangen: +5 (max. 2/Stunde)</li>
            <li>Täglicher Bonus: +20, alle 7 Tage in Folge +50</li>
            <li>Wochenbonus (7/7 Tage): +100</li>
            <li>
              Freund werben: +150
            </li>
          </ul>
        </div>
      </div>

      <StreakTeilen streak={streakAktuell} code={code} />
      <VerlosungsBanner />
      <MeinGlas sammlung={sammlung} punkteGesamt={punkteGesamt} />

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

function PunkteAnzeige({
  externOffen = null,
  onExternOffenChange,
  code = null,
}: {
  externOffen?: boolean | null;
  onExternOffenChange?: (offen: boolean) => void;
  code?: string | null;
} = {}) {
  const [innenOffen, setInnenOffen] = useState(false);
  const open = externOffen ?? innenOffen;
  function setOpen(offen: boolean) {
    if (externOffen !== null && externOffen !== undefined) {
      onExternOffenChange?.(offen);
    } else {
      setInnenOffen(offen);
    }
  }
  const { punkte } = usePunkte();

  if (!open) {
    return (
      <AppKachel
        icon={<Coins size={44} weight="fill" className="text-[#c9a86a]" />}
        titel="Punkte"
        hinweis={`${punkte.toLocaleString("de-DE")} auf dem Konto`}
        index={1}
        onOpen={() => setOpen(true)}
      />
    );
  }

  return (
    <Popup
      titel="Punkte und Belohnungen"
      icon={<Coins size={22} weight="fill" className="text-[#c9a86a]" />}
      onClose={() => setOpen(false)}
    >
      <PunkteInhalt code={code} />
    </Popup>
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
    // Mit Captcha-Pflicht kein Auto-Start: erst Captcha lösen, dann Button
    // klicken – sonst löst ein (ggf. automatisches) Captcha direkt das
    // nächste Zitat aus und man kann es nicht lesen.
    if (turnstileKonfiguriert()) return;
    fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {loading ? (
        <div className="shimmer mx-auto h-16 max-w-md rounded-xl" aria-busy="true" />
      ) : (
        <blockquote className="font-display mx-auto min-h-[3rem] max-w-xl text-xl italic leading-relaxed text-[#ede8d6]">
          {quote ? `„${quote}“` : "Löse das Captcha und tippe auf „Neues Zitat“."}
        </blockquote>
      )}
      {quote && !loading && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`„${quote}“ - Gürkchen (Gurken Sekte ${typeof window !== "undefined" ? window.location.origin : "https://gurkensekte.de"}/)`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            Per WhatsApp teilen
          </a>
          <button
            type="button"
            onClick={() => {
              const text = `„${quote}“ - Gürkchen (Gurken Sekte)`;
              if (navigator.share) {
                navigator.share({ text }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(text).catch(() => {});
              }
            }}
            className="flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            Kopieren / Teilen
          </button>
        </div>
      )}
      {captchaPflicht && (
        <div className="mx-auto mb-3 mt-4 max-w-md text-left">
          <TurnstileWidget
            resetKey={captchaReset}
            onVerify={(token) => {
              setTurnstileToken(token);
              setCaptchaHinweis("Captcha gelöst – tippe jetzt auf „Neues Zitat“.");
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
          disabled={loading || !quoteAvailable || (captchaPflicht && !turnstileToken)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-[#ede8d6] px-6 py-2.5 text-sm font-semibold text-[#0b120d] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 "
          title={captchaPflicht && !turnstileToken ? "Bitte zuerst das Captcha lösen" : undefined}
        >
          <Quotes size={17} weight="fill" />
          {quoteAvailable ? "Neues Zitat" : "Morgen wieder"}
        </button>
        <p className="tabular text-xs text-[#6b7565]">Heute noch verfügbar: {quoteRemaining} / 3</p>
      </div>
    </div>
  );
}

export type TourChatDemo = {
  nachricht: string;
  antwort: string;
};

function GurkchenChat({
  isDemo = false,
  tourDemo = null,
  externOffen = null,
  onExternOffenChange,
  onTourDemoFertig,
}: {
  isDemo?: boolean;
  /** Tour-Demo: vorbereitete Nachricht + hartcodierte Antwort, ohne API/Captcha/Punkte. */
  tourDemo?: TourChatDemo | null;
  /** Gesteuertes Öffnen für die Einführungs-Tour (null = unkontrolliert). */
  externOffen?: boolean | null;
  onExternOffenChange?: (offen: boolean) => void;
  /** Wird aufgerufen, sobald die Tour-Demo-Antwort fertig getippt ist. */
  onTourDemoFertig?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "assistant",
      content: tagesBegruessung(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [innenOffen, setInnenOffen] = useState(false);
  const open = externOffen ?? innenOffen;
  function setOpen(offen: boolean) {
    if (externOffen !== null && externOffen !== undefined) {
      onExternOffenChange?.(offen);
    } else {
      setInnenOffen(offen);
    }
  }
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

  // Tour-Demo: vorbereitete Nachricht sofort, hartcodierte Antwort mit
  // Chat-Verzögerung (getippt statt gestreamt) – kein API-Call, kein
  // Turnstile, keine Punkte. Einmalig pro Mount; alle State-Updates laufen
  // in Timern (kein sync setState im Effekt-Body).
  const tourGespieltRef = useRef(false);
  useEffect(() => {
    if (!tourDemo || !open || tourGespieltRef.current) return;
    tourGespieltRef.current = true;
    const demo = tourDemo;
    const timer: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>> = [];
    const start = setTimeout(() => {
      setLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: demo.nachricht }]);
      const tippTimer = setTimeout(() => {
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        const voll = demo.antwort;
        let i = 0;
        const schrittWeite = Math.max(1, Math.ceil(voll.length / 60));
        const ticker = setInterval(() => {
          i += schrittWeite;
          const teil = voll.slice(0, i);
          setMessages((prev) => {
            const aktualisiert = [...prev];
            aktualisiert[aktualisiert.length - 1] = { role: "assistant", content: teil };
            return aktualisiert;
          });
          if (i >= voll.length) {
            clearInterval(ticker);
            setLoading(false);
            onTourDemoFertig?.();
          }
        }, 30);
        timer.push(ticker);
      }, 1400);
      timer.push(tippTimer);
    }, 50);
    timer.push(start);
    return () => {
      for (const t of timer) {
        clearTimeout(t as ReturnType<typeof setTimeout>);
        clearInterval(t as ReturnType<typeof setInterval>);
      }
    };
    // onTourDemoFertig ist ein reiner Event-Dispatch (stabil per Vertrag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourDemo, open]);

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

    // Stall-Erkennung: Kommen 5 s lang keine neuen Inhalte, wird der
    // Stream abgebrochen und eine Fehlermeldung gezeigt (statt einer leeren
    // Blase). Die nächste Nachricht bleibt normal schickbar (loading=false,
    // frisches Captcha) – und Punkte gibt es nur bei echter Antwort, denn
    // der Server bucht ebenfalls nur bei LLM-Erfolg.
    const STALL_MS = 5000;
    const STALL_TEXT =
      "Gürkchen antwortet gerade nicht – versuch es gleich nochmal. 🥒";

    function ersetzeLetzteBlase(text: string) {
      setMessages((prev) => {
        const aktualisiert = [...prev];
        aktualisiert[aktualisiert.length - 1] = { role: "assistant", content: text };
        return aktualisiert;
      });
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
      // Nur bei echter Antwort gibt es Punkte (Server bucht ebenfalls nur
      // bei LLM-Erfolg).
      let erfolg = false;

      if (contentType.includes("text/plain") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        let fullContent = "";
        let letzterChunk = Date.now();
        let abgebrochen = false;
        const stallTimer = setInterval(() => {
          if (Date.now() - letzterChunk > STALL_MS) {
            abgebrochen = true;
            reader.cancel().catch(() => {
              // ignore
            });
            clearInterval(stallTimer);
          }
        }, 1000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || abgebrochen) break;
            const stueck = decoder.decode(value, { stream: true });
            if (!stueck) continue;
            letzterChunk = Date.now();
            fullContent += stueck;
            ersetzeLetzteBlase(fullContent);
          }
        } finally {
          clearInterval(stallTimer);
        }

        if (abgebrochen || !fullContent.trim()) {
          // Leere/hängende Antwort: leere Blase durch Fehlermeldung ersetzen.
          ersetzeLetzteBlase(STALL_TEXT);
        } else {
          erfolg = true;
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { reply?: unknown };
        const text = typeof data.reply === "string" ? data.reply.trim() : "";
        if (text) {
          setMessages((prev) => [...prev, { role: "assistant", content: text }]);
          erfolg = true;
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: STALL_TEXT }]);
        }
      }

      // Die +5 Chat-Punkte schreibt /api/guerkchen direkt gut (frisches
      // Captcha pro Nachricht) – aber nur bei Erfolg. Die Demo braucht
      // ihren separaten Demo-Claim – die frische IP-Sitzung aus dem Chat
      // genügt ihm.
      if (erfolg) {
        if (isDemo) {
          claim("chat");
        }
        refresh();
      }
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
      <AppKachel
        icon={<SpinningCucumber size="text-5xl" />}
        titel="Chat"
        hinweis="Frag das Einlegeglas"
        index={0}
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
              {msg.role === "assistant" ? (
                <ChatMarkdown text={msg.content} />
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>
              )}
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
        {tourDemo ? (
          <p className="mx-auto w-full max-w-4xl rounded-xl border border-[#8fa96d]/25 bg-[#8fa96d]/[0.06] px-3 py-2 text-center text-xs text-[#a3ad9a]">
            🥒 Tour-Demo – gleich chattest du echt (mit Captcha & +5 Punkten pro Nachricht).
          </p>
        ) : captchaKonfiguriert ? (
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
            placeholder={
              tourDemo
                ? "Tour-Demo – schließen und später echt chatten …"
                : "Schreib deine Nachricht an Gürkchen …"
            }
            rows={2}
            disabled={loading || !!tourDemo}
            inputMode="text"
            enterKeyHint="send"
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-base text-[#ede8d6] outline-none transition-colors placeholder:text-[#6b7565]/70 focus:border-[#8fa96d] disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !!tourDemo || !input.trim() || (captchaRequired && !turnstileToken)}
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
  const { quoteRemaining } = usePunkte();

  if (!open) {
    return (
      <AppKachel
        icon={<Quotes size={44} weight="fill" className="text-[#8fa96d]" />}
        titel="Zitat"
        hinweis={`Noch ${quoteRemaining}/3 heute`}
        index={2}
        onOpen={() => setOpen(true)}
      />
    );
  }

  return (
    <Popup
      titel="Gürkchens Zitat"
      icon={<Quotes size={22} weight="fill" className="text-[#8fa96d]" />}
      onClose={() => setOpen(false)}
    >
      <GurkchenQuote isDemo={isDemo} />
    </Popup>
  );
}

/** GurkenMail-Kachel mit Ungelesen-Badge (echte Zahl aus dem Postfach). */
function GurkenMailKachel({ isDemo = false }: { isDemo?: boolean }) {
  const [ungelesen, setUngelesen] = useState(0);

  useEffect(() => {
    if (isDemo) return;
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/gurkenmail/unread");
        const data = await res.json().catch(() => ({}));
        if (aktiv && res.ok && typeof data.ungelesen === "number") {
          setUngelesen(data.ungelesen);
        }
      } catch {
        // Fail-open: Kachel bleibt ohne Badge nutzbar.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [isDemo]);

  return (
    <AppKachel
      icon={<EnvelopeSimple size={44} weight="fill" className="text-[#8fa96d]" />}
      titel="GurkenMail"
      hinweis={
        ungelesen > 0
          ? `${ungelesen} ungelesen · 3× schreiben/Tag`
          : "3× schreiben/Tag · Empfang frei"
      }
      badge={ungelesen}
      index={7}
      href={isDemo ? demoPath("/mitglieder/gurkenmail") : "/mitglieder/gurkenmail"}
    />
  );
}

export function MitgliederDashboard({  user,
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
  const [benutzername, setBenutzername] = useState<string | null>(null);
  // Einführungs-Tour: gesteuertes Öffnen von Chat & Punkten (null = normal).
  const [tourChatOffen, setTourChatOffen] = useState<boolean | null>(null);
  const [tourPunkteOffen, setTourPunkteOffen] = useState<boolean | null>(null);
  const tourAktiv = tourChatOffen !== null || tourPunkteOffen !== null;

  // Benutzername sofort übernehmen, wenn das Gate ihn vergibt (ohne Reload
  // startet dadurch auch die Einführungs-Tour).
  useEffect(() => {
    if (isDemo) return;
    function onName(e: Event) {
      const name = (e as CustomEvent<string>).detail;
      if (typeof name === "string" && name) setBenutzername(name);
    }
    window.addEventListener("gurke:benutzername-gesetzt", onName);
    return () => window.removeEventListener("gurke:benutzername-gesetzt", onName);
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return;
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/mitglieder/benutzername");
        const data = await res.json().catch(() => ({}));
        if (aktiv && typeof data.benutzername === "string") {
          setBenutzername(data.benutzername);
        }
      } catch {
        // Fail-open: Dashboard bleibt nutzbar.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [isDemo]);

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
          {!isDemo && benutzername && (
            <p className="mt-1 text-sm text-[#a3ad9a]">
              <span className="font-semibold text-[#ede8d6]">@{benutzername}</span>{" "}
              <Link
                href="/mitglieder/einstellungen"
                className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
              >
                Einstellungen
              </Link>
            </p>
          )}
        </Reveal>

        {/* Wochen-Streak oben: 7 Tage (Mo–So) im Blick. */}
        <div className="mt-5">
          <WochenStreak />
        </div>

        {/* Tagesliturgie: kleine Rituale aus Bestand statt neuer Features. */}
        <div className="mt-5 space-y-3">
          <TagesLiturgie />
        </div>

        {/* App-Raster: zwei Kacheln pro Zeile wie auf einem Handy-Screen. */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div data-tour-ziel="chat" className="contents">
            <GurkchenChat
              isDemo={isDemo}
              tourDemo={
                tourAktiv
                  ? { nachricht: TOUR_CHAT_NACHRICHT, antwort: TOUR_CHAT_ANTWORT }
                  : null
              }
              externOffen={tourChatOffen}
              onExternOffenChange={(offen) => setTourChatOffen(offen ? true : null)}
              onTourDemoFertig={() => window.dispatchEvent(new Event("gurke:tour-chat-fertig"))}
            />
          </div>

          <div data-tour-ziel="punkte" className="contents">
            <PunkteAnzeige
              externOffen={tourPunkteOffen}
              onExternOffenChange={(offen) => setTourPunkteOffen(offen ? true : null)}
              code={isDemo ? null : (user.id ?? null)}
            />
          </div>
          <Rangstufen />

          <ReferralBox code={user.id ?? (isDemo ? "demo-mitglied" : null)} isDemo={isDemo} />

          <GurkchenQuoteCard isDemo={isDemo} />

          <div data-tour-ziel="casino" className="contents">
            <AppKachel
              icon={<DiceFive size={44} weight="fill" className="text-[#c9a86a]" />}
              titel="Casino"
              hinweis="Slots & Roulette"
              index={5}
              href={isDemo ? demoPath("/mitglieder/casino") : "/mitglieder/casino"}
            />
          </div>

          <AppKachel
            icon={<Sword size={44} weight="fill" className="text-[#8fa96d]" />}
            titel="Duell"
            hinweis="Tic Tac Toe live"
            index={6}
            href={isDemo ? demoPath("/mitglieder/duell") : "/mitglieder/duell"}
          />

          <div data-tour-ziel="gurkenmail" className="contents">
            <GurkenMailKachel isDemo={isDemo} />
          </div>

          {!isDemo && (
            <AppKachel
              icon={<GearSix size={44} weight="fill" className="text-[#a3ad9a]" />}
              titel="Einstellungen"
              hinweis="Name, Passkey, MFA & mehr"
              index={8}
              href="/mitglieder/einstellungen"
            />
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-center">
          {isDemo ? (
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
            >
              <ArrowLeft size={16} />
              Zur echten Gurken Sekte
            </Link>
          ) : (
            <>
              <ChangelogButton />
              <button
                onClick={onSignOut}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
              >
                <SignOut size={16} />
                Ausloggen
              </button>
            </>
          )}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-[#4a5548]">
          <ChatCircleText size={15} />
          Gürkchen wacht über dein Glas.
        </div>

        {!isDemo && (
          <EinfuehrungsTour
            user={user}
            benutzername={benutzername}
            chatOffen={tourChatOffen}
            onChatOffen={setTourChatOffen}
            punkteOffen={tourPunkteOffen}
            onPunkteOffen={setTourPunkteOffen}
          />
        )}

        {/* Neuigkeiten nur für eingeloggte Mitglieder (kein Demo, keine Landing). */}
        {!isDemo && <ChangelogPopup />}

        {/* Gewinn-Popup der Monats-Verlosung (nur echt, kein Demo). */}
        {!isDemo && <GewinnPopup />}
      </div>
    </PunkteProvider>
  );
}
