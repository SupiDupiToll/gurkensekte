"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import { useUser } from "@hexclave/next";
import { PwaInstallPopup } from "@/components/PwaInstallPopup";
import { TurnstileWidget, turnstileKonfiguriert } from "@/components/TurnstileWidget";
import type {
  GurkenmailDetail,
  GurkenmailEingang,
  GurkenmailGesendet,
  GurkenmailGesendetDetail,
} from "@/lib/gurkenmail";
import { absenderMail, absenderVorname, vorschlagsBasis } from "@/lib/gurkenmail";

type Mailbox = { localpart: string; address: string; displayName: string };
type Ansicht = "liste" | "versendet" | "lesen" | "schreiben";
type LeseQuelle = "inbox" | "sent";

/** Mail-Adresse aus "Name <mail>" oder purer Adresse ziehen. */
function adresseAusFrom(from: string): string {
  const mail = absenderMail(from);
  if (mail) return mail;
  const kandidat = from.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kandidat) ? kandidat : "";
}

/** Anzeigename für Listen: Vorname aus "Name <mail>", sonst die Adresse selbst. */
function absenderAnzeigename(absenderOderMail: string): string {
  return absenderVorname(absenderOderMail) || absenderOderMail;
}

function zitieren(text: string): string {
  return text
    .split("\n")
    .map((zeile) => `> ${zeile}`)
    .join("\n");
}

/** Anzahl eingebetteter Bilder im Roh-HTML (für den Tracking-Hinweis). */
function zaehleBilder(html: string): number {
  return html.match(/<img(?=[\s/>])/gi)?.length ?? 0;
}

/**
 * Formatierte Mail-Ansicht mit doppeltem Schutz:
 * 1. DOMPurify entfernt Skripte, Formulare, Event-Handler, Frames & Co.
 * 2. Sandbox-iframe ohne Scripts (`sandbox` ohne allow-scripts/allow-same-origin),
 *    sodass selbst durchgeflutschtes JS nicht laufen kann. Links dürfen per
 *    allow-popups in neuem Tab öffnen.
 * Externe Bilder sind default aus (Tracking-Schutz) und laden erst nach Klick.
 */
function SichereMailAnsicht({ html }: { html: string }) {
  const [bilderAnzeigen, setBilderAnzeigen] = useState(false);
  const [sauber, setSauber] = useState("");
  const bildAnzahl = useMemo(() => zaehleBilder(html), [html]);

  useEffect(() => {
    // Nur im Browser sanitizen (DOMPurify braucht window) – kein SSR.
    const verboteneTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "select",
      "textarea",
      "option",
      "link",
      "meta",
      "base",
      "title",
      "frame",
      "frameset",
      "applet",
    ];
    if (!bilderAnzeigen) {
      verboteneTags.push("img", "picture", "video", "audio", "source", "track");
    }
    // Client-only: DOMPurify braucht window, daher kein SSR möglich.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSauber(
      DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: verboteneTags,
        FORBID_ATTR: ["action", "formaction", "background", "poster"],
      }),
    );
  }, [html, bilderAnzeigen]);

  const dokument = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<style>html,body{margin:0;padding:12px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;` +
      `font-size:14px;line-height:1.6;color:#1a1a1a;background:#fff;word-wrap:break-word}` +
      `img{max-width:100%;height:auto}a{color:#1a56db;word-break:break-all}` +
      `table{max-width:100%;border-collapse:collapse}td,th{padding:4px 8px}` +
      `pre,code{white-space:pre-wrap;word-break:break-word}blockquote{margin:0 0 8px;padding-left:12px;border-left:3px solid #ddd;color:#555}</style>` +
      `</head><body>${sauber}</body></html>`,
    [sauber],
  );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[#6b7565]">
          🔒 Sichere Ansicht – Skripte &amp; Formulare blockiert
        </p>
        {bildAnzahl > 0 && !bilderAnzeigen && (
          <button
            type="button"
            onClick={() => setBilderAnzeigen(true)}
            className="min-h-[40px] rounded-lg border border-[#8fa96d]/30 px-3 py-1.5 text-xs font-semibold text-[#abc189] hover:border-[#8fa96d]/60"
          >
            🖼️ {bildAnzahl === 1 ? "1 Bild" : `${bildAnzahl} Bilder`} laden (extern, Tracking möglich)
          </button>
        )}
        {bildAnzahl > 0 && bilderAnzeigen && (
          <button
            type="button"
            onClick={() => setBilderAnzeigen(false)}
            className="min-h-[40px] rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#6b7565] hover:text-[#a3ad9a]"
          >
            Bilder wieder ausblenden
          </button>
        )}
      </div>
      <iframe
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={dokument}
        title="Formatierte Mail-Ansicht"
        className="mt-2 h-[420px] w-full rounded-xl border border-white/10 bg-white"
      />
    </div>
  );
}

