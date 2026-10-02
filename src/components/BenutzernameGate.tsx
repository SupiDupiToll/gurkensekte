"use client";

import { useEffect, useState } from "react";
import { useUser } from "@hexclave/next";
import { BenutzernameForm } from "@/components/BenutzernameForm";
import { benutzernameVorschlag } from "@/lib/benutzername";

/**
 * Onboarding-Gate: Wer noch keinen Benutzernamen hat, wird beim nächsten
 * Besuch gefragt. Vorschlag = Teil vor dem @ der E-Mail, sonst normalisierter
 * Hexclave-Anzeigename. Nicht wegklickbar (erzwungen) – der Name ist Pflicht
 * für GurkenMail & Co.
 */
export function BenutzernameGate() {
  const hexUser = useUser();
  const [zustand, setZustand] = useState<
    | { phase: "laden" }
    | { phase: "fertig"; benutzername: string }
    | { phase: "fragen"; vorschlag: string }
  >({ phase: "laden" });

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/mitglieder/benutzername");
        if (!res.ok) return;
        const data = await res.json();
        if (!aktiv) return;
        if (typeof data.benutzername === "string" && data.benutzername) {
          setZustand({ phase: "fertig", benutzername: data.benutzername });
        } else {
          const fallback =
            typeof data.vorschlag === "string" && data.vorschlag
              ? data.vorschlag
              : benutzernameVorschlag(hexUser?.displayName, hexUser?.primaryEmail);
          setZustand({ phase: "fragen", vorschlag: fallback });
        }
      } catch {
        // Fail-open: ohne Namen weiter (kein hartes Blockieren bei Netzfehler).
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [hexUser?.displayName, hexUser?.primaryEmail]);

  if (zustand.phase !== "fragen") return null;

  // Absichtlich kein Popup mit X/Escape: der Name ist Pflicht und der
  // Dialog darf nicht weggeklickt werden.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Benutzernamen vergeben"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      <div className="popup-eintritt relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#101b14] px-5 py-6 md:px-6">
        <h2 className="font-display text-center text-xl font-semibold text-[#faf8f1]">
          Benutzernamen vergeben
        </h2>
        <div className="mt-4">
          <BenutzernameForm
            startwert={zustand.vorschlag}
            absendenText="🥒 Benutzernamen sichern"
            erzwungen
            onGespeichert={(name) => setZustand({ phase: "fertig", benutzername: name })}
          />
        </div>
      </div>
    </div>
  );
}
