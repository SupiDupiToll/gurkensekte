"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { hexclaveClientApp } from "@/hexclave/client";
import { GoogleGLogo } from "@/components/GoogleOneTapPopup";

function istGmailAdresse(wert: string): boolean {
  const mail = wert.trim().toLowerCase();
  if (!mail.includes("@")) return false;
  const domain = mail.split("@").pop() ?? "";
  return domain === "gmail.com" || domain === "googlemail.com";
}

/** Mail-Felder im Container finden (gezielt per Typ/Name, sonst per Wert-Fallback). */
function findeMailFelder(root: ParentNode): HTMLInputElement[] {
  const gezielt = root.querySelectorAll<HTMLInputElement>(
    'input[type="email"], input[inputmode="email"], input[autocomplete="email"], input[name*="mail"], input[name*="email"]',
  );
  if (gezielt.length > 0) return [...gezielt];
  return [...root.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')].filter(
    (el) => el.value.includes("@"),
  );
}

/**
 * Wrapper um Login-/Signup-Formulare: Wird eine Mail angefordert
 * („Send Email" & Co.) und steht eine Gmail-Adresse im Formular,
 * erscheint ein Popup mit dem Spam-Hinweis (Gmail sortiert unsere
 * Login-Mails gern aus). Passwort-Logins lösen kein Popup aus.
 */
export function GmailSpamHinweis({ children }: { children: ReactNode }) {
  const [offen, setOffen] = useState(false);
  const [gmailErkannt, setGmailErkannt] = useState(false);
  const [googleLaedt, setGoogleLaedt] = useState(false);
  const [googleFehler, setGoogleFehler] = useState<string | null>(null);

  async function mitGoogleAnmelden() {
    setGoogleLaedt(true);
    setGoogleFehler(null);
    try {
      await hexclaveClientApp.signInWithOAuth("google", {
        returnTo: "/mitglieder",
      });
    } catch {
      setGoogleLaedt(false);
      setGoogleFehler("Weiterleitung zu Google hat nicht geklappt – bitte erneut versuchen.");
    }
  }

  useEffect(() => {
    if (!offen) return;
    const schliessen = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    window.addEventListener("keydown", schliessen);
    return () => window.removeEventListener("keydown", schliessen);
  }, [offen]);

  function beiAbsenden(e: FormEvent) {
    const formular = e.target as HTMLFormElement;
    if (!formular || typeof formular.querySelector !== "function") return;
    const gmail = findeMailFelder(formular).some((f) => istGmailAdresse(f.value));
    if (!gmail) return;
    // Nur bei Mail-Versand zeigen, nicht beim Passwort-Login:
    // Mail-Formulare haben kein Passwort-Feld (oder der Button sagt es).
    const hatPasswortFeld = formular.querySelector('input[type="password"]');
    const ausloeser = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const knopfText = (ausloeser?.textContent ?? "").toLowerCase();
    const siehtNachVersandAus =
      /mail|code|link|otp|verif|send|senden|zusenden|anfordern|bestätig|bestaetig/.test(knopfText);
    if (!hatPasswortFeld || siehtNachVersandAus) {
      setGmailErkannt(true);
      setOffen(true);
    }
  }

  return (
    <div onSubmit={beiAbsenden}>
      {children}
      {gmailErkannt && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-center text-xs leading-relaxed text-[#6b7565]">
            Kein Code angekommen? Dann einfach direkt mit einem Klick über
            Google anmelden – ganz ohne Code:
          </p>
          <button
            type="button"
            onClick={mitGoogleAnmelden}
            disabled={googleLaedt}
            className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#faf8f1] px-4 py-3 text-sm font-semibold text-[#0b120d] transition-all hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            <GoogleGLogo />
            {googleLaedt ? "Weiter zu Google …" : "Mit Google anmelden"}
          </button>
          {googleFehler && (
            <p role="alert" className="mt-2 text-center text-xs font-semibold text-red-300">
              {googleFehler}
            </p>
          )}
        </div>
      )}
      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOffen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gmail-hinweis-titel"
            className="card w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-4xl">📬</p>
            <h2
              id="gmail-hinweis-titel"
              className="font-display mt-2 text-xl font-semibold text-[#faf8f1]"
            >
              E-Mail ist unterwegs!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#a3ad9a]">
              Schau in dein Postfach – und falls nichts ankommt, unbedingt auch in den{" "}
              <strong className="text-[#ede8d6]">Spam-Ordner</strong>: Gmail sortiert unsere
              Login-Mails gern mal aus.
            </p>
            <button
              type="button"
              onClick={() => setOffen(false)}
              autoFocus
              className="btn-cta btn-cta-primary mt-4 min-h-[48px] w-full !text-[15px]"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
