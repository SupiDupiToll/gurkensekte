"use client";

import Link from "next/link";
import { useUser } from "@hexclave/next";
import { EinstellungenClient } from "@/components/EinstellungenClient";

/**
 * Einstellungen (Unterseite von /mitglieder) – komplett selbst gebaut,
 * Backend bleibt Hexclave (SDK-Methoden auf dem User-Objekt):
 * - Benutzername (eigenes Eindeutigkeits-System)
 * - Anzeigename, E-Mails, Passwort, Passkey, MFA, Sessions
 */
export default function EinstellungenPage() {
  // Ausgeloggte Besucher werden direkt zur Anmeldung umgeleitet.
  const user = useUser({ or: "redirect" });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 md:pt-20">
      <p className="eyebrow">Mitgliederbereich</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
        Einstellungen
      </h1>
      <p className="mt-3 text-sm text-[#a3ad9a]">
        {user.displayName ?? "Gurkenfreund"}
        {user.primaryEmail ? ` · ${user.primaryEmail}` : ""}
      </p>

      <div className="mt-8">
        <EinstellungenClient />
      </div>

      <div className="mt-6">
        <Link
          href="/mitglieder"
          className="btn-cta flex min-h-[56px] w-full items-center justify-center gap-2 !text-base"
        >
          ← Zurück zum Dashboard
        </Link>
      </div>
    </div>
  );
}
