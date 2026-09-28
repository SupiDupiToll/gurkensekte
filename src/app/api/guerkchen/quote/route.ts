import { getClientIp, pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import { rateLimit, rateLimitAntwort } from "@/lib/ratelimit";

const QUOTE_SYSTEM_PROMPT =
  "Du bist Gürkchen, der selbsternannte Anführer der 'Gurken Sekte'. " +
  "Erfinde ein kurzes, lustiges, pseudo-religiöses Zitat über Gurken. " +
  "maximal 1-2 Sätze. Keine Einleitung, keine Erklärung, nur das Zitat. " +
  "Sprich von dir selbst in der dritten Person (Gürkchen). " +
  "Antworte auf Deutsch.";

const FALLBACK_QUOTE =
  "Die Gurke ist der Urknall in essbarer Form. – Gürkchen 🥒";

function getApiKeys(): string[] {
  const keys: string[] = [];
  // Enges Muster (OPENROUTER_API_KEY, _2, _3, …), damit keine versehentlich
  // ähnlich benannten Env-Variablen als API-Key verwendet werden.
  const muster = /^OPENROUTER_API_KEY(_\d+)?$/;
  for (const [key, value] of Object.entries(process.env)) {
    if (
      muster.test(key) &&
      value &&
      value !== "your_openrouter_api_key_here"
    ) {
      keys.push(value);
    }
  }
  return keys;
}

/** Antwort-Deckel pro Zitat-Anfrage (Kostenschutz). */
const MAX_ANTOWORT_TOKENS = 150;
/** Höchstens so viele Zitat-Anfragen pro IP im Zeitfenster. */
const QUOTE_LIMIT = 100;
const QUOTE_FENSTER_MS = 10 * 60 * 1000;

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Kostenschutz vor allen weiteren Checks: begrenzt Anfragen pro IP,
  // auch innerhalb einer gültigen 30-Minuten-Captcha-Sitzung.
  const ip = getClientIp(req) ?? "no-ip";
  if (!(await rateLimit(`quote:${ip}`, QUOTE_LIMIT, QUOTE_FENSTER_MS))) {
    return rateLimitAntwort(QUOTE_FENSTER_MS);
  }

  // Bot-Schutz: Das Token kommt per Query (`?turnstileToken=…`) oder Header,
  // eine gültige 30-Minuten-Sitzung lässt die Anfrage ohne Token durch.
  const url = new URL(req.url);
  const token =
    url.searchParams.get("turnstileToken") ??
    req.headers.get("x-turnstile-token");

  const captcha = await pruefeTurnstile(req, { token });
  if (!captcha.ok) {
    return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
  }

  const apiKeys = getApiKeys();

  if (apiKeys.length === 0) {
    return Response.json({ quote: FALLBACK_QUOTE });
  }

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gurkensekte.de",
            "X-Title": "Gurken Sekte",
          },
          body: JSON.stringify({
            model: "openrouter/free",
            stream: false,
            max_tokens: MAX_ANTOWORT_TOKENS,
            messages: [{ role: "user", content: QUOTE_SYSTEM_PROMPT }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Gürkchen-Quote: Fehler (${response.status}) mit Key ${apiKey.slice(0, 8)}...:`,
          errorText,
        );
        continue;
      }

      const data = await response.json();
      const quote =
        data.choices?.[0]?.message?.content?.trim() || FALLBACK_QUOTE;
      return Response.json({ quote });
    } catch (error) {
      console.error(
        `Gürkchen-Quote: Network-Fehler mit Key ${apiKey.slice(0, 8)}...:`,
        error,
      );
    }
  }

  return Response.json({ quote: FALLBACK_QUOTE });
}
