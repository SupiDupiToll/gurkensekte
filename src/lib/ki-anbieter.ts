/**
 * KI-Anbieter für Gürkchen: Sail Research zuerst, OpenRouter free als Fallback.
 *
 * Sail Research ist OpenAI-kompatibel:
 *   POST {SAIL_BASE_URL}/chat/completions
 *   Authorization: Bearer $SAIL_API_KEY
 * Modell (Default): deepseek-ai/DeepSeek-V4-Flash-0731
 * Preis-Fenster (Default): "flex" (günstigstes Best-Effort-Fenster, kann
 * langsam sein – per SAIL_COMPLETION_WINDOW änderbar, z. B. "asap" für
 * interaktiven Chat). Siehe https://docs.sailresearch.com/completion-windows
 *
 * OpenRouter bleibt als Fallback mit Modell "openrouter/free".
 *
 * Wichtig: `holeChatStream` gibt erst einen Stream zurück, wenn der Anbieter
 * tatsächlich einen ersten Inhalts-Chunk geliefert hat. Leere oder hängende
 * Upstream-Streams werden verworfen und der nächste Anbieter wird probiert –
 * sonst sieht der Client eine leere Blase ohne Fehlermeldung.
 */

const STANDARD_SAIL_MODELL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const STANDARD_SAIL_BASIS_URL = "https://api.sailresearch.com/v1";
const STANDARD_SAIL_FENSTER = "flex";
const STANDARD_OPENROUTER_MODELL = "openrouter/free";
/** Max. Wartezeit auf den ersten Inhalts-Chunk eines Anbieters. */
const STANDARD_ERSTER_TOKEN_TIMEOUT_MS = 20_000;
/** Max. Gesamtdauer einer nicht-streamenden Anfrage. */
const STANDARD_ANTOWORT_TIMEOUT_MS = 60_000;

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

/** Preis-/Latenz-Fenster für Sail: asap, priority, standard oder flex. */
export function holeSailFenster(): string {
  const roh =
    process.env.SAIL_COMPLETION_WINDOW?.trim() ||
    process.env.SAIL_RESEARCH_COMPLETION_WINDOW?.trim() ||
    STANDARD_SAIL_FENSTER;
  return roh || STANDARD_SAIL_FENSTER;
}

function holeTimeoutMs(envWert: string | undefined, standard: number): number {
  const ms = Number.parseInt(envWert?.trim() ?? "", 10);
  return Number.isFinite(ms) && ms > 0 ? ms : standard;
}

export function holeErsterTokenTimeoutMs(): number {
  return holeTimeoutMs(
    process.env.KI_ERSTER_TOKEN_TIMEOUT_MS,
    STANDARD_ERSTER_TOKEN_TIMEOUT_MS,
  );
}

export function holeAntwortTimeoutMs(): number {
  return holeTimeoutMs(
    process.env.KI_ANTOWORT_TIMEOUT_MS,
    STANDARD_ANTOWORT_TIMEOUT_MS,
  );
}

export function holeOpenRouterModell(): string {
  return process.env.OPENROUTER_MODEL?.trim() || STANDARD_OPENROUTER_MODELL;
}

type AnbieterVersuch = {
  name: string;
  url: string;
  headers: Record<string, string>;
  modell: string;
  /** Zusätzliche Body-Felder nur für diesen Anbieter (z. B. Sail-metadata). */
  extraBody?: Record<string, unknown>;
};