/** GurkenMail als echter Mail-Client: Posteingang, Versendet, Lesen, Antworten, Weiterleiten. */
export function GurkenMailClient() {
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [restHeute, setRestHeute] = useState(3);
  const [limit] = useState(3);
  const [mails, setMails] = useState<GurkenmailEingang[]>([]);
  const [sentMails, setSentMails] = useState<GurkenmailGesendet[]>([]);
  const [inboxBereit, setInboxBereit] = useState(false);
  const [sentBereit, setSentBereit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>("liste");
  const [leseQuelle, setLeseQuelle] = useState<LeseQuelle>("inbox");

  const [nummer, setNummer] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [anlegen, setAnlegen] = useState(false);

  const [offeneMail, setOffeneMail] = useState<GurkenmailDetail | null>(null);
  const [offeneGesendete, setOffeneGesendete] = useState<GurkenmailGesendetDetail | null>(null);
  const [htmlModus, setHtmlModus] = useState(true);
  const [leseLaden, setLeseLaden] = useState(false);
  const [leseFehler, setLeseFehler] = useState<string | null>(null);

  const [an, setAn] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [senden, setSenden] = useState(false);
  const [sendeFehler, setSendeFehler] = useState<string | null>(null);
  const [sendeOk, setSendeOk] = useState(false);
  const [sendeIntern, setSendeIntern] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [versandHinweis, setVersandHinweis] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const hexUser = useUser();
  const vorausgefuellt = useRef(false);

  const laden = useCallback(async () => {
    setLoading(true);
    setFehler(null);
    try {
      const boxRes = await fetch("/api/gurkenmail/mailbox");
      const box = await boxRes.json();
      if (boxRes.ok && box.mailbox) {
        setMailbox(box.mailbox);
        setRestHeute(box.restHeute ?? 3);
        const [inboxRes, sentRes] = await Promise.all([
          fetch("/api/gurkenmail/inbox"),
          fetch("/api/gurkenmail/sent"),
        ]);
        const inbox = await inboxRes.json();
        const sent = await sentRes.json();
        setMails(Array.isArray(inbox.mails) ? inbox.mails : []);
        setInboxBereit(Boolean(inbox.bereit));
        setSentMails(Array.isArray(sent.mails) ? sent.mails : []);
        setSentBereit(Boolean(sent.bereit));
      } else if (boxRes.status === 401) {
        setFehler("Bitte einloggen, um GurkenMail zu nutzen.");
      } else {
        setMailbox(null);
      }
    } catch {
      setFehler("Postfach konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Einmaliges Laden beim Mount – kein State-Sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  // Adress-Vorschlag aus dem Mitgliedsnamen: Vorname → Localpart,
  // voller Name → Absendername. Die Basis ist vorgegeben, nur die Zahl
  // bei belegter Adresse ist frei wählbar.
  useEffect(() => {
    if (vorausgefuellt.current || mailbox || loading) return;
    const name = hexUser?.displayName?.trim();
    if (!name) return;
    vorausgefuellt.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayName(name.replace(/[\r\n]+/g, " ").slice(0, 40));
  }, [hexUser, mailbox, loading]);

  const basis = vorschlagsBasis(hexUser?.displayName);
  const vorschauAdresse = `${basis}${nummer}@gurkensekte.de`;

  async function handleAnlegen(e: React.FormEvent) {
    e.preventDefault();
    setAnlegen(true);
    setFehler(null);
    try {
      const res = await fetch("/api/gurkenmail/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localpart: `${basis}${nummer}`, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Anlegen fehlgeschlagen");
      setMailbox(data.mailbox);
      await laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
    } finally {
      setAnlegen(false);
    }
  }

  async function mailOeffnen(id: string, quelle: LeseQuelle) {
    setLeseQuelle(quelle);
    setAnsicht("lesen");
    setLeseLaden(true);
    setLeseFehler(null);
    setOffeneMail(null);
    setOffeneGesendete(null);
    setHtmlModus(true);
    setVersandHinweis(false);
    try {
      const pfad =
        quelle === "inbox"
          ? `/api/gurkenmail/mail/${encodeURIComponent(id)}`
          : `/api/gurkenmail/sent/${encodeURIComponent(id)}`;
      const res = await fetch(pfad);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mail konnte nicht geladen werden");
      if (quelle === "inbox") {
        setOffeneMail({ ...data.mail, html: data.mail.html ?? "" });
        setMails((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
      } else {
        setOffeneGesendete(data.mail);
      }
    } catch (err) {
      setLeseFehler(err instanceof Error ? err.message : "Mail konnte nicht geladen werden");
    } finally {
      setLeseLaden(false);
    }
  }

  function composeOeffnen(neuerAn: string, neuerBetreff: string, neuerText: string) {
    setAn(neuerAn);
    setBetreff(neuerBetreff);
    setText(neuerText);
    setSendeOk(false);
    setSendeIntern(false);
    setSendeFehler(null);
    setVersandHinweis(false);
    setAnsicht("schreiben");
  }

  function antworten() {
    if (!offeneMail) return;
    const ziel = adresseAusFrom(offeneMail.from);
    const re = offeneMail.subject.toLowerCase().startsWith("re:")
      ? offeneMail.subject
      : `Re: ${offeneMail.subject || "(ohne Betreff)"}`;
    const datum = new Date(offeneMail.receivedAt).toLocaleString("de-DE");
    composeOeffnen(
      ziel,
      re,
      `\n\n---\nAm ${datum} schrieb ${offeneMail.from}:\n${zitieren(offeneMail.text)}`,
    );
  }

  function weiterleiten() {
    const quelle = offeneMail
      ? {
          von: offeneMail.from,
          datum: new Date(offeneMail.receivedAt).toLocaleString("de-DE"),
          betreff: offeneMail.subject || "(ohne Betreff)",
          text: offeneMail.text,
        }
      : offeneGesendete
        ? {
            von: mailbox?.address ?? "",
            datum: new Date(offeneGesendete.sentAt).toLocaleString("de-DE"),
            betreff: offeneGesendete.subject || "(ohne Betreff)",
            text: offeneGesendete.text,
          }
        : null;
    if (!quelle) return;
    const wg = quelle.betreff.toLowerCase().startsWith("wg:")
      ? quelle.betreff
      : `Wg: ${quelle.betreff}`;
    composeOeffnen(
      "",
      wg,
      `\n\n--- Weitergeleitete Nachricht ---\nVon: ${quelle.von}\nDatum: ${quelle.datum}\nBetreff: ${quelle.betreff}\n\n${quelle.text}`,
    );
  }

  /** Leichte Listen-Aktualisierung ohne Lade-Screen (nach Versand). */
  const ladeListen = useCallback(async () => {
    try {
      const [inboxRes, sentRes] = await Promise.all([
        fetch("/api/gurkenmail/inbox"),
        fetch("/api/gurkenmail/sent"),
      ]);
      const inbox = await inboxRes.json();
      const sent = await sentRes.json();
      if (Array.isArray(inbox.mails)) setMails(inbox.mails);
      if (Array.isArray(sent.mails)) setSentMails(sent.mails);
    } catch {
      // ignore
    }
  }, []);

  async function adresseKopieren() {
    if (!mailbox) return;
    try {
      await navigator.clipboard.writeText(mailbox.address);
    } catch {
      // Fallback für alte Browser: temporäres Input-Element.
      const el = document.createElement("input");
      el.value = mailbox.address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }

  async function handleSenden(e: React.FormEvent) {
    e.preventDefault();
    setSenden(true);
    setSendeFehler(null);
    setSendeOk(false);
    try {
      const res = await fetch("/api/gurkenmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ an, betreff, text, turnstileToken: captchaToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresTurnstile) {
          setCaptchaToken(null);
          setCaptchaReset((n) => n + 1);
        }
        throw new Error(data.error ?? "Versand fehlgeschlagen");
      }
      setSendeOk(true);
      setSendeIntern(Boolean(data.intern));
      setAn("");
      setBetreff("");
      setText("");
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
      setRestHeute(data.restHeute ?? 0);
      // Direkt zurück in die Inbox – Versendet-Tab im Hintergrund auffrischen.
      setAnsicht("liste");
      setVersandHinweis(true);
      await ladeListen();
    } catch (err) {
      setSendeFehler(err instanceof Error ? err.message : "Versand fehlgeschlagen");
    } finally {
      setSenden(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-base text-[#ede8d6] placeholder-[#6b7565]/70 outline-none focus:border-[#8fa96d]";

  if (loading) {
    return (
      <div className="space-y-3 py-4" aria-busy="true">
        <div className="shimmer h-24 rounded-2xl" />
        <div className="shimmer h-40 rounded-2xl" />
      </div>
    );
  }

  if (!mailbox) {
    return (
      <div className="card p-6 md:p-8">
        <p className="eyebrow">GurkenMail</p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-[#faf8f1]">
          Wähle deine Gurken-Adresse
        </h2>
        <p className="mt-2 text-sm text-[#a3ad9a]">
          Deine Adresse wird aus deinem Vornamen vergeben – du kannst sie nicht frei
          wählen. Ist sie schon besetzt, häng einfach eine Zahl an (z. B.{" "}
          <strong className="text-[#ede8d6]">{basis}2@gurkensekte.de</strong>).
        </p>
        <form onSubmit={handleAnlegen} className="mt-5 space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold text-[#a3ad9a]">Deine GurkenMail-Adresse</p>
            <p className="font-display mt-1 break-all text-xl font-semibold text-[#faf8f1]">
              {vorschauAdresse}
            </p>
            <label className="mt-3 block text-xs font-semibold text-[#a3ad9a]">
              Zahl anhängen (optional, nur falls besetzt – du wählst sie selbst)
              <input
                value={nummer}
                onChange={(e) => setNummer(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="z. B. 2"
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-[#a3ad9a]">
            Absendername (2–40 Zeichen, steht beim Empfänger im Postfach)
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Gurken Fan"
              autoComplete="off"
              className={inputClass}
            />
          </label>
          {fehler && (
            <p role="alert" className="text-xs font-semibold text-red-300">
              {fehler}
            </p>
          )}
          <button
            type="submit"
            disabled={anlegen}
            className="btn-cta btn-cta-primary min-h-[48px] w-full !text-[15px] disabled:opacity-50"
          >
            {anlegen ? "Wird angelegt …" : "🥒 Adresse sichern"}
          </button>
        </form>
        <PwaInstallPopup />
      </div>
    );
  }

  const ungelesen = mails.filter((m) => !m.read).length;
  const inListe = ansicht === "liste" || ansicht === "versendet";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#8fa96d]/25 bg-[#8fa96d]/[0.06] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa96d]">
          Deine GurkenMail
        </p>
        <p className="font-display mt-1 break-all text-2xl font-semibold text-[#faf8f1]">
          {mailbox.address}
        </p>
        <button
          onClick={adresseKopieren}
          className="mt-2 flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#8fa96d]/30 px-3 py-1.5 text-[13px] font-semibold text-[#abc189] transition-colors hover:border-[#8fa96d]/60 hover:text-[#c9d6ae]"
        >
          {kopiert ? "✓ Kopiert!" : "📋 Adresse kopieren"}
        </button>
        <p className="mt-1 text-sm text-[#a3ad9a]">
          Absendername: <strong className="text-[#ede8d6]">{mailbox.displayName}</strong> · Schreiben heute noch{" "}
          <strong className="tabular text-[#ede8d6]">{restHeute} / {limit}</strong>
        </p>
        <p className="mt-1 text-xs text-[#6b7565]">
          Das 3er-Limit gilt nur fürs Schreiben – Empfangen ist unbegrenzt.
        </p>
        {!inboxBereit && (
          <p className="mt-2 text-xs text-[#6b7565]">
            Empfang wird gerade freigeschaltet (Cloudflare-Routing). Senden geht schon.
          </p>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        {/* Client-Kopf: Tabs + Aktionen */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            {ansicht !== "liste" && ansicht !== "versendet" && (
              <button
                onClick={() => setAnsicht(leseQuelle === "sent" ? "versendet" : "liste")}
                className="flex min-h-[40px] items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-[#a3ad9a] hover:border-white/20 hover:text-[#ede8d6]"
              >
                ← Zurück
              </button>
            )}
            {inListe ? (
              <div className="flex gap-1 rounded-lg border border-white/10 p-1" role="tablist" aria-label="Ordner">
                <button
                  role="tab"
                  aria-selected={ansicht === "liste"}
                  onClick={() => {
                    setVersandHinweis(false);
                    setAnsicht("liste");
                  }}
                  className={`min-h-[40px] rounded-md px-3 py-1.5 text-[13px] font-semibold ${ansicht === "liste" ? "bg-[#ede8d6] text-[#0b120d]" : "text-[#a3ad9a] hover:text-[#ede8d6]"}`}
                >
                  📥 Posteingang{ungelesen > 0 && <> ({ungelesen})</>}
                </button>
                <button
                  role="tab"
                  aria-selected={ansicht === "versendet"}
                  onClick={() => {
                    setVersandHinweis(false);
                    setAnsicht("versendet");
                  }}
                  className={`min-h-[40px] rounded-md px-3 py-1.5 text-[13px] font-semibold ${ansicht === "versendet" ? "bg-[#ede8d6] text-[#0b120d]" : "text-[#a3ad9a] hover:text-[#ede8d6]"}`}
                >
                  📤 Versendet
                </button>
              </div>
            ) : (
              <h2 className="font-display text-lg font-semibold text-[#faf8f1]">
                {ansicht === "lesen" && (leseQuelle === "sent" ? "📨 Gesendete Nachricht" : "📨 Nachricht")}
                {ansicht === "schreiben" && "✉️ Neue Mail"}
              </h2>
            )}
          </div>
          {inListe && (
            <button
              onClick={() => composeOeffnen("", "", "")}
              disabled={restHeute <= 0}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#ede8d6] px-4 py-2 text-sm font-semibold text-[#0b120d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✏️ Senden
            </button>
          )}
        </div>

        {ansicht === "liste" && (
          <div className="p-4 md:p-6">
            {versandHinweis && (
              <p role="status" className="mb-3 rounded-xl border border-[#8fa96d]/30 bg-[#8fa96d]/[0.07] px-3 py-2 text-center text-[13px] font-semibold text-[#8fa96d]">
                🥒 Versendet – landet gleich im Versendet-Tab.
              </p>
            )}
            {mails.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#6b7565]">
                {inboxBereit
                  ? "Noch keine Mails – dein Postfach wartet auf Gurkenpost."
                  : "Sobald das Routing steht, landen hier deine eingehenden Mails."}
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {mails.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => mailOeffnen(m.id, "inbox")}
                      className="block w-full px-2 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="flex items-center gap-2">
                        {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#8fa96d]" aria-label="ungelesen" />}
                        <span className={`truncate text-sm ${m.read ? "font-normal text-[#a3ad9a]" : "font-semibold text-[#ede8d6]"}`}>
                          {absenderAnzeigename(m.from)}: {m.subject || "(ohne Betreff)"}
                          {m.attachmentsDropped > 0 && <span title="Anhang entfernt"> 📎</span>}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate pl-4 text-xs text-[#6b7565]">
                        {m.from} · {new Date(m.receivedAt).toLocaleString("de-DE")}
                      </span>
                      {m.attachmentsDropped > 0 && (
                        <span className="mt-0.5 block truncate pl-4 text-xs text-[#abc189]">
                          📎 {m.attachmentsDropped === 1 ? "1 Anhang entfernt" : `${m.attachmentsDropped} Anhänge entfernt`} – nur Text gespeichert
                        </span>
                      )}
                      <span className="mt-0.5 block truncate pl-4 text-[13px] text-[#6b7565]">
                        {m.snippet}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={laden}
              className="mt-3 min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] hover:text-[#a3ad9a]"
            >
              ↻ Aktualisieren
            </button>
          </div>
        )}

        {ansicht === "versendet" && (
          <div className="p-4 md:p-6">
            {!sentBereit ? (
              <p className="py-6 text-center text-sm text-[#6b7565]">
                Versendet-Verlauf wird freigeschaltet, sobald der Empfangs-Worker verbunden ist.
              </p>
            ) : sentMails.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#6b7565]">
                Noch nichts versendet – schreib deine erste Gurkenpost.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {sentMails.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => mailOeffnen(m.id, "sent")}
                      className="block w-full px-2 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="truncate text-sm font-normal text-[#a3ad9a]">
                        {m.subject || "(ohne Betreff)"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#6b7565]">
                        An {absenderAnzeigename(m.to)} · {new Date(m.sentAt).toLocaleString("de-DE")}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-[#6b7565]">
                        {m.snippet}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {ansicht === "lesen" && (
          <div className="p-4 md:p-6">
            {leseLaden && <div className="shimmer h-40 rounded-xl" aria-busy="true" />}
            {leseFehler && (
              <p role="alert" className="py-6 text-center text-sm font-semibold text-red-300">
                {leseFehler}
              </p>
            )}
            {offeneMail && (
              <article>
                <h3 className="font-display text-xl font-semibold text-[#faf8f1]">
                  {offeneMail.subject || "(ohne Betreff)"}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#ede8d6]">
                  Von {absenderAnzeigename(offeneMail.from)}
                </p>
                <p className="text-xs text-[#6b7565]">
                  {adresseAusFrom(offeneMail.from) || offeneMail.from} · {new Date(offeneMail.receivedAt).toLocaleString("de-DE")}
                </p>
                {offeneMail.attachmentsDropped > 0 && (
                  <p className="mt-2 rounded-lg border border-[#8fa96d]/25 bg-[#8fa96d]/[0.07] px-3 py-2 text-xs leading-relaxed text-[#abc189]">
                    📎 {offeneMail.attachmentsDropped === 1
                      ? "1 Anhang wurde entfernt"
                      : `${offeneMail.attachmentsDropped} Anhänge wurden entfernt`} – Anhänge werden in GurkenMail nicht gespeichert, der Text wurde normal zugestellt.
                  </p>
                )}
                {(offeneMail.html || "").trim() && (
                  <div className="mt-3 flex w-fit gap-1 rounded-lg border border-white/10 p-1" role="tablist" aria-label="Darstellung">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={htmlModus}
                      onClick={() => setHtmlModus(true)}
                      className={`min-h-[40px] rounded-md px-3 py-1.5 text-[13px] font-semibold ${htmlModus ? "bg-[#ede8d6] text-[#0b120d]" : "text-[#a3ad9a] hover:text-[#ede8d6]"}`}
                    >
                      🖼️ Formatiert
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={!htmlModus}
                      onClick={() => setHtmlModus(false)}
                      className={`min-h-[40px] rounded-md px-3 py-1.5 text-[13px] font-semibold ${!htmlModus ? "bg-[#ede8d6] text-[#0b120d]" : "text-[#a3ad9a] hover:text-[#ede8d6]"}`}
                    >
                      📝 Text
                    </button>
                  </div>
                )}
                {(offeneMail.html || "").trim() && htmlModus ? (
                  <SichereMailAnsicht html={offeneMail.html} />
                ) : (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#ede8d6]">
                    {offeneMail.text}
                  </p>
                )}
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={antworten}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#ede8d6] px-4 py-2 text-sm font-semibold text-[#0b120d] active:scale-[0.98]"
                  >
                    ↩️ Antworten
                  </button>
                  <button
                    onClick={weiterleiten}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 px-4 py-2 text-sm font-semibold text-[#a3ad9a] hover:text-[#ede8d6]"
                  >
                    ➡️ Weiterleiten
                  </button>
                </div>
              </article>
            )}
            {offeneGesendete && (
              <article>
                <h3 className="font-display text-xl font-semibold text-[#faf8f1]">
                  {offeneGesendete.subject || "(ohne Betreff)"}
                </h3>
                <p className="mt-1 text-xs text-[#6b7565]">
                  An {offeneGesendete.to} · {new Date(offeneGesendete.sentAt).toLocaleString("de-DE")}
                </p>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#ede8d6]">
                  {offeneGesendete.text}
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={weiterleiten}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 px-4 py-2 text-sm font-semibold text-[#a3ad9a] hover:text-[#ede8d6]"
                  >
                    ➡️ Weiterleiten
                  </button>
                </div>
              </article>
            )}
          </div>
        )}

        {ansicht === "schreiben" && (
          <form onSubmit={handleSenden} className="space-y-3 p-4 md:p-6">
            <p className="text-xs text-[#6b7565]">
              Von: {mailbox.address} · Schreiben extern max. 3/Tag, nur Text. Empfangen ist immer unbegrenzt – Anhänge eingehender Mails werden entfernt (nur Text wird gespeichert).
            </p>
            <p className="rounded-xl border border-[#8fa96d]/25 bg-[#8fa96d]/[0.06] px-3 py-2 text-xs leading-relaxed text-[#a3ad9a]">
              🥒 <strong className="text-[#ede8d6]">Gurken-Intern gratis:</strong> Mails an andere
              @gurkensekte.de-Adressen landen direkt in deren Postfach – ohne Resend und{" "}
              <strong className="text-[#ede8d6]">ohne Abzug von deinem 3/Tag-Limit</strong>.
            </p>
            <label className="block text-xs font-semibold text-[#a3ad9a]">
              An (1 Empfänger)
              <input value={an} onChange={(e) => setAn(e.target.value)} placeholder="freund@beispiel.de" inputMode="email" className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-[#a3ad9a]">
              Betreff
              <input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Heilige Gurkenpost" className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-[#a3ad9a]">
              Nachricht (max. 10.000 Zeichen)
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Sei gegrüßt im Glas …" className={`${inputClass} resize-y`} />
            </label>
            {turnstileKonfiguriert() && (
              <TurnstileWidget
                resetKey={captchaReset}
                onVerify={(t) => setCaptchaToken(t)}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
              />
            )}
            {sendeFehler && (
              <p role="alert" className="text-xs font-semibold text-red-300">
                {sendeFehler}
              </p>
            )}
            {sendeOk && (
              <p role="status" className="text-xs font-semibold text-[#8fa96d]">
                {sendeIntern
                  ? "🥒 Direkt ins Gurken-Postfach gelegt – zählt nicht zum Limit!"
                  : "🥒 Versendet!"}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={senden || restHeute <= 0}
                className="btn-cta btn-cta-primary min-h-[48px] flex-1 !text-[15px] disabled:opacity-40"
              >
                {restHeute <= 0 ? "Schreib-Limit erreicht (morgen wieder)" : senden ? "Wird gesendet …" : "✉️ Senden"}
              </button>
              <button
                type="button"
                onClick={() => setAnsicht(leseQuelle === "sent" ? "versendet" : "liste")}
                className="min-h-[48px] rounded-lg border border-white/12 px-5 py-3 text-sm font-semibold text-[#a3ad9a] hover:text-[#ede8d6]"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-6">
        <Link
          href="/mitglieder"
          className="btn-cta flex min-h-[56px] w-full items-center justify-center gap-2 !text-base"
        >
          ← Zurück zum Dashboard
        </Link>
      </div>
      <PwaInstallPopup />
    </div>
  );
}
