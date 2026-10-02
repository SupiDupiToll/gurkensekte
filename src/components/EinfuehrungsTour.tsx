"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@hexclave/next";
import { usePunkte } from "@/components/PunkteContext";
import { normalisiereDisplayName } from "@/lib/gurkenmail";
import {
  istTourUeberspringbar,
  type TourSchritt,
} from "@/lib/tour";
import type { MitgliedInfo } from "@/components/MitgliederDashboard";
import "./EinfuehrungsTour.css";

/**
 * Einführungs-Tour („Setup") direkt nach dem Benutzernamen-Gate:
 * Gurke → Chat (Skript-Demo) → Punkte (Daily + Rangliste) → Casino
 * (nur zeigen) → GurkenMail (Name + Auto-Adresse) → Fertig.
 * Fortschritt liegt serverseitig (`/api/mitglieder/tour`), Konten älter als
 * 24 h dürfen überspringen.
 */

export const TOUR_CHAT_NACHRICHT = "Hallo Gürkchen! Was kannst du eigentlich alles?";
export const TOUR_CHAT_ANTWORT =
  "Sei gegrüßt, frisches Gurken-Kind! 🥒 Ich beantworte deine Fragen rund um die Sekte, schenke dir jeden Tag ein Zitat (+5 Punkte) und für jede echte Nachricht bekommst du +5 Punkte. Sammle 1.000 Punkte und es gibt eine echte Salatgurke per Post – das hier war nur die Tour-Demo, gleich chattest du echt!";

const SCHRITT_TITEL: Record<TourSchritt, string> = {
  gurke: "Dein Ziel: echte Gurke",
  chat: "Lerne Gürkchen kennen",
  punkte: "Deine Punkte",
  casino: "Das Casino",
  mail: "Deine GurkenMail",
  fertig: "Eingelegt! 🥒",
};

const SCHRITT_INDEX: Record<TourSchritt, number> = {
  gurke: 0,
  chat: 1,
  punkte: 2,
  casino: 3,
  mail: 4,
  fertig: 5,
};

type HexUserMitUpdate = {
  displayName?: string | null;
  update?: (daten: { displayName: string }) => Promise<unknown>;
};

async function speichereTour(
  daten: { schritt?: TourSchritt; abgeschlossen?: boolean; abgebrochen?: boolean },
): Promise<void> {
  try {
    await fetch("/api/mitglieder/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(daten),
    });
  } catch {
    // Fail-open: Tour läuft lokal weiter, der Server-Stand holt auf.
  }
}

function kartenKlasse(extra = "") {
  return `rounded-2xl border border-white/10 bg-[#101b14] px-5 py-5 shadow-2xl md:px-6 ${extra}`;
}

function Fortschritt({ schritt }: { schritt: TourSchritt }) {
  const aktiv = SCHRITT_INDEX[schritt];
  return (
    <div className="tour-fortschritt" aria-label={`Schritt ${aktiv + 1} von 6`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={i <= aktiv ? "aktiv" : ""} />
      ))}
    </div>
  );
}