export function baueAnbieterListe(): AnbieterVersuch[] {
  const liste: AnbieterVersuch[] = [];
  const sailBasis = holeSailBasisUrl();
  const sailModell = holeSailModell();
  const sailFenster = holeSailFenster();

  for (const key of holeSailKeys()) {
    liste.push({
      name: "sail",
      url: `${sailBasis}/chat/completions`,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      modell: sailModell,
      extraBody: { metadata: { completion_window: sailFenster } },
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

/** Extrahiert Delta-Texte aus fertigen SSE-Zeilen (OpenAI-Chunk-Format). */
function extrahiereDeltaTexte(zeilen: string[]): string {
  let text = "";
  for (const zeile of zeilen) {
    const getrimmt = zeile.trim();
    if (!getrimmt || !getrimmt.startsWith("data: ")) continue;
    if (getrimmt === "data: [DONE]") continue;
    try {
      const json = JSON.parse(getrimmt.slice(6));
      const inhalt = json.choices?.[0]?.delta?.content;
      if (typeof inhalt === "string" && inhalt) text += inhalt;
    } catch {
      // fehlerhafte Zeilen überspringen
    }
  }
  return text;
}

/** Löst mit null auf, wenn `versprechen` nicht innerhalb von `ms` fertig wird. */
function mitAblauf<T>(versprechen: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ablauf = new Promise<null>((loese) => {
    timer = setTimeout(() => loese(null), ms);
  });
  return Promise.race([versprechen, ablauf]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Nicht-streamende Anfrage: probiert Sail zuerst, dann OpenRouter.
 * Gibt den Antworttext zurück oder null, wenn alle Anbieter scheitern.
 */
export async function holeChatAntwort(
  nachrichten: ChatNachricht[],
  maxTokens: number,
): Promise<string | null> {
  const anbieter = baueAnbieterListe();
  const timeoutMs = holeAntwortTimeoutMs();
  let index = 0;
  for (const versuch of anbieter) {
    index += 1;
    try {
      const response = await fetch(versuch.url, {
        method: "POST",
        headers: versuch.headers,
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: versuch.modell,
          stream: false,
          max_tokens: maxTokens,
          messages: nachrichten,
          ...versuch.extraBody,
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
 * Gibt erst dann eine Text-Stream-Response zurück, wenn der Anbieter
 * tatsächlich einen ersten Inhalts-Chunk geliefert hat – sonst wird der
 * nächste Anbieter probiert. Gibt null zurück, wenn alle scheitern
 * (Caller antwortet dann mit Fallback und vergibt KEINE Punkte).
 */
export async function holeChatStream(
  nachrichten: ChatNachricht[],
  maxTokens: number,
): Promise<Response | null> {
  const anbieter = baueAnbieterListe();
  const timeoutMs = holeErsterTokenTimeoutMs();
  let index = 0;
  for (const versuch of anbieter) {
    index += 1;
    try {
      const response = await fetch(versuch.url, {
        method: "POST",
        headers: versuch.headers,
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: versuch.modell,
          stream: true,
          max_tokens: maxTokens,
          messages: nachrichten,
          ...versuch.extraBody,
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

      // Ersten Inhalts-Chunk abwarten (mit Timeout): Nur wer wirklich
      // liefert, wird an den Client durchgereicht.
      const leser = response.body.getReader();
      const decoder = new TextDecoder();
      let puffer = "";
      let vorschau = "";
      let stromEnde = false;
      const beginn = Date.now();
      while (!vorschau && !stromEnde) {
        const rest = timeoutMs - (Date.now() - beginn);
        if (rest <= 0) break;
        const teil = await mitAblauf(leser.read(), rest);
        if (!teil) break; // Timeout ohne Inhalt
        if (teil.done) {
          stromEnde = true;
          break;
        }
        puffer += decoder.decode(teil.value, { stream: true });
        const zeilen = puffer.split("\n");
        puffer = zeilen.pop() || "";
        vorschau = extrahiereDeltaTexte(zeilen);
      }

      if (!vorschau) {
        console.error(
          `Gürkchen: ${versuch.name} lieferte keinen Inhalt (Timeout/leer) bei Versuch #${index} – nächster Anbieter`,
        );
        try {
          await leser.cancel();
        } catch {
          // ignore
        }
        continue;
      }

      const encoder = new TextEncoder();
      const restPuffer = puffer;
      const stream = new ReadableStream({
        async start(controller) {
          // Bereits empfangenen Anfang zuerst ausliefern …
          controller.enqueue(encoder.encode(vorschau));
          let buf = restPuffer;
          try {
            while (true) {
              const { done, value } = await leser.read();
              if (done) break;

              buf += decoder.decode(value, { stream: true });
              const zeilen = buf.split("\n");
              buf = zeilen.pop() || "";
              const inhalt = extrahiereDeltaTexte(zeilen);
              if (inhalt) controller.enqueue(encoder.encode(inhalt));
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
