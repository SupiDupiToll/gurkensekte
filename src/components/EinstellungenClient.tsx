"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@hexclave/next";
import { createTOTPKeyURI, verifyTOTP } from "@oslojs/otp";
import { BenutzernameForm } from "@/components/BenutzernameForm";

/* ── Typen (strukturell passend zu den Hexclave-SDK-Objekten) ── */

type Kanal = {
  id: string;
  value: string;
  type: string;
  isPrimary: boolean;
  isVerified: boolean;
  usedForAuth: boolean;
  sendVerificationEmail: (o?: { callbackUrl?: string }) => Promise<void>;
  update: (d: {
    usedForAuth?: boolean;
    value?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
  delete: () => Promise<void>;
};

type Sitzung = {
  id: string;
  isCurrentSession: boolean;
  isImpersonation: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  geoInfo?: { ip?: string; cityName?: string | null };
};

/* ── Helfer ── */

const inputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none transition-colors focus:border-[#8fa96d]";

const btnSekundaer =
  "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/12 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50";

function fehlerText(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "humanReadableMessage" in e) {
    const m = (e as { humanReadableMessage?: unknown }).humanReadableMessage;
    if (typeof m === "string" && m) return m;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function istEmail(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert.trim());
}

/* ── MFA-QR (eigener QR via qr-code-styling, TOTP via @oslojs/otp) ── */

function MfaQrCode({ daten }: { daten: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!daten || !mountRef.current) return;
    let abgebrochen = false;
    (async () => {
      const { default: QRCodeStyling } = await import("qr-code-styling");
      if (abgebrochen || !mountRef.current) return;
      mountRef.current.innerHTML = "";
      const qr = new QRCodeStyling({
        width: 200,
        height: 200,
        type: "svg",
        data: daten,
        margin: 8,
        qrOptions: { errorCorrectionLevel: "M" },
        dotsOptions: { type: "rounded", color: "#171B19" },
        backgroundOptions: { color: "#FFFFFF" },
        cornersSquareOptions: { type: "extra-rounded", color: "#171B19" },
        cornersDotOptions: { type: "dot", color: "#00B33C" },
      });
      qr.append(mountRef.current);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [daten]);

  return (
    <div className="grid w-fit place-items-center rounded-2xl bg-white p-3">
      <div ref={mountRef} role="img" aria-label="QR-Code für die Authenticator-App" />
    </div>
  );
}

/* ── Sektion: Benutzername (eigenes Eindeutigkeits-System) ── */

function BenutzernameSektion() {
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
        // Fail-open: Rest der Einstellungen bleibt nutzbar.
      } finally {
        if (aktiv) setLaedt(false);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [hexUser?.displayName]);

  return (
    <section className="card p-6 md:p-8" aria-label="Benutzername">
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
            className={btnSekundaer}
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

/* ── Sektion: Anzeigename (Hexclave-Profil) ── */

function AnzeigenameSektion() {
  const user = useUser({ or: "redirect" });
  const [wert, setWert] = useState(user.displayName ?? "");
  const [info, setInfo] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [senden, setSenden] = useState(false);
  const gespeichert = (user.displayName ?? "").trim();

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    const name = wert.trim();
    if (name.length < 2) {
      setFehler("Mindestens 2 Zeichen.");
      return;
    }
    setSenden(true);
    setFehler(null);
    setInfo(null);
    try {
      await user.update({ displayName: name.slice(0, 100) });
      setInfo("Anzeigename gespeichert.");
    } catch (err) {
      setFehler(fehlerText(err, "Konnte nicht gespeichert werden."));
    } finally {
      setSenden(false);
    }
  }

  return (
    <section className="card p-6 md:p-8" aria-label="Anzeigename">
      <p className="eyebrow">Profil</p>
      <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
        Anzeigename
      </h2>
      <p className="mt-2 text-sm text-[#a3ad9a]">
        So begrüßt dich die Sekte (z. B. in „Willkommen zurück, {gespeichert || "…"}“).
      </p>
      <form onSubmit={speichern} className="mt-4 space-y-3">
        <input
          value={wert}
          onChange={(e) => {
            setWert(e.target.value);
            setFehler(null);
            setInfo(null);
          }}
          placeholder="Dein Anzeigename"
          autoComplete="nickname"
          maxLength={100}
          className={inputClass}
        />
        {fehler && (
          <p role="alert" className="text-xs font-semibold text-red-300">
            {fehler}
          </p>
        )}
        {info && (
          <p role="status" className="text-xs font-semibold text-[#8fa96d]">
            {info}
          </p>
        )}
        <button
          type="submit"
          disabled={senden || wert.trim() === gespeichert}
          className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px] disabled:opacity-50"
        >
          {senden ? "Wird gespeichert …" : "Anzeigename speichern"}
        </button>
      </form>
    </section>
  );
}

/* ── Sektion: E-Mails (Hexclave Contact Channels) ── */

function EmailsSektion() {
  const user = useUser({ or: "redirect" });
  const [kanaele, setKanaele] = useState<Kanal[] | null>(null);
  const [neu, setNeu] = useState("");
  const [hinzufuegen, setHinzufuegen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function laden() {
    try {
      const liste = (await user.listContactChannels()) as unknown as Kanal[];
      setKanaele(liste.filter((k) => k.type === "email"));
    } catch (err) {
      setFehler(fehlerText(err, "E-Mails konnten nicht geladen werden."));
    }
  }

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const liste = (await user.listContactChannels()) as unknown as Kanal[];
        if (aktiv) setKanaele(liste.filter((k) => k.type === "email"));
      } catch (err) {
        if (aktiv) setFehler(fehlerText(err, "E-Mails konnten nicht geladen werden."));
      }
    })();
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginMails = (kanaele ?? []).filter((k) => k.usedForAuth);

  async function aktion(kanalId: string, fn: (k: Kanal) => Promise<void>, okText: string) {
    setBusy(kanalId);
    setFehler(null);
    setInfo(null);
    try {
      const kanal = (kanaele ?? []).find((k) => k.id === kanalId);
      if (!kanal) return;
      await fn(kanal);
      await laden();
      setInfo(okText);
    } catch (err) {
      setFehler(fehlerText(err, "Aktion fehlgeschlagen."));
    } finally {
      setBusy(null);
    }
  }

  async function emailHinzufuegen(e: React.FormEvent) {
    e.preventDefault();
    const wert = neu.trim();
    if (!istEmail(wert)) {
      setFehler("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    if ((kanaele ?? []).some((k) => k.value.toLowerCase() === wert.toLowerCase())) {
      setFehler("Diese E-Mail hast du schon hinterlegt.");
      return;
    }
    setBusy("neu");
    setFehler(null);
    setInfo(null);
    try {
      const kanal = (await user.createContactChannel({
        type: "email",
        value: wert,
        usedForAuth: false,
      })) as unknown as Kanal;
      try {
        await kanal.sendVerificationEmail();
        setInfo(`Bestätigungs-Mail an ${wert} ist raus – bitte Postfach prüfen.`);
      } catch {
        setInfo(`${wert} hinzugefügt – Bestätigungs-Mail bitte unten anfordern.`);
      }
      setNeu("");
      setHinzufuegen(false);
      await laden();
    } catch (err) {
      setFehler(fehlerText(err, "E-Mail konnte nicht hinzugefügt werden."));
    } finally {
      setBusy(null);
    }
  }

  const sortiert = [...(kanaele ?? [])].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
    return 0;
  });

  return (
    <section className="card p-6 md:p-8" aria-label="E-Mails">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">E-Mails</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
            Adressen verwalten
          </h2>
        </div>
        {!hinzufuegen && (
          <button type="button" onClick={() => setHinzufuegen(true)} className={btnSekundaer}>
            + E-Mail hinzufügen
          </button>
        )}
      </div>

      {hinzufuegen && (
        <form onSubmit={emailHinzufuegen} className="mt-4 space-y-3">
          <input
            value={neu}
            onChange={(e) => {
              setNeu(e.target.value);
              setFehler(null);
            }}
            placeholder="neu@beispiel.de"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy === "neu"}
              className="btn-cta btn-cta-primary min-h-[48px] flex-1 !text-[15px] disabled:opacity-50"
            >
              {busy === "neu" ? "Wird hinzugefügt …" : "Hinzufügen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setHinzufuegen(false);
                setNeu("");
                setFehler(null);
              }}
              className={btnSekundaer}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {fehler && (
        <p role="alert" className="mt-3 text-xs font-semibold text-red-300">
          {fehler}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 text-xs font-semibold text-[#8fa96d]">
          {info}
        </p>
      )}

      <div className="mt-4">
        {kanaele === null ? (
          <div className="shimmer h-24 rounded-xl" aria-busy="true" />
        ) : sortiert.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#6b7565]">
            Noch keine E-Mail hinterlegt.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
            {sortiert.map((k) => (
              <li key={k.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#ede8d6]">
                    {k.value}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {k.isPrimary && (
                      <span className="rounded-md bg-[#8fa96d]/15 px-2 py-0.5 text-[11px] font-semibold text-[#abc189]">
                        Primär
                      </span>
                    )}
                    {!k.isVerified ? (
                      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                        Unbestätigt
                      </span>
                    ) : null}
                    {k.usedForAuth && (
                      <span className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-[#a3ad9a]">
                        Login
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!k.isVerified && (
                    <button
                      type="button"
                      disabled={busy === k.id}
                      onClick={() =>
                        aktion(k.id, (kanal) => kanal.sendVerificationEmail(), "Bestätigungs-Mail gesendet.")
                      }
                      className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                    >
                      Bestätigungs-Mail senden
                    </button>
                  )}
                  {!k.isPrimary && k.isVerified && (
                    <button
                      type="button"
                      disabled={busy === k.id}
                      onClick={() =>
                        aktion(k.id, (kanal) => kanal.update({ isPrimary: true }), "Primär-Adresse geändert.")
                      }
                      className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                    >
                      Als primär
                    </button>
                  )}
                  {!k.usedForAuth && k.isVerified && (
                    <button
                      type="button"
                      disabled={busy === k.id}
                      onClick={() =>
                        aktion(
                          k.id,
                          async (kanal) => {
                            try {
                              await kanal.update({ usedForAuth: true });
                            } catch {
                              throw new Error(
                                "Diese Adresse wird schon von einem anderen Konto zum Login genutzt.",
                              );
                            }
                          },
                          "Adresse wird jetzt zum Login genutzt.",
                        )
                      }
                      className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                    >
                      Für Login nutzen
                    </button>
                  )}
                  {k.usedForAuth && loginMails.length > 1 && (
                    <button
                      type="button"
                      disabled={busy === k.id}
                      onClick={() =>
                        aktion(k.id, (kanal) => kanal.update({ usedForAuth: false }), "Login-Nutzung entfernt.")
                      }
                      className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6] disabled:opacity-50"
                    >
                      Nicht für Login nutzen
                    </button>
                  )}
                  {(!k.usedForAuth || loginMails.length > 1) && (
                    <button
                      type="button"
                      disabled={busy === k.id}
                      onClick={() =>
                        aktion(k.id, (kanal) => kanal.delete(), "Adresse entfernt.")
                      }
                      className="min-h-[40px] rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-500/50 disabled:opacity-50"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs leading-relaxed text-[#6b7565]">
          Die letzte Login-Adresse kann weder entfernt noch abgeschaltet werden.
          Primär geht nur mit bestätigter Adresse.
        </p>
      </div>
    </section>
  );
}

/* ── Sektion: Passwort ── */

function PasswortSektion() {
  const user = useUser({ or: "redirect" });
  const [alt, setAlt] = useState("");
  const [neu1, setNeu1] = useState("");
  const [neu2, setNeu2] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [senden, setSenden] = useState(false);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (neu1.length < 8) {
      setFehler("Neues Passwort: mindestens 8 Zeichen.");
      return;
    }
    if (neu1 !== neu2) {
      setFehler("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setSenden(true);
    setFehler(null);
    setInfo(null);
    try {
      if (user.hasPassword) {
        const erg = await user.updatePassword({ oldPassword: alt, newPassword: neu1 });
        if (erg) {
          setFehler("Altes Passwort falsch.");
          return;
        }
      } else {
        await user.setPassword({ password: neu1 });
      }
      setAlt("");
      setNeu1("");
      setNeu2("");
      setInfo(user.hasPassword ? "Passwort geändert." : "Passwort gesetzt.");
    } catch (err) {
      setFehler(fehlerText(err, "Passwort konnte nicht gespeichert werden."));
    } finally {
      setSenden(false);
    }
  }

  return (
    <section className="card p-6 md:p-8" aria-label="Passwort">
      <p className="eyebrow">Passwort</p>
      <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
        {user.hasPassword ? "Passwort ändern" : "Passwort setzen"}
      </h2>
      <form onSubmit={speichern} className="mt-4 space-y-3">
        {user.hasPassword && (
          <label className="block text-xs font-semibold text-[#a3ad9a]">
            Altes Passwort
            <input
              type="password"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </label>
        )}
        <label className="block text-xs font-semibold text-[#a3ad9a]">
          Neues Passwort (min. 8 Zeichen)
          <input
            type="password"
            value={neu1}
            onChange={(e) => setNeu1(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold text-[#a3ad9a]">
          Neues Passwort wiederholen
          <input
            type="password"
            value={neu2}
            onChange={(e) => setNeu2(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        {fehler && (
          <p role="alert" className="text-xs font-semibold text-red-300">
            {fehler}
          </p>
        )}
        {info && (
          <p role="status" className="text-xs font-semibold text-[#8fa96d]">
            {info}
          </p>
        )}
        <button
          type="submit"
          disabled={senden}
          className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px] disabled:opacity-50"
        >
          {senden ? "Wird gespeichert …" : user.hasPassword ? "Passwort ändern" : "Passwort setzen"}
        </button>
      </form>
    </section>
  );
}

/* ── Sektion: Passkey ── */

function PasskeySektion() {
  const user = useUser({ or: "redirect" });
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bestaetigen, setBestaetigen] = useState(false);

  const an = user.passkeyAuthEnabled;
  const letzteMethode =
    an && !user.hasPassword && !user.otpAuthEnabled && user.oauthProviders.length === 0;

  async function hinzufuegen() {
    setBusy(true);
    setFehler(null);
    setInfo(null);
    try {
      const erg = await user.registerPasskey();
      if (erg.status === "error") {
        setFehler(fehlerText(erg.error, "Passkey konnte nicht registriert werden."));
        return;
      }
      setInfo("Passkey registriert – du kannst dich jetzt ohne Passwort einloggen.");
    } catch (err) {
      setFehler(fehlerText(err, "Passkey konnte nicht registriert werden (abgebrochen?)."));
    } finally {
      setBusy(false);
    }
  }

  async function entfernen() {
    setBusy(true);
    setFehler(null);
    try {
      await user.update({ passkeyAuthEnabled: false });
      setBestaetigen(false);
      setInfo("Passkey entfernt.");
    } catch (err) {
      setFehler(fehlerText(err, "Passkey konnte nicht entfernt werden."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6 md:p-8" aria-label="Passkey">
      <p className="eyebrow">Passkey</p>
      <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
        {an ? "Passkey aktiv" : "Passkey einrichten"}
      </h2>
      <p className="mt-2 text-sm text-[#a3ad9a]">
        {an
          ? "Login per Fingerabdruck, Gesicht oder Sicherheitsschlüssel – ohne Passwort."
          : "Login per Fingerabdruck, Gesicht oder Sicherheitsschlüssel. Dafür brauchst du eine bestätigte Login-E-Mail."}
      </p>
      {fehler && (
        <p role="alert" className="mt-3 text-xs font-semibold text-red-300">
          {fehler}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 text-xs font-semibold text-[#8fa96d]">
          {info}
        </p>
      )}
      <div className="mt-4">
        {!an ? (
          <button type="button" onClick={hinzufuegen} disabled={busy} className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px] disabled:opacity-50">
            {busy ? "Gerät fragt nach …" : "🔑 Passkey hinzufügen"}
          </button>
        ) : letzteMethode ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-[#a3ad9a]">
            Passkey ist deine einzige Login-Methode und bleibt deshalb aktiv. Lege erst
            ein Passwort oder eine weitere Methode an, um ihn zu entfernen.
          </p>
        ) : !bestaetigen ? (
          <button type="button" onClick={() => setBestaetigen(true)} disabled={busy} className={btnSekundaer}>
            Passkey entfernen
          </button>
        ) : (
          <div className="space-y-2">
            <p role="alert" className="text-xs font-semibold text-red-300">
              Wirklich entfernen? Danach geht kein Passkey-Login mehr.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={entfernen}
                disabled={busy}
                className="min-h-[44px] flex-1 rounded-lg bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Entfernen
              </button>
              <button type="button" onClick={() => setBestaetigen(false)} className={`${btnSekundaer} flex-1`}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Sektion: MFA / TOTP ── */

function MfaSektion() {
  const user = useUser({ or: "redirect" });
  const [secret, setSecret] = useState<Uint8Array | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeFehler, setCodeFehler] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bestaetigen, setBestaetigen] = useState(false);

  const aktivMfa = user.isMultiFactorRequired;

  function starten() {
    const neu = globalThis.crypto.getRandomValues(new Uint8Array(20));
    setSecret(neu);
    setUri(
      createTOTPKeyURI("Gurken Sekte", user.primaryEmail ?? user.id, neu, 30, 6),
    );
    setCode("");
    setCodeFehler(false);
    setFehler(null);
    setInfo(null);
  }

  function abbrechen() {
    setSecret(null);
    setUri(null);
    setCode("");
    setCodeFehler(false);
  }

  // Code prüfen, sobald 6 Ziffern stehen (wie Hexclaves eigene Sektion).
  useEffect(() => {
    if (!secret || code.length !== 6) return;
    let aktiv = true;
    (async () => {
      try {
        if (!verifyTOTP(secret, 30, 6, code)) {
          if (aktiv) setCodeFehler(true);
          return;
        }
        setBusy(true);
        await user.update({ totpMultiFactorSecret: secret });
        if (!aktiv) return;
        abbrechen();
        setInfo("MFA aktiviert – beim Login kommt jetzt der Code dazu.");
      } catch (err) {
        if (aktiv) setFehler(fehlerText(err, "MFA konnte nicht aktiviert werden."));
      } finally {
        if (aktiv) setBusy(false);
      }
    })();
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function deaktivieren() {
    setBusy(true);
    setFehler(null);
    try {
      await user.update({ totpMultiFactorSecret: null });
      setBestaetigen(false);
      setInfo("MFA deaktiviert.");
    } catch (err) {
      setFehler(fehlerText(err, "MFA konnte nicht deaktiviert werden."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6 md:p-8" aria-label="Zwei-Faktor-Auth">
      <p className="eyebrow">Zwei-Faktor-Auth (MFA)</p>
      <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
        {aktivMfa ? "MFA aktiv" : "MFA einrichten"}
      </h2>
      <p className="mt-2 text-sm text-[#a3ad9a]">
        {aktivMfa
          ? "Beim Login verlangt die Sekte zusätzlich einen 6-stelligen Code aus deiner Authenticator-App."
          : "Extra-Schutz: Code aus Google/Microsoft Authenticator, Authy, 1Password & Co. (wechselt alle 30 Sekunden)."}
      </p>
      {fehler && (
        <p role="alert" className="mt-3 text-xs font-semibold text-red-300">
          {fehler}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 text-xs font-semibold text-[#8fa96d]">
          {info}
        </p>
      )}

      <div className="mt-4">
        {aktivMfa ? (
          !bestaetigen ? (
            <button type="button" onClick={() => setBestaetigen(true)} className={btnSekundaer}>
              MFA deaktivieren
            </button>
          ) : (
            <div className="space-y-2">
              <p role="alert" className="text-xs font-semibold text-red-300">
                Wirklich deaktivieren? Dein Konto ist danach nur noch einfach geschützt.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={deaktivieren}
                  disabled={busy}
                  className="min-h-[44px] flex-1 rounded-lg bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Deaktivieren
                </button>
                <button type="button" onClick={() => setBestaetigen(false)} className={`${btnSekundaer} flex-1`}>
                  Abbrechen
                </button>
              </div>
            </div>
          )
        ) : !secret || !uri ? (
          <button type="button" onClick={starten} className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px]">
            🛡️ MFA aktivieren
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#a3ad9a]">
              1. QR-Code mit der Authenticator-App scannen:
            </p>
            <MfaQrCode daten={uri} />
            <p className="text-sm text-[#a3ad9a]">2. 6-stelligen Code eingeben:</p>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                setCodeFehler(false);
              }}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={busy}
              className={`${inputClass} tabular text-center text-xl tracking-[0.3em]`}
            />
            {codeFehler && code.length === 6 && (
              <p role="alert" className="text-xs font-semibold text-red-300">
                Code falsch – bitte aktuellen Code aus der App nehmen.
              </p>
            )}
            <button type="button" onClick={abbrechen} className="min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] hover:text-[#a3ad9a]">
              Abbrechen
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Sektion: Aktive Sessions ── */

function SessionsSektion() {
  const user = useUser({ or: "redirect" });
  const [sitzungen, setSitzungen] = useState<Sitzung[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bestaetigeAlle, setBestaetigeAlle] = useState(false);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const liste = (await user.getActiveSessions()) as unknown as Sitzung[];
        if (aktiv) setSitzungen(liste);
      } catch (err) {
        if (aktiv) setFehler(fehlerText(err, "Sessions konnten nicht geladen werden."));
      }
    })();
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beenden(id: string) {
    setBusy(id);
    setFehler(null);
    setInfo(null);
    try {
      await user.revokeSession(id);
      setSitzungen((prev) => (prev ?? []).filter((s) => s.id !== id));
      setInfo("Session beendet.");
    } catch (err) {
      setFehler(fehlerText(err, "Session konnte nicht beendet werden."));
    } finally {
      setBusy(null);
    }
  }

  async function alleAnderenBeenden() {
    const ziele = (sitzungen ?? []).filter((s) => !s.isCurrentSession);
    setBusy("alle");
    setFehler(null);
    try {
      await Promise.all(ziele.map((s) => user.revokeSession(s.id)));
      setSitzungen((prev) => (prev ?? []).filter((s) => s.isCurrentSession));
      setBestaetigeAlle(false);
      setInfo("Alle anderen Sessions beendet.");
    } catch (err) {
      setFehler(fehlerText(err, "Konnte nicht alle Sessions beenden."));
    } finally {
      setBusy(null);
    }
  }

  const andere = (sitzungen ?? []).filter((s) => !s.isCurrentSession);

  return (
    <section className="card p-6 md:p-8" aria-label="Aktive Sessions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Sessions</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
            Aktive Logins
          </h2>
        </div>
        {andere.length > 0 &&
          (bestaetigeAlle ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={alleAnderenBeenden}
                disabled={busy === "alle"}
                className="min-h-[44px] rounded-lg bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "alle" ? "…" : "Bestätigen"}
              </button>
              <button type="button" onClick={() => setBestaetigeAlle(false)} className={btnSekundaer}>
                Abbrechen
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setBestaetigeAlle(true)} className={btnSekundaer}>
              Alle anderen beenden
            </button>
          ))}
      </div>
      <p className="mt-2 text-sm text-[#a3ad9a]">
        Geräte, auf denen du gerade eingeloggt bist. Unbekanntes dabei? Sofort beenden.
      </p>
      {fehler && (
        <p role="alert" className="mt-3 text-xs font-semibold text-red-300">
          {fehler}
        </p>
      )}
      {info && (
        <p role="status" className="mt-3 text-xs font-semibold text-[#8fa96d]">
          {info}
        </p>
      )}
      <div className="mt-4">
        {sitzungen === null ? (
          <div className="shimmer h-24 rounded-xl" aria-busy="true" />
        ) : sitzungen.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#6b7565]">Keine Sessions gefunden.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
            {sitzungen.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[#ede8d6]">
                    {s.isCurrentSession ? "Dieses Gerät" : (s.geoInfo?.cityName ?? "Unbekanntes Gerät")}
                    {s.isCurrentSession && (
                      <span className="rounded-md bg-[#8fa96d]/15 px-2 py-0.5 text-[11px] font-semibold text-[#abc189]">
                        Aktuell
                      </span>
                    )}
                    {s.isImpersonation && (
                      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                        Impersonation
                      </span>
                    )}
                  </p>
                  <p className="tabular mt-0.5 text-xs text-[#6b7565]">
                    Seit {new Date(s.createdAt).toLocaleString("de-DE")}
                    {s.lastUsedAt ? ` · Zuletzt ${new Date(s.lastUsedAt).toLocaleString("de-DE")}` : ""}
                    {s.geoInfo?.ip ? ` · ${s.geoInfo.ip}` : ""}
                  </p>
                </div>
                {!s.isCurrentSession && (
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => beenden(s.id)}
                    className="min-h-[40px] rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-300 hover:border-red-500/50 disabled:opacity-50"
                  >
                    {busy === s.id ? "…" : "Beenden"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── Gesamt: Einstellungen ── */

export function EinstellungenClient() {
  return (
    <div className="space-y-4">
      <BenutzernameSektion />
      <AnzeigenameSektion />
      <EmailsSektion />
      <PasswortSektion />
      <PasskeySektion />
      <MfaSektion />
      <SessionsSektion />
    </div>
  );
}
