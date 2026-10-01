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
  const [einwilligung, setEinwilligung] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const lokalFehler = benutzernameFehlerText(wert);
    if (lokalFehler) {
      setFehler(lokalFehler);
      return;
    }
    if (!einwilligung) {
      setFehler("Bitte bestätige zuerst die Hinweise zum Benutzernamen.");
      return;
    }
    setSenden(true);
    setFehler(null);
    try {
      const res = await fetch("/api/mitglieder/benutzername", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benutzername: wert, einwilligung: true }),
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
      <p className="text-xs leading-relaxed text-[#6b7565]">
        Öffentlich sichtbar: Der Benutzername erscheint u. a. in der Gurken-Rangliste
        und im Duell – wähle ihn entsprechend.
      </p>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs leading-relaxed text-[#a3ad9a]">
        <input
          type="checkbox"
          checked={einwilligung}
          onChange={(e) => {
            setEinwilligung(e.target.checked);
            setFehler(null);
          }}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#8fa96d]"
        />
        <span>
          Ich habe die{" "}
          <a href="/datenschutz" target="_blank" rel="noreferrer" className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]">
            Datenschutzerklärung
          </a>{" "}
          und die{" "}
          <a href="/agb" target="_blank" rel="noreferrer" className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]">
            AGB
          </a>{" "}
          gelesen und akzeptiert und erlaube der Gurken Sekte, mir E-Mails zu senden.
        </span>
      </label>
      <button
        type="submit"
        disabled={senden || wert.trim().length === 0 || !einwilligung}
        className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px] disabled:opacity-50"
      >
        {senden ? "Wird gespeichert …" : absendenText}
      </button>
    </form>
  );
}
