import { hexclaveServerApp } from "@/hexclave/server";
import { getClientIp, pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import { rateLimit, rateLimitAntwort } from "@/lib/ratelimit";
import {
  bucheBonus,
  heuteISO,
  istPunkteFehler,
  mitFrischemBenutzer,
  PunkteFehler,
  ZITAT_MAX_PRO_TAG,
  zitatZaehlerHeute,
} from "@/lib/punkte";
import { hatKiAnbieter, holeChatAntwort } from "@/lib/ki-anbieter";
import { tagesStimmungsSuffix } from "@/lib/guerkchenStimmung";

const QUOTE_SYSTEM_PROMPT =
  "Du bist Gürkchen, der selbsternannte Anführer der 'Gurken Sekte'. " +
  "Erfinde ein kurzes, lustiges, pseudo-religiöses Zitat über Gurken. " +
  "maximal 1-2 Sätze. Keine Einleitung, keine Erklärung, nur das Zitat. " +
  "Sprich von dir selbst in der dritten Person (Gürkchen). " +
  "Antworte auf Deutsch.";

const FALLBACK_QUOTE =
  "Die Gurke ist der Urknall in essbarer Form. – Gürkchen 🥒";

/** Antwort-Deckel pro Zitat-Anfrage (Kostenschutz). */
const MAX_ANTOWORT_TOKENS = 150;
/** Höchstens so viele Zitat-Anfragen pro IP im Zeitfenster. */
const QUOTE_LIMIT = 100;
const QUOTE_FENSTER_MS = 10 * 60 * 1000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Kostenschutz vor allen weiteren Checks: begrenzt Anfragen pro IP.
  // fail-closed: Bei Redis-Ausfall lieber ablehnen als unbegrenzte
  // LLM-Kosten zu riskieren.
  const ip = getClientIp(req) ?? "no-ip";
  if (
    !(await rateLimit(`quote:${ip}`, QUOTE_LIMIT, QUOTE_FENSTER_MS, {
      failClosed: true,
    }))
  ) {
    return rateLimitAntwort(QUOTE_FENSTER_MS);
  }

  // Bot-Schutz: Jedes Zitat braucht ein frisch gelöstes Captcha (Single-Use:
  // Das Token wird hier verbraucht und darf nicht zusätzlich an die
  // Punkte-Route weitergereicht werden). Das Token kommt per Query
  // (`?turnstileToken=…`) oder Header, eine frische Lösung ist Pflicht –
  // Sitzungen gelten hier nicht. Hinweis: Query-Token landen in Access-Logs,
  // sind aber nach der Prüfung sofort verbraucht und damit wertlos.
  const url = new URL(req.url);
  const token =
    url.searchParams.get("turnstileToken") ??
    req.headers.get("x-turnstile-token");

  const captcha = await pruefeTurnstile(req, { token, frischesToken: true });
  if (!captcha.ok) {
    return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
  }

  // Eingeloggte Mitglieder erhalten +5 Zitat-Punkte (max. 3/Tag) – aber
  // erst nach erfolgreicher LLM-Antwort (siehe unten). Das Single-Use-Token
  // ist hier bereits verbraucht, separates Claimen entfällt.
  const mitglied = await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  });

  // Quota-Vorabcheck (nur lesend, ohne Buchung): Bei 3/3 wird gar kein
  // LLM-Call verschwendet. Die echte Durchsetzung bleibt in bucheBonus
  // (Lock + Re-Read) weiter unten.
  if (mitglied) {
    try {
      await mitFrischemBenutzer(req, mitglied.id, async (_frisch, meta) => {
        if (zitatZaehlerHeute(meta, heuteISO()) >= ZITAT_MAX_PRO_TAG) {
          throw new PunkteFehler(400, "Heute schon 3 Zitate generiert");
        }
      });
    } catch (error) {
      if (istPunkteFehler(error)) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  // Sail Research (flex) zuerst, OpenRouter free als Fallback (siehe src/lib/ki-anbieter.ts).
  if (!hatKiAnbieter()) {
    return Response.json({ quote: FALLBACK_QUOTE });
  }

  const quote = await holeChatAntwort(
    [
      {
        role: "user",
        content: `${QUOTE_SYSTEM_PROMPT} ${tagesStimmungsSuffix()}`,
      },
    ],
    MAX_ANTOWORT_TOKENS,
  );

  // Kein LLM-Erfolg = keine Punkte, nur Fallback-Zitat.
  if (!quote) {
    return Response.json({ quote: FALLBACK_QUOTE });
  }

  if (mitglied) {
    try {
      await bucheBonus(req, mitglied.id, "zitat", quote);
    } catch (error) {
      if (istPunkteFehler(error)) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  return Response.json({ quote });
}
