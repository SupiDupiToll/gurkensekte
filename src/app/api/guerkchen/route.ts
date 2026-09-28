import { getClientIp, pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import { rateLimit, rateLimitAntwort } from "@/lib/ratelimit";

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
    // Kostenschutz vor allen weiteren Checks: begrenzt Anfragen pro IP,
    // auch innerhalb einer gültigen 30-Minuten-Captcha-Sitzung.
    const ip = getClientIp(req) ?? "no-ip";
    if (!(await rateLimit(`guerkchen:${ip}`, CHAT_LIMIT, CHAT_FENSTER_MS))) {
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

    // Bot-Schutz: Erst mit gültigem Turnstile-Captcha (oder gültiger
    // 30-Minuten-Sitzung) antwortet Gürkchen – sonst 403 mit Wiederholhinweis.
    const captcha = await pruefeTurnstile(req, { token: turnstileToken });
    if (!captcha.ok) {
      return Response.json(turnstileFehltFehler(captcha.grund), {
        status: 403,
      });
    }

    const apiKeys = getApiKeys();

    if (apiKeys.length === 0) {
      console.error("Gürkchen-Chat: kein OPENROUTER_API_KEY gesetzt");
      return Response.json({ reply: FALLBACK_REPLY });
    }

    let lastError: unknown = null;

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
              stream: true,
              max_tokens: MAX_ANTOWORT_TOKENS,
              messages: [
                { role: "system", content: GUERKCHEN_SYSTEM_PROMPT },
                ...verlauf,
              ],
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Gürkchen-Chat: OpenRouter Fehler (${response.status}) mit Key ${apiKey.slice(0, 8)}...:`,
            errorText,
          );
          lastError = new Error(`HTTP ${response.status}: ${errorText}`);
          continue;
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const openRouterReader = response.body!.getReader();

        const stream = new ReadableStream({
          async start(controller) {
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await openRouterReader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data: ")) continue;
                  if (trimmed === "data: [DONE]") continue;

                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const content = json.choices?.[0]?.delta?.content || "";
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {
                    // skip malformed lines
                  }
                }
              }
            } catch (err) {
              console.error("Gürkchen-Chat: Stream-Fehler:", err);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } catch (error) {
        console.error(
          `Gürkchen-Chat: Network-Fehler mit Key ${apiKey.slice(0, 8)}...:`,
          error,
        );
        lastError = error;
      }
    }

    console.error("Gürkchen-Chat: alle API-Keys fehlgeschlagen", lastError);
    return Response.json({ reply: FALLBACK_REPLY });
  } catch (error) {
    console.error("Gürkchen-Chat: Fehler im Route Handler:", error);
    return Response.json({ reply: FALLBACK_REPLY });
  }
}
