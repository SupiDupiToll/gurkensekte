"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AccountSettings, useUser } from "@hexclave/next";
import { BenutzernameForm } from "@/components/BenutzernameForm";

/**
 * Einstellungen (Unterseite von /mitglieder):
 * - Benutzername (eigenes System, global eindeutig)
 * - Alles Sicherheits-/Kontorelevante (Passkey, E-Mails, MFA, Sessions,
 *   Passwort) über Hexclaves AccountSettings – keine eigene Nachimplementierung
 *   sensibler Flows.
 */
function EinstellungenInhalt() {
  const hexUser = useUser();
  const [benutzername, setBenutzername] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState("gurkenfreund");
  const [laedt, setLaedt] = useState(true);
  const [bearbeiten, setBearbeiten] = useState(false);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch("/api/mitglieder/benutzername");
        const data = await res.json().catch(() => ({}));
        if (!aktiv) return;
        setBenutzername(
          typeof data.benutzername === "string" && data.benutzername
            ? data.benutzername
            : null,
        );
        if (typeof data.vorschlag === "string" && data.vorschlag) {
          setVorschlag(data.vorschlag);
        } else if (hexUser?.displayName) {
          setVorschlag(hexUser.displayName);
        }
      } catch {
        // Fail-open: Hexclave-Teil bleibt nutzbar.
      } finally {
        if (aktiv) setLaedt(false);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [hexUser?.displayName]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 md:pt-20">
      <p className="eyebrow">Mitgliederbereich</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
        Einstellungen
      </h1>
      <p className="mt-3 text-sm text-[#a3ad9a]">
        {hexUser?.displayName ?? "Gurkenfreund"}
        {hexUser?.primaryEmail ? ` · ${hexUser.primaryEmail}` : ""}
      </p>

      {/* Benutzername */}
      <section className="card mt-8 p-6 md:p-8" aria-label="Benutzername">
        <p className="eyebrow">Benutzername</p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
          Dein eindeutiger Name
        </h2>
        {laedt ? (
          <div className="shimmer mt-4 h-16 rounded-xl" aria-busy="true" />
        ) : bearbeiten || !benutzername ? (
          <div className="mt-4">
            <BenutzernameForm
              startwert={benutzername ?? vorschlag}
              absendenText="Benutzernamen speichern"
              onGespeichert={(name) => {
                setBenutzername(name);
                setBearbeiten(false);
              }}
            />
            {benutzername && (
              <button
                type="button"
                onClick={() => setBearbeiten(false)}
                className="mt-2 min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] hover:text-[#a3ad9a]"
              >
                Abbrechen
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold text-[#faf8f1]">
              @{benutzername}
            </p>
            <button
              type="button"
              onClick={() => setBearbeiten(true)}
              className="flex min-h-[44px] items-center rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
            >
              Ändern
            </button>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-[#6b7565]">
          Global eindeutig, 3–20 Zeichen. Neue GurkenMail-Adressen werden daraus
          vergeben (bereits vergebene Adressen bleiben bestehen).
        </p>
      </section>

      {/* Konto & Sicherheit: E-Mails, Passkey, MFA, Sessions, Passwort */}
      <section className="card mt-4 p-6 md:p-8" aria-label="Konto und Sicherheit">
        <p className="eyebrow">Konto &amp; Sicherheit</p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
          E-Mails, Passkey, MFA &amp; Sessions
        </h2>
        <p className="mt-2 text-sm text-[#a3ad9a]">
          E-Mail-Adressen verwalten (ändern/hinzufügen/bestätigen), Passkey
          einrichten, Zwei-Faktor-Auth (MFA) aktivieren und aktive Sessions
          widerrufen.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08]">
          <Suspense
            fallback={<div className="shimmer h-64" aria-busy="true" />}
          >
            <AccountSettings />
          </Suspense>
        </div>
      </section>

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

export default function EinstellungenPage() {
  return <EinstellungenInhalt />;
}
