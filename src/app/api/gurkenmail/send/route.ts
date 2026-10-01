import { hexclaveServerApp } from "@/hexclave/server";
import {
  GURKENMAIL_DOMAIN,
  GURKENMAIL_INTERN_MAX_PRO_TAG,
  GURKENMAIL_MAX_PRO_TAG,
  gesendetHeute,
  heuteISO,
  internGesendetHeute,
  internerLocalpart,
  istInterneAdresse,
  leseMailbox,
} from "@/lib/gurkenmail";
import { inboundKonfiguriert, speichereGesendet } from "@/lib/gurkenmailServer";
import { mitBenutzerSperre, rateLimit, rateLimitAntwort } from "@/lib/ratelimit";
import { getClientIp, pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";

export const runtime = "nodejs";

const MAX_AN = 1;
const MAX_BETREFF = 200;
const MAX_TEXT = 10_000;
const SPAM_FENSTER_MS = 60 * 60 * 1000;

function istMail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
}

export async function POST(req: Request) {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  })) as unknown as {
    id: string;
    clientReadOnlyMetadata?: Record<string, unknown>;
    setClientReadOnlyMetadata?: (meta: Record<string, unknown>) => Promise<unknown>;
  } | null;
  if (!user?.id) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  // Grober Spam-Throttle pro IP zusätzlich zu den User-Quoten.
  const ip = getClientIp(req) ?? "no-ip";
  if (!(await rateLimit(`gurkenmail:ip:${ip}`, 10, SPAM_FENSTER_MS))) {
    return rateLimitAntwort(SPAM_FENSTER_MS);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ungültiger Request" }, { status: 400 });
  }
  const { an, betreff, text, turnstileToken } = (body ?? {}) as Record<string, unknown>;

  // Bot-Schutz wie bei Punkte-Aktionen (Sitzung genügt – Quoten deckeln eh).
  const captcha = await pruefeTurnstile(req, { token: turnstileToken, userId: user.id });
  if (!captcha.ok) {
    return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
  }

  const empfaenger =
    typeof an === "string" ? an.trim().toLowerCase().slice(0, 320) : "";
  const thema = typeof betreff === "string" ? betreff.trim().slice(0, MAX_BETREFF + 50) : "";
  const inhalt = typeof text === "string" ? text.trim().slice(0, MAX_TEXT + 1000) : "";
  if (!istMail(empfaenger) || empfaenger.split(",").length > MAX_AN) {
    return Response.json({ error: "Genau einen Empfänger angeben (keine Anhänge in v1)." }, { status: 400 });
  }
  if (!thema || thema.length > MAX_BETREFF) {
    return Response.json({ error: "Betreff: 1–200 Zeichen." }, { status: 400 });
  }
  if (!inhalt || inhalt.length > MAX_TEXT) {
    return Response.json({ error: "Nachricht: 1–10.000 Zeichen, nur Text." }, { status: 400 });
  }

  // Interne Post (@gurkensekte.de): direkt ins Empfänger-Postfach,
  // ohne Resend und ohne Abzug vom 3/Tag-Limit.
  if (istInterneAdresse(empfaenger)) {
    return sendeIntern(req, user.id, empfaenger, thema, inhalt);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "your_resend_api_key_here") {
    return Response.json(
      { error: "Versand noch nicht eingerichtet (RESEND_API_KEY fehlt)." },
      { status: 501 },
    );
  }

  try {
    const ergebnis = await mitBenutzerSperre(`gurkenmail:${user.id}`, async () => {
      const frisch = (await hexclaveServerApp.getUser({
        tokenStore: req,
        or: "return-null",
      })) as unknown as {
        id: string;
        clientReadOnlyMetadata?: Record<string, unknown>;
        setClientReadOnlyMetadata: (meta: Record<string, unknown>) => Promise<unknown>;
      } | null;
      if (!frisch || frisch.id !== user.id) throw new Error("unauthorized");
      const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
      const mailbox = leseMailbox(meta);
      if (!mailbox) throw new Error("keine-mailbox");
      const heute = heuteISO();
      const bisher = gesendetHeute(meta, heute);
      if (bisher >= GURKENMAIL_MAX_PRO_TAG) throw new Error("limit");

      // Resend direkt per REST (kein extra SDK nötig).
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${mailbox.displayName} <${mailbox.address}>`,
          reply_to: mailbox.address,
          to: [empfaenger],
          subject: thema,
          text: inhalt,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("Resend-Fehler:", res.status, detail.slice(0, 500));
        // Resend-Free ist accountweit bei 100/Tag gedeckelt.
        if (res.status === 429) throw new Error("resend-limit");
        throw new Error("resend");
      }

      await frisch.setClientReadOnlyMetadata({
        ...meta,
        gurkenmailSentDate: heute,
        gurkenmailSentCount: bisher + 1,
      });
      await speichereGesendet(mailbox.localpart, empfaenger, thema, inhalt);
      return { restHeute: GURKENMAIL_MAX_PRO_TAG - (bisher + 1) };
    });
    return Response.json({ ok: true, ...ergebnis });
  } catch (error) {
    if (error instanceof Error && error.message === "limit") {
      return Response.json(
        { error: "Heute schon 3 externe Mails versendet – morgen wieder. (Interne @gurkensekte.de-Mails zählen nicht.)", restHeute: 0 },
        { status: 429 },
      );
    }
    if (error instanceof Error && error.message === "resend-limit") {
      return Response.json(
        { error: "Tageskontingent des Versanddienstes aufgebraucht – bitte morgen erneut versuchen." },
        { status: 429 },
      );
    }
    if (error instanceof Error && error.message === "keine-mailbox") {
      return Response.json({ error: "Lege zuerst deine GurkenMail-Adresse an." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "unauthorized") {
      return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }
    console.error("GurkenMail Versand-Fehler:", error);
    return Response.json({ error: "Versand fehlgeschlagen." }, { status: 500 });
  }
}

/**
 * Interne Zustellung: Empfänger-Localpart prüfen, Mail per Worker-API
 * direkt in dessen D1-Postfach legen. Kein Resend, kein Limit-Abzug –
 * nur ein großzügiger Anti-Spam-Deckel (30/Tag).
 */
async function sendeIntern(
  req: Request,
  userId: string,
  empfaenger: string,
  thema: string,
  inhalt: string,
) {
  const zielLocal = internerLocalpart(empfaenger);
  if (!zielLocal) {
    return Response.json({ error: "Diese @gurkensekte.de-Adresse gibt es nicht." }, { status: 400 });
  }
  if (!inboundKonfiguriert()) {
    return Response.json(
      { error: "Interne Postfächer sind noch nicht freigeschaltet – bitte später erneut versuchen." },
      { status: 502 },
    );
  }

  try {
    const ergebnis = await mitBenutzerSperre(`gurkenmail:${userId}`, async () => {
      const frisch = (await hexclaveServerApp.getUser({
        tokenStore: req,
        or: "return-null",
      })) as unknown as {
        id: string;
        clientReadOnlyMetadata?: Record<string, unknown>;
        setClientReadOnlyMetadata: (meta: Record<string, unknown>) => Promise<unknown>;
      } | null;
      if (!frisch || frisch.id !== userId) throw new Error("unauthorized");
      const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
      const mailbox = leseMailbox(meta);
      if (!mailbox) throw new Error("keine-mailbox");
      if (mailbox.localpart === zielLocal) throw new Error("selbst");
      const heute = heuteISO();
      const bisher = internGesendetHeute(meta, heute);
      if (bisher >= GURKENMAIL_INTERN_MAX_PRO_TAG) throw new Error("intern-limit");

      const res = await fetch(new URL("/deliver", process.env.GURKENMAIL_INBOUND_URL!), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GURKENMAIL_INBOUND_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: zielLocal,
          from: `${mailbox.displayName} <${mailbox.address}>`,
          subject: thema,
          text: inhalt,
        }),
      });
      if (res.status === 404) throw new Error("unbekannt");
      if (!res.ok) throw new Error("worker");

      await frisch.setClientReadOnlyMetadata({
        ...meta,
        gurkenmailInternSentDate: heute,
        gurkenmailInternSentCount: bisher + 1,
      });
      await speichereGesendet(mailbox.localpart, empfaenger, thema, inhalt);
      // Externes Kontingent bleibt unangetastet – zur Anzeige zurückgeben.
      const extern = gesendetHeute(meta, heute);
      return { restHeute: GURKENMAIL_MAX_PRO_TAG - extern, intern: true as const };
    });
    return Response.json({ ok: true, ...ergebnis });
  } catch (error) {
    if (error instanceof Error && error.message === "unbekannt") {
      return Response.json(
        { error: `Unbekannt: ${zielLocal}@${GURKENMAIL_DOMAIN} hat noch kein GurkenMail-Postfach.` },
        { status: 404 },
      );
    }
    if (error instanceof Error && error.message === "selbst") {
      return Response.json({ error: "An dich selbst brauchst du nichts zu schicken. 🥒" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "intern-limit") {
      return Response.json(
        { error: "Heute schon 30 interne Mails – morgen wieder." },
        { status: 429 },
      );
    }
    if (error instanceof Error && error.message === "keine-mailbox") {
      return Response.json({ error: "Lege zuerst deine GurkenMail-Adresse an." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "unauthorized") {
      return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }
    console.error("GurkenMail Intern-Fehler:", error);
    return Response.json({ error: "Zustellung fehlgeschlagen." }, { status: 500 });
  }
}
