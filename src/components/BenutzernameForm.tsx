"use client";

import { useState } from "react";
import { benutzernameFehlerText } from "@/lib/benutzername";

/** Wiederverwendbares Formular: Benutzernamen setzen/ändern (Onboarding + Einstellungen). */
export function BenutzernameForm({
  startwert,
  absendenText = "Speichern",
  erzwungen = false,
  onGespeichert,
}: {
  startwert: string;
  absendenText?: string;
  erzwungen?: boolean;
  onGespeichert: (name: string) => void;
}) {
  const [wert, setWert] = useState(startwert);
  const [fehler, setFehler] = useState<string | null>(null);
  const [senden, setSenden] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const lokalFehler = benutzernameFehlerText(wert);
    if (lokalFehler) {
      setFehler(lokalFehler);
      return;
    }
    setSenden(true);
    setFehler(null);
    try {
      const res = await fetch("/api/mitglieder/benutzername", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benutzername: wert }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Speichern fehlgeschlagen",
        );
      }
      onGespeichert(data.benutzername as string);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSenden(false);
    }
  }

  return (
    <form onSubmit={absenden} className="space-y-3">
      <label className="block text-xs font-semibold text-[#a3ad9a]">
        Benutzername (3–20 Zeichen, Kleinbuchstaben/Zahlen/._-)
        <input
          value={wert}
          onChange={(e) => {
            setWert(e.target.value.toLowerCase());
            setFehler(null);
          }}
          placeholder="z. B. gurkenfan"
          autoComplete="username"
          autoFocus={erzwungen}
          maxLength={20}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none focus:border-[#8fa96d]"
        />
      </label>
      {fehler && (
        <p role="alert" className="text-xs font-semibold text-red-300">
          {fehler}
        </p>
      )}
      <button
        type="submit"
        disabled={senden || wert.trim().length === 0}
        className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px] disabled:opacity-50"
      >
        {senden ? "Wird gespeichert …" : absendenText}
      </button>
    </form>
  );
}
