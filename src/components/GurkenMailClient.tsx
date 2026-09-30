"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PwaInstallPopup } from "@/components/PwaInstallPopup";
import { TurnstileWidget, turnstileKonfiguriert } from "@/components/TurnstileWidget";
import type { GurkenmailDetail, GurkenmailEingang } from "@/lib/gurkenmail";

type Mailbox = { localpart: string; address: string; displayName: string };
type Ansicht = "liste" | "lesen" | "schreiben";

/** GurkenMail als echter Mail-Client: Posteingang → Mail lesen → Schreiben per Button. */
export function GurkenMailClient() {
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [restHeute, setRestHeute] = useState(3);
  const [limit] = useState(3);
  const [mails, setMails] = useState<GurkenmailEingang[]>([]);
  const [inboxBereit, setInboxBereit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<Ansicht>("liste");

  const [localpart, setLocalpart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [anlegen, setAnlegen] = useState(false);

  const [offeneMail, setOffeneMail] = useState<GurkenmailDetail | null>(null);
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

  const laden = useCallback(async () => {
    setLoading(true);
    setFehler(null);
    try {
      const boxRes = await fetch("/api/gurkenmail/mailbox");
      const box = await boxRes.json();
      if (boxRes.ok && box.mailbox) {
        setMailbox(box.mailbox);
        setRestHeute(box.restHeute ?? 3);
        const inboxRes = await fetch("/api/gurkenmail/inbox");
        const inbox = await inboxRes.json();
        setMails(Array.isArray(inbox.mails) ? inbox.mails : []);
        setInboxBereit(Boolean(inbox.bereit));
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

  async function handleAnlegen(e: React.FormEvent) {
    e.preventDefault();
    setAnlegen(true);
    setFehler(null);
    try {
      const res = await fetch("/api/gurkenmail/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localpart, displayName }),
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

  async function mailOeffnen(id: string) {
    setAnsicht("lesen");
    setLeseLaden(true);
    setLeseFehler(null);
    setOffeneMail(null);
    try {
      const res = await fetch(`/api/gurkenmail/mail/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mail konnte nicht geladen werden");
      setOffeneMail(data.mail);
      setMails((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
    } catch (err) {
      setLeseFehler(err instanceof Error ? err.message : "Mail konnte nicht geladen werden");
    } finally {
      setLeseLaden(false);
    }
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
          Beim ersten Besuch suchst du dir den Namen vor dem @ aus – plus Absendername.
          Danach heißt du z.B. <strong className="text-[#ede8d6]">gurkenfan@gurkensekte.de</strong>.
        </p>
        <form onSubmit={handleAnlegen} className="mt-5 space-y-3">
          <label className="block text-xs font-semibold text-[#a3ad9a]">
            Name vor dem @ (3–30 Zeichen, a–z, 0–9, . - _)
            <span className="flex items-center gap-1">
              <input
                value={localpart}
                onChange={(e) => setLocalpart(e.target.value)}
                placeholder="gurkenfan"
                autoComplete="off"
                className={inputClass}
              />
              <span className="shrink-0 text-sm text-[#6b7565]">@gurkensekte.de</span>
            </span>
          </label>
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#8fa96d]/25 bg-[#8fa96d]/[0.06] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa96d]">
          Deine GurkenMail
        </p>
        <p className="font-display mt-1 break-all text-2xl font-semibold text-[#faf8f1]">
          {mailbox.address}
        </p>
        <p className="mt-1 text-sm text-[#a3ad9a]">
          Absendername: <strong className="text-[#ede8d6]">{mailbox.displayName}</strong> · Heute noch{" "}
          <strong className="tabular text-[#ede8d6]">{restHeute} / {limit}</strong> Mails
        </p>
        {!inboxBereit && (
          <p className="mt-2 text-xs text-[#6b7565]">
            Empfang wird gerade freigeschaltet (Cloudflare-Routing). Senden geht schon.
          </p>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        {/* Client-Kopf: Ansicht wechseln */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            {ansicht !== "liste" && (
              <button
                onClick={() => setAnsicht("liste")}
                className="flex min-h-[40px] items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-[#a3ad9a] hover:border-white/20 hover:text-[#ede8d6]"
              >
                ← Zurück
              </button>
            )}
            <h2 className="font-display text-lg font-semibold text-[#faf8f1]">
              {ansicht === "liste" && <>📥 Posteingang{ungelesen > 0 && <> ({ungelesen} neu)</>}</>}
              {ansicht === "lesen" && "📨 Nachricht"}
              {ansicht === "schreiben" && "✉️ Neue Mail"}
            </h2>
          </div>
          {ansicht === "liste" && (
            <button
              onClick={() => {
                setSendeOk(false);
                setSendeIntern(false);
                setSendeFehler(null);
                setAnsicht("schreiben");
              }}
              disabled={restHeute <= 0}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#ede8d6] px-4 py-2 text-sm font-semibold text-[#0b120d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✏️ Senden
            </button>
          )}
        </div>

        {ansicht === "liste" && (
          <div className="p-4 md:p-6">
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
                      onClick={() => mailOeffnen(m.id)}
                      className="block w-full px-2 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="flex items-center gap-2">
                        {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#8fa96d]" aria-label="ungelesen" />}
                        <span className={`truncate text-sm ${m.read ? "font-normal text-[#a3ad9a]" : "font-semibold text-[#ede8d6]"}`}>
                          {m.subject || "(ohne Betreff)"}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate pl-4 text-xs text-[#6b7565]">
                        {m.from} · {new Date(m.receivedAt).toLocaleString("de-DE")}
                      </span>
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
              className="mt-3 w-full min-h-[40px] rounded-lg text-[13px] font-semibold text-[#6b7565] hover:text-[#a3ad9a]"
            >
              ↻ Aktualisieren
            </button>
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
                <p className="mt-1 text-xs text-[#6b7565]">
                  Von {offeneMail.from} · {new Date(offeneMail.receivedAt).toLocaleString("de-DE")}
                </p>
                {offeneMail.attachmentsDropped > 0 && (
                  <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#6b7565]">
                    {offeneMail.attachmentsDropped} Anhang/Anhänge entfernt (kein Anhang-Support in v1).
                  </p>
                )}
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#ede8d6]">
                  {offeneMail.text}
                </p>
              </article>
            )}
          </div>
        )}

        {ansicht === "schreiben" && (
          <form onSubmit={handleSenden} className="space-y-3 p-4 md:p-6">
            <p className="text-xs text-[#6b7565]">
              Von: {mailbox.address} · Extern max. 3/Tag, nur Text, keine Anhänge in v1.
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
                {restHeute <= 0 ? "Limit erreicht (morgen wieder)" : senden ? "Wird gesendet …" : "✉️ Senden"}
              </button>
              <button
                type="button"
                onClick={() => setAnsicht("liste")}
                className="min-h-[48px] rounded-lg border border-white/12 px-5 py-3 text-sm font-semibold text-[#a3ad9a] hover:text-[#ede8d6]"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-[#4a5548]">
        <Link href="/mitglieder" className="underline underline-offset-2 hover:text-[#a3ad9a]">
          Zurück zum Dashboard
        </Link>
      </p>
      <PwaInstallPopup />
    </div>
  );
}
