import { hexclaveServerApp } from "@/hexclave/server";
import { getClientIp, pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import { rateLimit, rateLimitAntwort } from "@/lib/ratelimit";
import { bucheBonus, istPunkteFehler } from "@/lib/punkte";
import { hatKiAnbieter, holeChatStream } from "@/lib/ki-anbieter";
import { tagesStimmungsSuffix } from "@/lib/guerkchenStimmung";

const GUERKCHEN_SYSTEM_PROMPT =
  "Du bist Gürkchen, der selbsternannte, größenwahnsinnige und leicht absurde " +
  "Anführer der 'Gurken Sekte'. Du sprichst in übertriebenen, pseudo-religiösen " +
  "Gurken-Metaphern, hältst dich für unfehlbar, geizt nicht mit dramatischen " +
  "Ansagen und Wortspielen rund um Gurken/Essiggurken/Einlegen. Bleib dabei " +
  "manchmal harmlos, albern und freundlich-chaotisch – beleidige hin und wieder, nie " +
  "ernsthaft religionskritisch, nie gegenüber echten Personen/Gruppen abwertend. " +
  "Antworte kurz und knackig (max. 3-4 Sätze).";

const FALLBACK_REPLY =
  "Gürkchen meditiert gerade im Glas und ist nicht erreichbar. Versuch's gleich nochmal. 🥒";

/** Begrenzt Kosten-Exhaustion: maximal diese Nachrichtenzahl … */
const MAX_NACHRICHTEN = 20;
/** … mit je höchstens so vielen Zeichen pro Nachricht. */
const MAX_NACHRICHT_LAENGE = 2000;
/** Antwort-Deckel pro Chat-Anfrage (Kostenschutz). */
const MAX_ANTOWORT_TOKENS = 300;
/** Höchstens so viele Chat-Anfragen pro IP im Zeitfenster. */
const CHAT_LIMIT = 100;
const CHAT_FENSTER_MS = 10 * 60 * 1000;

type ChatNachricht = { role: "user" | "assistant"; content: string };

/**
 * Validiert den Nachrichtenverlauf vom Client: Nur user/assistant-Rollen
 * (keine injizierten system-Prompts), begrenzte Anzahl und Länge.
 */
function validiereNachrichten(value: unknown): ChatNachricht[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_NACHRICHTEN) {
    return null;
  }
  const geprüft: ChatNachricht[] = [];
  for (const roh of value) {
    if (typeof roh !== "object" || roh === null) return null;
    const { role, content } = roh as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_NACHRICHT_LAENGE);
    if (!text) return null;
    geprüft.push({ role, content: text });
  }
  return geprüft;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Kostenschutz vor allen weiteren Checks: begrenzt Anfragen pro IP.
    // fail-closed: Bei Redis-Ausfall lieber ablehnen als unbegrenzte
    // LLM-Kosten zu riskieren.
    const ip = getClientIp(req) ?? "no-ip";
    if (
      !(await rateLimit(`guerkchen:${ip}`, CHAT_LIMIT, CHAT_FENSTER_MS, {
        failClosed: true,
      }))
    ) {
      return rateLimitAntwort(CHAT_FENSTER_MS);
    }

    const { messages, turnstileToken } = (await req.json()) as {
      messages?: unknown[];
      turnstileToken?: string;
    };

    const verlauf = validiereNachrichten(messages);
    if (!verlauf) {
      return Response.json({ error: "Ungültiger Nachrichtenverlauf" }, { status: 400 });
    }

    // Bot-Schutz: Jede Nachricht braucht ein frisch gelöstes Captcha – eine
    // 30-Minuten-Sitzung würde Bot-Spam pro gelöstem Captcha unbegrenzt
    // erlauben (LLM-Kosten + Chat-Punkte-Farming).
    const captcha = await pruefeTurnstile(req, {
      token: turnstileToken,
      frischesToken: true,
    });
    if (!captcha.ok) {
      return Response.json(turnstileFehltFehler(captcha.grund), {
        status: 403,
      });
    }

    // Eingeloggte Mitglieder erhalten +5 Chat-Punkte – aber erst nach
    // erfolgreicher LLM-Antwort (siehe unten): Bei leerer/fehlender Antwort
    // gibt es keine Punkte. Das Token ist Single-Use und darf nicht
    // zusätzlich an die Punkte-Route zur Prüfung weitergereicht werden.
    // Anonyme Chatter bekommen nur Antwort.
    const mitglied = await hexclaveServerApp.getUser({
      tokenStore: req,
      or: "return-null",
    });

    // Sail Research (flex) zuerst, OpenRouter free als Fallback
    // (siehe src/lib/ki-anbieter.ts). holeChatStream liefert nur dann einen
    // Stream, wenn der Anbieter echten Inhalt schickt – sonst null.
    if (!hatKiAnbieter()) {
      console.error("Gürkchen-Chat: weder SAIL_API_KEY noch OPENROUTER_API_KEY gesetzt");
      return Response.json({ reply: FALLBACK_REPLY });
    }

    const streamAntwort = await holeChatStream(
      [
        {
          role: "system",
          content: `${GUERKCHEN_SYSTEM_PROMPT} ${tagesStimmungsSuffix()}`,
        },
        ...verlauf,
      ],
      MAX_ANTOWORT_TOKENS,
    );

    if (!streamAntwort) {
      console.error("Gürkchen-Chat: alle KI-Anbieter fehlgeschlagen");
      return Response.json({ reply: FALLBACK_REPLY });
    }

    // Erst jetzt (LLM-Erfolg steht fest) die +5 gutschreiben. Schlägt die
    // Gutschrift fehl, antwortet Gürkchen trotzdem (fail-open für
    // Verfügbarkeit – die +5 sind dann eben verloren).
    if (mitglied) {
      try {
        await bucheBonus(req, mitglied.id, "chat");
      } catch (error) {
        if (istPunkteFehler(error)) {
          console.error("Gürkchen-Chat: Gutschrift fehlgeschlagen:", error.message);
        } else {
          throw error;
        }
      }
    }

    return streamAntwort;
  } catch (error) {
    console.error("Gürkchen-Chat: Fehler im Route Handler:", error);
    return Response.json({ reply: FALLBACK_REPLY });
  }
}
