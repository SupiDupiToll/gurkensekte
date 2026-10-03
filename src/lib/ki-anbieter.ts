/**
 * KI-Anbieter für Gürkchen: Sail Research zuerst, OpenRouter free als Fallback.
 *
 * Sail Research ist OpenAI-kompatibel:
 *   POST {SAIL_BASE_URL}/chat/completions
 *   Authorization: Bearer $SAIL_API_KEY
 * Modell (Default): deepseek-ai/DeepSeek-V4-Flash-0731
 *
 * OpenRouter bleibt als Fallback mit Modell "openrouter/free".
 */

const STANDARD_SAIL_MODELL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const STANDARD_SAIL_BASIS_URL = "https://api.sailresearch.com/v1";
const STANDARD_OPENROUTER_MODELL = "openrouter/free";

function leseEnvNamen(muster: RegExp): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (
      muster.test(key) &&
      value &&
      value !== "your_sail_api_key_here" &&
      value !== "your_openrouter_api_key_here"
    ) {
      keys.push(value);
    }
  }
  return keys;
}

export function holeSailKeys(): string[] {
  // SAIL_API_KEY, SAIL_API_KEY_2, … plus Alias SAIL_RESEARCH_API_KEY*.
  return leseEnvNamen(/^SAIL_(RESEARCH_)?API_KEY(_\d+)?$/);
}

export function holeOpenRouterKeys(): string[] {
  const muster = /^OPENROUTER_API_KEY(_\d+)?$/;
  return leseEnvNamen(muster);
}

export function holeSailModell(): string {
  return (
    process.env.SAIL_MODEL?.trim() ||
    process.env.SAIL_RESEARCH_MODEL?.trim() ||
    STANDARD_SAIL_MODELL
  );
}

export function holeSailBasisUrl(): string {
  const roh =
    process.env.SAIL_BASE_URL?.trim() ||
    process.env.SAIL_API_URL?.trim() ||
    process.env.SAIL_RESEARCH_BASE_URL?.trim() ||
    STANDARD_SAIL_BASIS_URL;
  return roh.replace(/\/$/, "");
}

export function holeOpenRouterModell(): string {
  return process.env.OPENROUTER_MODEL?.trim() || STANDARD_OPENROUTER_MODELL;
}

type AnbieterVersuch = {
  name: string;
  url: string;
  headers: Record<string, string>;
  modell: string;
};

export function baueAnbieterListe(): AnbieterVersuch[] {
  const liste: AnbieterVersuch[] = [];
  const sailBasis = holeSailBasisUrl();
  const sailModell = holeSailModell();

  for (const key of holeSailKeys()) {
    liste.push({
      name: "sail",
      url: `${sailBasis}/chat/completions`,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      modell: sailModell,
    });
  }

  for (const key of holeOpenRouterKeys()) {
    liste.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gurkensekte.de",
        "X-Title": "Gurken Sekte",
      },
      modell: holeOpenRouterModell(),
    });
  }

  return liste;
}

type ChatNachricht = { role: "system" | "user" | "assistant"; content: string };

/**
 * Nicht-streamende Anfrage: probiert Sail zuerst, dann OpenRouter.
 * Gibt den Antworttext zurück oder null, wenn alle Anbieter scheitern.
 */
export async function holeChatAntwort(
  nachrichten: ChatNachricht[],
  maxTokens: number,
): Promise<string | null> {
  const anbieter = baueAnbieterListe();
  let index = 0;
  for (const versuch of anbieter) {
    index += 1;
    try {
      const response = await fetch(versuch.url, {
        method: "POST",
        headers: versuch.headers,
        body: JSON.stringify({
          model: versuch.modell,
          stream: false,
          max_tokens: maxTokens,
          messages: nachrichten,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Gürkchen: ${versuch.name} Fehler (${response.status}) bei Versuch #${index}:`,
          errorText,
        );
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      console.error(
        `Gürkchen: ${versuch.name} lieferte leere Antwort bei Versuch #${index}`,
      );
    } catch (error) {
      console.error(
        `Gürkchen: ${versuch.name} Network-Fehler bei Versuch #${index}:`,
        error,
      );
    }
  }
  return null;
}

/**
 * Streamende Anfrage: probiert Sail zuerst, dann OpenRouter.
 * Gibt bei Erfolg direkt eine Text-Stream-Response zurück,
 * sonst null (Caller antwortet dann mit Fallback).
 */
export async function holeChatStream(
  nachrichten: ChatNachricht[],
  maxTokens: number,
): Promise<Response | null> {
  const anbieter = baueAnbieterListe();
  let index = 0;
  for (const versuch of anbieter) {
    index += 1;
    try {
      const response = await fetch(versuch.url, {
        method: "POST",
        headers: versuch.headers,
        body: JSON.stringify({
          model: versuch.modell,
          stream: true,
          max_tokens: maxTokens,
          messages: nachrichten,
        }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error(
          `Gürkchen: ${versuch.name} Fehler (${response.status}) bei Versuch #${index}:`,
          errorText,
        );
        continue;
      }

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const leser = response.body.getReader();

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await leser.read();
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
            console.error("Gürkchen: Stream-Fehler:", err);
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
        `Gürkchen: ${versuch.name} Network-Fehler bei Versuch #${index}:`,
        error,
      );
    }
  }
  return null;
}

/** true, wenn mindestens ein Anbieter-Key (Sail oder OpenRouter) gesetzt ist. */
export function hatKiAnbieter(): boolean {
  return baueAnbieterListe().length > 0;
}
