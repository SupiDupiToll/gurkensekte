"use client";

import { useEffect, useState } from "react";
import { useUser } from "@hexclave/next";
import { BenutzernameForm } from "@/components/BenutzernameForm";

/**
 * Onboarding-Gate: Wer noch keinen Benutzernamen hat, wird beim nächsten
 * Besuch gefragt. Vorschlag = normalisierter Hexclave-Anzeigename.
 * Nicht wegklickbar (erzwungen) – der Name ist Pflicht für GurkenMail & Co.
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
              : (hexUser?.displayName ?? "gurkenfreund");
          setZustand({ phase: "fragen", vorschlag: fallback });
        }
      } catch {
        // Fail-open: ohne Namen weiter (kein hartes Blockieren bei Netzfehler).
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [hexUser?.displayName]);

  if (zustand.phase !== "fragen") return null;

  // Absichtlich kein Popup mit X/Escape: der Name ist Pflicht und der
  // Dialog darf nicht weggeklickt werden.
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Wähle deinen Benutzernamen"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      <div className="popup-eintritt relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101b14]">
        <div className="border-b border-white/[0.08] px-5 py-4 md:px-6">
          <p className="eyebrow">Einmalig einrichten</p>
          <h2 className="font-display mt-1 text-lg font-semibold text-[#faf8f1]">
            Wähle deinen Benutzernamen
          </h2>
        </div>
        <div className="overflow-y-auto px-5 py-5 md:px-6 md:py-6">
          <p className="text-sm text-[#a3ad9a]">
            Ab sofort brauchst du einen eindeutigen Benutzernamen – z. B. für deine
            GurkenMail-Adresse. Vorschlag aus deinem Anzeigenamen, du kannst ihn
            noch anpassen (später änderbar in den Einstellungen):
          </p>
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
    </div>
  );
}