export function EinfuehrungsTour({
  user,
  benutzername,
  chatOffen,
  onChatOffen,
  punkteOffen,
  onPunkteOffen,
}: {
  user: MitgliedInfo;
  benutzername: string | null;
  chatOffen: boolean | null;
  onChatOffen: (offen: boolean | null) => void;
  punkteOffen: boolean | null;
  onPunkteOffen: (offen: boolean | null) => void;
}) {
  const hexUser = (useUser() ?? {}) as HexUserMitUpdate;
  const { dailyAvailable, refresh } = usePunkte();
  const [laden, setLaden] = useState(true);
  const [sichtbar, setSichtbar] = useState(false);
  const [schritt, setSchritt] = useState<TourSchritt>("gurke");
  const [mailName, setMailName] = useState("");
  const [mailFehler, setMailFehler] = useState<string | null>(null);
  const [mailArbeitet, setMailArbeitet] = useState(false);
  const [mailAdresse, setMailAdresse] = useState<string | null>(null);
  const [mailPrueft, setMailPrueft] = useState(false);
  const nameVorbelegt = useRef(false);

  const ueberspringbar = istTourUeberspringbar(user.signedUpAt);
  const chatWarOffen = useRef(false);

  // Chat-Demo geschlossen → automatisch weiter zu den Punkten.
  useEffect(() => {
    if (schritt !== "chat") return;
    if (chatOffen) {
      chatWarOffen.current = true;
      return;
    }
    if (chatWarOffen.current) {
      chatWarOffen.current = false;
      setSchritt("punkte");
      void speichereTour({ schritt: "punkte" });
    }
  }, [schritt, chatOffen]);

  // Start: Server-Status laden. Abgeschlossen → nie zeigen. Ohne
  // Benutzernamen → nicht starten (BenutzernameGate ist zuständig).
  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/mitglieder/tour");
        const data = await res.json().catch(() => ({}));
        if (!aktiv) return;
        const tour = data.tour as
          | { abgeschlossen?: boolean; schritt?: TourSchritt }
          | undefined;
        if (tour?.abgeschlossen) {
          setSichtbar(false);
        } else if (benutzername) {
          if (
            tour?.schritt === "gurke" ||
            tour?.schritt === "chat" ||
            tour?.schritt === "punkte" ||
            tour?.schritt === "casino" ||
            tour?.schritt === "mail" ||
            tour?.schritt === "fertig"
          ) {
            setSchritt(tour.schritt);
          }
          setSichtbar(true);
        }
      } catch {
        // Fail-open: bei Netzfehler Tour anbieten statt blockieren.
        if (benutzername) setSichtbar(true);
      } finally {
        if (aktiv) setLaden(false);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [benutzername]);

  const weiter = useCallback(
    (naechster: TourSchritt) => {
      setSchritt(naechster);
      void speichereTour({ schritt: naechster });
    },
    [],
  );

  async function ueberspringen() {
    setSichtbar(false);
    await speichereTour({ abgeschlossen: true, abgebrochen: true });
  }

  async function abschliessen() {
    setSichtbar(false);
    onChatOffen(null);
    onPunkteOffen(null);
    await speichereTour({ schritt: "fertig", abgeschlossen: true });
    await refresh().catch(() => {});
  }

  // Spotlight: Ziel in den Blick scrollen + pulsierenden Ring setzen.
  // (Wrapper sind display:contents – der Ring landet auf der Kachel selbst.)
  useEffect(() => {
    document.querySelectorAll(".tour-ziel-aktiv").forEach((el) => {
      el.classList.remove("tour-ziel-aktiv");
    });
    if (!sichtbar) {
      document.body.removeAttribute("data-tour-schritt");
      return;
    }
    if (schritt === "chat" && chatOffen) return; // Demo-Chat ist offen
    const ziel =
      schritt === "chat"
        ? "chat"
        : schritt === "punkte"
          ? "punkte"
          : schritt === "casino"
            ? "casino"
            : schritt === "mail"
              ? "gurkenmail"
              : null;
    document.body.setAttribute("data-tour-schritt", schritt);
    if (!ziel) return;
    const wrapper = document.querySelector(`[data-tour-ziel="${ziel}"]`);
    const kachel = wrapper?.firstElementChild ?? wrapper;
    kachel?.scrollIntoView({ behavior: "smooth", block: "center" });
    kachel?.classList.add("tour-ziel-aktiv");
    return () => {
      kachel?.classList.remove("tour-ziel-aktiv");
    };
  }, [sichtbar, schritt, chatOffen]);

  // Body-Scroll sperren, solange eine modale Tour-Karte offen ist.
  useEffect(() => {
    if (!sichtbar) return;
    if (schritt === "punkte" && punkteOffen) return; // Hinweis, Popup bleibt bedienbar
    if (schritt === "chat" && chatOffen) return; // Demo-Chat läuft
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = vorher;
    };
  }, [sichtbar, schritt, chatOffen, punkteOffen]);

  // Mail-Schritt: Name vorbelegen + prüfen, ob schon ein Postfach existiert.
  useEffect(() => {
    if (!sichtbar || schritt !== "mail" || mailAdresse) return;
    if (!nameVorbelegt.current) {
      nameVorbelegt.current = true;
      const start =
        (typeof hexUser.displayName === "string" && hexUser.displayName.trim()) ||
        benutzername ||
        "";
      setMailName(start.slice(0, 40));
      setMailPrueft(true);
      (async () => {
        try {
          const res = await fetch("/api/gurkenmail/mailbox");
          const data = await res.json().catch(() => ({}));
          if (data?.mailbox?.address) setMailAdresse(data.mailbox.address);
        } catch {
          // Fail-open: Anlage-Formular bleibt nutzbar.
        } finally {
          setMailPrueft(false);
        }
      })();
    }
  }, [sichtbar, schritt, mailAdresse, hexUser.displayName, benutzername]);

  if (laden || !sichtbar || !benutzername) return null;

  const schrittNr = SCHRITT_INDEX[schritt] + 1;

  async function mailAnlegen(e: React.FormEvent) {
    e.preventDefault();
    const name = mailName.trim().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
    if (!normalisiereDisplayName(name)) {
      setMailFehler("Absendername ungültig: 2–40 Zeichen, bitte einen echten Namen (keine E-Mail-Adresse).");
      return;
    }
    setMailArbeitet(true);
    setMailFehler(null);
    try {
      // 1) Anzeigename in Hexclave setzen (wird überall gegrüßt).
      try {
        await hexUser.update?.({ displayName: name.slice(0, 100) });
      } catch {
        // Fail-open: Mailbox-Anlage läuft trotzdem.
      }
      // 2) Adresse = Benutzername, keine Abfrage. Bei Kollision automatisch
      // Zahl anhängen (benutzername2, benutzername3, …).
      const kandidaten = [benutzername];
      for (let n = 2; n <= 9; n++) kandidaten.push(`${benutzername}${n}`);
      let angelegt: { address: string } | null = null;
      let letzterFehler = "Konnte Adresse nicht anlegen.";
      for (const lokal of kandidaten) {
        const res = await fetch("/api/gurkenmail/mailbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localpart: lokal, displayName: name.slice(0, 40) }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.mailbox?.address) {
          angelegt = data.mailbox;
          break;
        }
        if (res.status === 409) continue; // belegt → nächste Zahl
        letzterFehler = typeof data?.error === "string" ? data.error : letzterFehler;
        break;
      }
      if (!angelegt) {
        // Bereits vorhandenes Postfach (z. B. parallel angelegt) übernehmen.
        try {
          const res = await fetch("/api/gurkenmail/mailbox");
          const data = await res.json().catch(() => ({}));
          if (data?.mailbox?.address) angelegt = data.mailbox;
        } catch {
          // ignore
        }
      }
      if (!angelegt) throw new Error(letzterFehler);
      setMailAdresse(angelegt.address);
    } catch (err) {
      setMailFehler(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    } finally {
      setMailArbeitet(false);
    }
  }

  // Während der Chat-Demo läuft nur der echte Chat (mit Skript) – kein Overlay.
  if (schritt === "chat" && chatOffen) return null;

  // Punkte-Popup ist offen: nur schwebender Hinweis, Popup bleibt bedienbar.
  if (schritt === "punkte" && punkteOffen) {
    return (
      <div className="tour-hinweis">
        <div className={kartenKlasse()}>
          <Fortschritt schritt={schritt} />
          <h2 className="font-display mt-3 text-lg font-semibold text-[#faf8f1]">
            Hole deinen täglichen Bonus ab
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#a3ad9a]">
            {dailyAvailable ? (
              <>
                Tippe im Popup auf <strong className="text-[#ede8d6]">„Abholen“ (+20)</strong> –
                direkt hier, ohne Wegklicken.
              </>
            ) : (
              <>Bonus abgeholt – stark! 🥒 Scrolle im Popup nach unten: dort wartet die Rangliste.</>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              onPunkteOffen(null);
              weiter("casino");
            }}
            className="btn-cta btn-cta-primary mt-4 min-h-[48px] w-full !text-[15px]"
          >
            Weiter zum Casino →
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="tour-overlay" aria-hidden="true" />
      <div className="tour-karte" role="dialog" aria-modal="true" aria-label={SCHRITT_TITEL[schritt]}>
        <div className={kartenKlasse()}>
          <Fortschritt schritt={schritt} />
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7565]">
            Einrichtung · Schritt {schrittNr} von 6
          </p>

          {schritt === "gurke" && (
            <div className="tour-balance mt-2 text-center">
              <span className="tour-gurke" aria-hidden="true">🥒</span>
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                Ab 1.000 Punkten gibt’s eine echte Salatgurke
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3ad9a]">
                Sammle Punkte im Chat, mit Zitaten, Bonus und GurkenMail – bei{" "}
                <strong className="text-[#ede8d6]">1.000 Punkten</strong> schickt dir Gürkchen eine
                echte Salatgurke (oder Sauergurke, solange der Vorrat reicht) per Post.
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#6b7565]">
                Es gilt die AGB-Regel: Versand nur in Deutschland, keine Geld-Alternative, keine
                Ersatzlieferung bei falscher Adresse oder Verderb, Verzehr auf eigene Gefahr.{" "}
                <Link href="/agb" className="font-semibold text-[#abc189] underline underline-offset-2">
                  AGB § 12 lesen
                </Link>
              </p>
              <button
                type="button"
                onClick={() => weiter("chat")}
                className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
              >
                Weiter – Gürkchen kennenlernen →
              </button>
            </div>
          )}

          {schritt === "chat" && (
            <div className="tour-balance mt-2 text-center">
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                Sag Hallo zu Gürkchen
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3ad9a]">
                Der Gürkchen-Chat pulsiert gerade grün. Ich öffne ihn für dich mit einer
                vorbereiteten Nachricht – die Antwort kommt wie beim echten Chat mit
                kurzer Verzögerung.
              </p>
              <button
                type="button"
                onClick={() => {
                  onChatOffen(true);
                }}
                className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
              >
                💬 Chat öffnen
              </button>
            </div>
          )}

          {schritt === "punkte" && (
            <div className="tour-balance mt-2 text-center">
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                Deine Punkte & die Rangliste
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3ad9a]">
                Chat-Nachricht +5, Zitat +5 (3× täglich), GurkenMail +10 / +5, täglicher
                Bonus +20, Freund werben +100. Unten im Punkte-Popup siehst du die
                Rangliste der Sekte.
              </p>
              <button
                type="button"
                onClick={() => onPunkteOffen(true)}
                className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
              >
                🎁 Punkte öffnen & Bonus abholen
              </button>
            </div>
          )}

          {schritt === "casino" && (
            <div className="tour-balance mt-2 text-center">
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                Zocken im Casino
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3ad9a]">
                Hinter der <strong className="text-[#ede8d6]">Casino-Kachel</strong> warten{" "}
                <strong className="text-[#ede8d6]">Slotmaschine und Roulette</strong> – Einsätze
                10 / 25 / 50 Punkte. Heute nur schauen, spielen kannst du später (jede
                Runde kostet ein frisches Captcha).
              </p>
              <button
                type="button"
                onClick={() => weiter("mail")}
                className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
              >
                Weiter – Postfach sichern →
              </button>
            </div>
          )}

          {schritt === "mail" && (
            <div className="tour-balance mt-2">
              <h2 className="font-display mt-2 text-center text-2xl font-semibold text-[#faf8f1]">
                Deine GurkenMail-Adresse
              </h2>
              {mailAdresse ? (
                <div className="mt-3 text-center">
                  <p className="text-sm text-[#a3ad9a]">Dein Postfach ist bereit:</p>
                  <p className="font-display mt-1 break-all text-xl font-semibold text-[#faf8f1]">
                    {mailAdresse}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#6b7565]">
                    3× schreiben pro Tag, Empfang unbegrenzt, Gurken-intern gratis. Eine
                    Willkommens-Mail liegt schon im Postfach.
                  </p>
                  <button
                    type="button"
                    onClick={() => weiter("fertig")}
                    className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
                  >
                    Fast geschafft →
                  </button>
                </div>
              ) : (
                <form onSubmit={mailAnlegen} className="mt-3 space-y-3">
                  <p className="text-center text-sm leading-relaxed text-[#a3ad9a]">
                    Deine Adresse ist automatisch{" "}
                    <strong className="break-all text-[#ede8d6]">@{benutzername}-Postfach</strong> –
                    ganz ohne Abfrage. Sag uns nur noch, wie du als Absender heißen willst
                    (wird auch dein Anzeigename).
                  </p>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
                    <p className="text-xs font-semibold text-[#a3ad9a]">Deine GurkenMail-Adresse</p>
                    <p className="font-display mt-1 break-all text-xl font-semibold text-[#faf8f1]">
                      {mailPrueft ? "…" : `${benutzername}@gurkensekte.de`}
                    </p>
                  </div>
                  <label className="block text-xs font-semibold text-[#a3ad9a]">
                    Dein Name (Absendername, 2–40 Zeichen)
                    <input
                      value={mailName}
                      onChange={(e) => {
                        setMailName(e.target.value);
                        setMailFehler(null);
                      }}
                      placeholder="Gurken Fan"
                      autoComplete="nickname"
                      maxLength={40}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d]"
                    />
                  </label>
                  {mailFehler && (
                    <p role="alert" className="text-xs font-semibold text-red-300">
                      {mailFehler}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={mailArbeitet}
                    className="btn-cta btn-cta-primary min-h-[52px] w-full !text-base disabled:opacity-50"
                  >
                    {mailArbeitet ? "Wird gesichert …" : "🥒 Namen speichern & Postfach sichern"}
                  </button>
                </form>
              )}
            </div>
          )}

          {schritt === "fertig" && (
            <div className="tour-balance mt-2 text-center">
              <span className="tour-gurke" aria-hidden="true">🎉</span>
              <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
                Eingelegt! Du kennst jetzt fast alles
              </h2>
              <ul className="mx-auto mt-3 max-w-md space-y-1.5 text-left text-sm text-[#a3ad9a]">
                <li>💬 Gürkchen-Chat – frag das Einlegeglas</li>
                <li>🎁 Punkte – Bonus abholen, Rangliste erklimmen</li>
                <li>🎰 Casino – Slot & Roulette für Mutige</li>
                <li>✉️ GurkenMail – {mailAdresse ?? "dein Postfach ist bereit"}</li>
              </ul>
              <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-[#6b7565]">
                Später entdecken: Duell (Tic Tac Toe live) und Freunde werben (+100 Punkte).
              </p>
              <button
                type="button"
                onClick={abschliessen}
                className="btn-cta btn-cta-primary mt-4 min-h-[52px] w-full !text-base"
              >
                🥒 Los geht’s!
              </button>
            </div>
          )}

          {ueberspringbar && schritt !== "fertig" && (
            <button
              type="button"
              onClick={ueberspringen}
              className="mt-3 min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] transition-colors hover:text-[#a3ad9a]"
            >
              Tour überspringen
            </button>
          )}
        </div>
      </div>
    </>
  );
}
