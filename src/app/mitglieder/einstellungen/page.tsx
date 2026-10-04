"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { AccountSettings, useUser } from "@hexclave/next";
import { BenutzernameForm } from "@/components/BenutzernameForm";
import { anzeigenameFehlerText, benutzernameVorschlag } from "@/lib/benutzername";
import "./einstellungen.css";

/**
 * Einstellungen (Unterseite von /mitglieder):
 * - Benutzername (eigenes System, global eindeutig)
 * - Anzeigename (kompakt, eigenes UI – der native „My Profile“-Tab ist ausgeblendet)
 * - Alles Sicherheits-/Kontorelevante (E-Mails, Passwort, Passkey, MFA,
 *   Sessions) über Hexclaves AccountSettings – keine eigene Nachimplementierung
 *   sensibler Flows. Ausgeblendete Tabs + Design-Feinheiten: einstellungen.css.
 */

/** Tabs ohne native Filter-Props – Sichtbarkeit per CSS, Hash-Guard als Netz. */
const VERSTECKTE_TABS = new Set(["profile", "notifications"]);

function HashGuard() {
  // Vor dem ersten Paint: kein Flash des Profil-Tabs (Default-Index 0).
  useLayoutEffect(() => {
    const reparieren = () => {
      const aktuell = window.location.hash.replace(/^#/, "");
      if (!aktuell || VERSTECKTE_TABS.has(aktuell)) window.location.hash = "auth";
    };
    reparieren();
    window.addEventListener("hashchange", reparieren);
    return () => window.removeEventListener("hashchange", reparieren);
  }, []);
  return null;
}

function BenutzernameBereich() {
  const hexUser = useUser();
  const [benutzername, setBenutzername] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState("gurkenfreund");
  const [laedt, setLaedt] = useState(true);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [ungueltigHinweis, setUngueltigHinweis] = useState(false);

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
        setUngueltigHinweis(data.ungueltigGespeichert === true);
        if (typeof data.vorschlag === "string" && data.vorschlag) {
          setVorschlag(data.vorschlag);
        } else {
          setVorschlag(benutzernameVorschlag(hexUser?.displayName, hexUser?.primaryEmail));
        }
      } catch {
        // Fail-open: Rest der Einstellungen bleibt nutzbar.
      } finally {
        if (aktiv) setLaedt(false);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [hexUser?.displayName, hexUser?.primaryEmail]);

  return (
    <section className="card p-6 md:p-8" aria-label="Benutzername">
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
              setUngueltigHinweis(false);
            }}
          />
          {ungueltigHinweis && !benutzername && (
            <p role="status" className="mt-2 text-xs font-semibold text-amber-200">
              Dein bisher gespeicherter Name war ungültig oder reserviert und
              wurde verworfen – bitte wähle einen neuen.
            </p>
          )}
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
        vergeben (bereits vergebene Adressen bleiben bestehen). Im Duell spielst
        du unter diesem Namen.
      </p>
    </section>
  );
}

/** Kompakter Anzeigename – Ersatz für den ausgeblendeten „My Profile“-Tab. */
function AnzeigenameBereich() {
  const user = useUser({ or: "redirect" });
  const [wert, setWert] = useState(user.displayName ?? "");
  const [info, setInfo] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [senden, setSenden] = useState(false);
  const gespeichert = (user.displayName ?? "").trim();

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    const gesperrtFehler = anzeigenameFehlerText(wert);
    if (gesperrtFehler) {
      setFehler(gesperrtFehler);
      return;
    }
    const name = wert.trim().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
    if (name.length < 2) return;
    setSenden(true);
    setInfo(null);
    setFehler(null);
    try {
      await user.update({ displayName: name.slice(0, 100) });
      setInfo("Anzeigename gespeichert.");
    } catch {
      setFehler("Konnte nicht gespeichert werden.");
    } finally {
      setSenden(false);
    }
  }

  return (
    <section className="card p-6 md:p-8" aria-label="Anzeigename">
      <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
        Anzeigename
      </h2>
      <form onSubmit={speichern} className="mt-4 flex gap-2">
        <input
          value={wert}
          onChange={(e) => {
            setWert(e.target.value);
            setInfo(null);
            setFehler(null);
          }}
          placeholder="Dein Anzeigename"
          autoComplete="nickname"
          maxLength={100}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d]"
        />
        <button
          type="submit"
          disabled={senden || wert.trim() === gespeichert || anzeigenameFehlerText(wert) !== null}
          className="btn-cta btn-cta-primary min-h-[48px] shrink-0 !px-5 !text-[15px] disabled:opacity-50"
        >
          {senden ? "…" : "Speichern"}
        </button>
      </form>
      {fehler && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-300">
          {fehler}
        </p>
      )}
      {info && (
        <p role="status" className="mt-2 text-xs font-semibold text-[#8fa96d]">
          {info}
        </p>
      )}
    </section>
  );
}

export default function EinstellungenPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 md:pt-20">
      <HashGuard />
      <p className="eyebrow">Mitgliederbereich</p>
      <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
        Einstellungen
      </h1>

      <div className="mt-8 space-y-4">
        <BenutzernameBereich />
        <AnzeigenameBereich />

        {/* Konto & Sicherheit: E-Mails, Passwort, Passkey, MFA, Sessions */}
        <section className="card p-6 md:p-8" aria-label="Konto und Sicherheit">
          <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
            E-Mails, Login &amp; Sessions
          </h2>
          <div className="hexclave-settings mt-4 overflow-hidden rounded-2xl border border-white/[0.08]">
            <Suspense
              fallback={<div className="shimmer h-64" aria-busy="true" />}
            >
              <AccountSettings />
            </Suspense>
          </div>
        </section>
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
