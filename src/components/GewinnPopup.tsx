"use client";

import { useEffect, useState } from "react";
import { Gift, Basket, Coins } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  TurnstileWidget,
  turnstileKonfiguriert,
} from "@/components/TurnstileWidget";
import { VERLOSUNG_PUNKTE_ALTERNATIVE } from "@/lib/verlosung";

type Treffer = {
  monat: string;
  meineLose: number;
  teilnehmer: number;
};

function monatsName(monat: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monat);
  if (!m) return monat;
  const name = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, 1),
  ).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const inputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d]";

/**
 * Gewinn-Popup: Wer die Monats-Verlosung gewonnen hat (Status offen), sieht
 * beim nächsten Besuch diese Karte – Tour-Optik wie Einleitung/Changelog.
 * Wahl: echte Gurke gratis (Adress-Flow wie beim Einlösen, ohne Abzug) oder
 * stattdessen +1.000 Punkte. "Später" schließt nur – der Gewinn wartet.
 * Nur für eingeloggte Mitglieder (kein Demo).
 */
export function GewinnPopup() {
  const { refresh } = usePunkte();
  const [treffer, setTreffer] = useState<Treffer | null>(null);
  const [ansicht, setAnsicht] = useState<"wahl" | "adresse" | "fertig">("wahl");
  const [fertigArt, setFertigArt] = useState<"gurke" | "punkte" | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [adresseForm, setAdresseForm] = useState({
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    land: "",
  });

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/verlosung");
        const data = await res.json().catch(() => ({}));
        if (
          aktiv &&
          res.ok &&
          data.ichGewinner === true &&
          data.status === "offen" &&
          typeof data.monat === "string"
        ) {
          setTreffer({
            monat: data.monat,
            meineLose:
              typeof data.meineLose === "number" ? data.meineLose : 0,
            teilnehmer:
              typeof data.teilnehmer === "number" ? data.teilnehmer : 0,
          });
        }
      } catch {
        // Fail-open: kein Gewinn-Popup, alles andere läuft.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  // Scroll sperren wie bei der Einleitung, solange die Karte offen ist.
  useEffect(() => {
    if (!treffer) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = vorher;
    };
  }, [treffer]);

  if (!treffer) return null;

  function setzeFeld(feld: keyof typeof adresseForm, wert: string) {
    setAdresseForm((prev) => ({ ...prev, [feld]: wert }));
  }

  async function punkteNehmen() {
    setArbeitet(true);
    setFehler(null);
    try {
      const res = await fetch("/api/verlosung/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ art: "punkte" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Einlösen fehlgeschlagen");
      setFertigArt("punkte");
      setAnsicht("fertig");
      await refresh().catch(() => {});
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Einlösen fehlgeschlagen");
    } finally {
      setArbeitet(false);
    }
  }

  async function gurkeBestellen(e: React.FormEvent) {
    e.preventDefault();
    const fehlt = (["name", "strasse", "plz", "ort"] as const).some(
      (feld) => !adresseForm[feld].trim(),
    );
    if (fehlt) {
      setFehler("Bitte fülle Name, Straße, PLZ und Ort aus.");
      return;
    }
    if (turnstileKonfiguriert() && !turnstileToken) {
      setFehler("Bitte löse zuerst das Captcha.");
      return;
    }
    setArbeitet(true);
    setFehler(null);
    try {
      const res = await fetch("/api/verlosung/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          art: "gurke",
          adresse: adresseForm,
          turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.requiresTurnstile) {
          setTurnstileToken(null);
          setCaptchaReset((n) => n + 1);
        }
        throw new Error(data.error ?? "Bestellung fehlgeschlagen");
      }
      setFertigArt("gurke");
      setAnsicht("fertig");
      await refresh().catch(() => {});
    } catch (err) {
      setFehler(
        err instanceof Error ? err.message : "Bestellung fehlgeschlagen",
      );
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <>
      <div className="tour-overlay" aria-hidden="true" />
      <div
        className="tour-karte"
        role="dialog"
        aria-modal="true"
        aria-label="Verlosungs-Gewinn"
      >
        <div className="rounded-2xl border border-[#c9a86a]/30 bg-[#101b14] px-5 py-5 text-center shadow-2xl md:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7565]">
            Verlosung {monatsName(treffer.monat)}
          </p>

          {ansicht === "fertig" ? (
            <div className="tour-balance mt-2">
              <span className="tour-gurke" aria-hidden="true">
                {fertigArt === "gurke" ? "📦" : "🎉"}
              </span>
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                {fertigArt === "gurke"
                  ? "Deine Gurke ist bestellt!"
                  : `+${VERLOSUNG_PUNKTE_ALTERNATIVE.toLocaleString("de-DE")} Punkte sind drauf!`}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3ad9a]">
                {fertigArt === "gurke"
                  ? "Gürkchen schickt sie dir persönlich per Post."
                  : "Gürkchen gratuliert. Weiter so im Glas."}
              </p>
              <button
                type="button"
                onClick={() => setTreffer(null)}
                className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
              >
                Zurück ins Glas
              </button>
            </div>
          ) : ansicht === "adresse" ? (
            <div className="tour-balance mt-2 text-left">
              <h2 className="font-display text-center text-2xl font-semibold text-[#faf8f1]">
                Wohin mit der Gurke?
              </h2>
              <p className="mt-1 text-center text-xs text-[#6b7565]">
                Gratis als Gewinn. Es werden keine Punkte abgezogen.
              </p>
              <form onSubmit={gurkeBestellen} className="mt-3 space-y-3">
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
                {turnstileKonfiguriert() && (
                  <TurnstileWidget
                    resetKey={captchaReset}
                    onVerify={(t) => {
                      setTurnstileToken(t);
                      setFehler(null);
                    }}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                  />
                )}
                {fehler && (
                  <p role="alert" className="text-xs font-semibold text-red-300">
                    {fehler}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={arbeitet}
                  className="btn-cta btn-cta-primary min-h-[52px] w-full !text-base disabled:opacity-50"
                >
                  <Basket size={18} weight="fill" />
                  {arbeitet ? "Wird bestellt …" : "Gurke gratis bestellen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnsicht("wahl");
                    setFehler(null);
                  }}
                  className="min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] transition-colors hover:text-[#a3ad9a]"
                >
                  ← Zurück zur Wahl
                </button>
              </form>
            </div>
          ) : (
            <div className="tour-balance mt-2">
              <span className="tour-gurke" aria-hidden="true">
                🏆
              </span>
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                Du hast gewonnen!
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3ad9a]">
                Das Los hat dich getroffen. Du hattest{" "}
                <strong className="text-[#e2d9bf]">
                  {treffer.meineLose} {treffer.meineLose === 1 ? "Los" : "Lose"}
                </strong>{" "}
                im Topf. Wähle deinen Gewinn:
              </p>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setFehler(null);
                    setAnsicht("adresse");
                  }}
                  className="btn-cta btn-cta-primary min-h-[52px] w-full !text-base"
                >
                  <Basket size={18} weight="fill" />
                  Echte Gurke gratis
                </button>
                <button
                  type="button"
                  onClick={punkteNehmen}
                  disabled={arbeitet}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border border-white/12 px-5 py-3 text-[15px] font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                >
                  <Coins size={18} weight="fill" className="text-[#c9a86a]" />
                  {arbeitet
                    ? "Wird gutgeschrieben …"
                    : `Stattdessen +${VERLOSUNG_PUNKTE_ALTERNATIVE.toLocaleString("de-DE")} Punkte`}
                </button>
              </div>
              {fehler && (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-300">
                  {fehler}
                </p>
              )}
              <button
                type="button"
                onClick={() => setTreffer(null)}
                className="mt-3 min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] transition-colors hover:text-[#a3ad9a]"
              >
                Später entscheiden
              </button>
            </div>
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#4a5548]">
            <Gift size={13} />
            Bonus holen heißt Lose sammeln
          </p>
        </div>
      </div>
    </>
  );
}
