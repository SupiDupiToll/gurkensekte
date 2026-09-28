/**
 * Rate-Limiter (Sliding Window) für Gurken-API-Routen.
 *
 * Schützt Kosten- (Gürkchen-Chat) und Spam-Vektoren (E-Mail-Versand), die das
 * Turnstile-Captcha allein nicht abdeckt: Ein gelöstes Captcha gilt 30 Minuten
 * und erlaubt sonst unbegrenzte Anfragen in dieser Zeit.
 *
 * Store: Upstash Redis (`@upstash/ratelimit`) – funktioniert über alle
 * Vercel-Serverless-Instanzen hinweg. Fehlen die Upstash-Envs (lokaler Dev),
 * greift ein In-Memory-Fallback pro Instanz. Ist Redis in Production kurz
 * nicht erreichbar, wird fail-open erlaubt (mit Error-Log), damit die Seite
 * nicht komplett steht.
 *
 *_ENV-Mapping:_ Die Vercel-KV-Integration vergibt je nach Anbindung
 * unterschiedliche Variablennamen – alle bekannten werden gelesen
 * (Standard zuerst):
 * - URL: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_KV_REST_API_URL, KV_REST_API_URL
 * - Token: UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_KV_REST_API_TOKEN, KV_REST_API_TOKEN
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
  process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
  process.env.KV_REST_API_TOKEN;

const useUpstash = Boolean(redisUrl && redisToken);

let redis: Redis | null = null;
if (useUpstash) {
  redis = new Redis({ url: redisUrl!, token: redisToken! });
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "Rate-Limit: Keine Upstash-Env gefunden – Fallback auf In-Memory (zählt nur pro Instanz).",
  );
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const id = `${limit}:${windowMs}`;
  let limiter = limiterCache.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
      prefix: `gurken:${id}`,
    });
    limiterCache.set(id, limiter);
  }
  return limiter;
}

// --- In-Memory-Fallback (Dev ohne Upstash) ---

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 5000;

function evictIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  // Älteste Buckets zuerst entfernen (nach letztem Eintrag sortiert).
  const entries = Array.from(buckets.entries()).sort((a, b) => {
    const aLast = a[1][a[1].length - 1] ?? 0;
    const bLast = b[1][b[1].length - 1] ?? 0;
    return aLast - bLast;
  });
  for (const [key] of entries.slice(0, buckets.size - MAX_BUCKETS)) {
    buckets.delete(key);
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  evictIfNeeded();
  return true;
}

/**
 * true = Anfrage erlaubt (und gezählt), false = Limit erreicht.
 * Antwortet der Aufrufer bei false mit 429 + Retry-After.
 *
 * `failClosed: true` verweigert bei Redis-Ausfall (statt zu erlauben) –
 * für Kosten-Endpunkte (Gürkchen-Chat/Zitat), bei denen ein Ausfall sonst
 * unbegrenzte LLM-Kosten bedeuten würde. Für Verfügbarkeits-Endpunkte
 * (Punkte, Casino) bleibt fail-open der Default.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  if (useUpstash && redis) {
    try {
      const { success } = await getLimiter(limit, windowMs).limit(key);
      return success;
    } catch (error) {
      console.error(
        "Rate-Limit (Upstash) nicht erreichbar – Anfrage erlaubt:",
        error,
      );
      return !opts.failClosed;
    }
  }
  return memoryLimit(key, limit, windowMs);
}

export function rateLimitAntwort(windowMs: number) {
  return Response.json(
    { error: "Zu viele Anfragen – bitte kurz warten." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
    },
  );
}

// --- Benutzer-Sperre gegen TOCTOU (Double-Spend) ---

/**
 * Serialisiert Lese-Ändern-Schreiben pro Schlüssel (z. B. `punkte:<userId>`).
 *
 * Punkte-Buchungen lesen heute Metadaten, prüfen und schreiben ohne Lock:
 * Zwei parallele Requests lesen denselben Stand und buchen beide (doppelter
 * Bonus, doppeltes Einlösen). Diese Sperre schließt das:
 * - Immer: In-Memory-Kette pro Instanz (schützt parallele Requests auf
 *   derselben warmen Instanz).
 * - Mit Upstash: zusätzlich ein verteilter Lock (SET NX PX), damit auch
 *   parallele Requests auf verschiedenen Serverless-Instanzen serialisiert
 *   werden. Ohne Upstash bzw. bei Redis-Fehler gilt best-effort (nur
 *   In-Memory) – dann hilft zusätzlich das knappe Lock-TTL gegen Hänger.
 */
const SPERRE_TTL_MS = 10_000;
const SPERRE_WARTE_MS = 8_000;

const speicherKetten = new Map<string, Promise<void>>();

/** Reiht sich hinter dem Vorgänger ein und wartet, bis dieser freigibt. */
async function speicherKette(schluessel: string): Promise<() => void> {
  const vorgaenger = speicherKetten.get(schluessel) ?? Promise.resolve();
  let freigabe!: () => void;
  const aktuell = new Promise<void>((resolve) => {
    freigabe = resolve;
  });
  speicherKetten.set(schluessel, aktuell);
  await vorgaenger;
  return () => {
    freigabe();
    if (speicherKetten.get(schluessel) === aktuell) {
      speicherKetten.delete(schluessel);
    }
  };
}

/** true, wenn `mitBenutzerSperre` wegen belegter Sperre abgebrochen hat. */
export function istSperreBelegtFehler(error: unknown): boolean {
  return error instanceof Error && error.name === "SperreBelegtFehler";
}

export async function mitBenutzerSperre<T>(
  schluessel: string,
  arbeit: () => Promise<T>,
): Promise<T> {
  const speicherFreigabe = await speicherKette(`gurken:sperre:${schluessel}`);
  let redisToken: string | null = null;
  const redisSchluessel = `gurken:sperre:${schluessel}`;
  if (useUpstash && redis) {
    try {
      redisToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const start = Date.now();
      for (;;) {
        const gesetzt = await redis.set(redisSchluessel, redisToken, {
          nx: true,
          px: SPERRE_TTL_MS,
        });
        if (gesetzt === "OK") break;
        if (Date.now() - start > SPERRE_WARTE_MS) {
          // Belegt trotz Warten: kein stilles Weiterlaufen (sonst wäre die
          // Sperre wirkungslos) – Aufrufer antwortet 409 zum Wiederholen.
          redisToken = null;
          const belegt = new Error("Sperre belegt – bitte erneut versuchen.");
          belegt.name = "SperreBelegtFehler";
          throw belegt;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    } catch (error) {
      if (error instanceof Error && error.name === "SperreBelegtFehler") {
        speicherFreigabe();
        throw error;
      }
      // Echter Redis-Fehler: best-effort mit In-Memory-Kette weiter.
      console.error("Benutzer-Sperre (Upstash) nicht verfügbar:", error);
      redisToken = null;
    }
  }
  try {
    return await arbeit();
  } finally {
    speicherFreigabe();
    if (useUpstash && redis && redisToken) {
      try {
        const aktuell = await redis.get(redisSchluessel);
        if (aktuell === redisToken) await redis.del(redisSchluessel);
      } catch {
        // TTL räumt auf – kein Handlungsbedarf.
      }
    }
  }
}
