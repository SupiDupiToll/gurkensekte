/**
 * Verlosungs-Store: ein Topf-Datensatz pro Monat in Upstash Redis.
 *
 * Bewusst nicht in Hexclave (Kontodaten) – die Ziehung ist globaler Zustand
 * und muss instanzübergreifend genau einmal passieren (SET NX). Ohne
 * Upstash-Envs (lokaler Dev) gilt ein In-Memory-Fallback pro Instanz
 * (wie beim Rate-Limit): zum Ausprobieren ok, prod braucht Upstash.
 */

import { Redis } from "@upstash/redis";
import {
  VERLOSUNG_KEY_PREFIX,
  VERLOSUNG_LOSE_PREFIX,
  type VerlosungRecord,
} from "@/lib/verlosung";

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
    "Verlosung: Keine Upstash-Env gefunden – In-Memory-Fallback (Ziehung nur pro Instanz stabil).",
  );
}

const speicher = new Map<string, VerlosungRecord>();
/** Lose-Zähler pro Monat+Konto (exakt, 1× pro Daily-Claim). */
const loseSpeicher = new Map<string, number>();

function schluessel(monat: string): string {
  return `${VERLOSUNG_KEY_PREFIX}${monat}`;
}

function loseSchluessel(monat: string, userId: string): string {
  return `${VERLOSUNG_LOSE_PREFIX}${monat}:${userId}`;
}

function alsZahl(wert: unknown): number {
  const n = typeof wert === "number" ? wert : Number(wert);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function istGueltigerRecord(wert: unknown): wert is VerlosungRecord {
  if (typeof wert !== "object" || wert === null) return false;
  const r = wert as Record<string, unknown>;
  return (
    typeof r.monat === "string" &&
    (typeof r.gewinnerId === "string" || r.gewinnerId === null) &&
    (r.status === "offen" || r.status === "eingeloest")
  );
}

/** Topf-Datensatz lesen (null = noch nicht gezogen). */
export async function leseVerlosung(
  monat: string,
): Promise<VerlosungRecord | null> {
  if (useUpstash && redis) {
    try {
      const roh = await redis.get(schluessel(monat));
      if (roh === null || roh === undefined) return null;
      const wert =
        typeof roh === "string" ? (JSON.parse(roh) as unknown) : roh;
      return istGueltigerRecord(wert) ? wert : null;
    } catch (error) {
      console.error("Verlosung: Redis-Lesen fehlgeschlagen:", error);
      return null;
    }
  }
  return speicher.get(monat) ?? null;
}

/**
 * Nur schreiben, wenn noch nichts da ist (SET NX) – true bei Erfolg.
 * Damit gewinnt genau eine Instanz das Ziehungs-Rennen.
 */
export async function speichereVerlosungNeu(
  monat: string,
  record: VerlosungRecord,
): Promise<boolean> {
  if (useUpstash && redis) {
    try {
      const gesetzt = await redis.set(schluessel(monat), JSON.stringify(record), {
        nx: true,
      });
      return gesetzt === "OK";
    } catch (error) {
      console.error("Verlosung: Redis-Schreiben fehlgeschlagen:", error);
      return false;
    }
  }
  if (speicher.has(monat)) return false;
  speicher.set(monat, record);
  return true;
}

/** Überschreiben (nur unter Sperre aufrufen – sonst Doppel-Einlösung). */
export async function schreibeVerlosung(
  monat: string,
  record: VerlosungRecord,
): Promise<void> {
  if (useUpstash && redis) {
    try {
      await redis.set(schluessel(monat), JSON.stringify(record));
      return;
    } catch (error) {
      console.error("Verlosung: Redis-Schreiben fehlgeschlagen:", error);
      throw error;
    }
  }
  speicher.set(monat, record);
}

// --- Lose-Zähler (exakt: +1 pro Daily-Claim, statt gedeckeltem Verlauf) ---

/**
 * Zählt ein Los für (Monat, Konto) hoch – atomar (INCR). Gibt den neuen Stand
 * zurück (0 bei Fehler, dann trägt der Verlauf als Rückfall).
 */
export async function erhoeheLose(
  monat: string,
  userId: string,
): Promise<number> {
  const key = loseSchluessel(monat, userId);
  if (useUpstash && redis) {
    try {
      return alsZahl(await redis.incr(key));
    } catch (error) {
      console.error("Verlosung: Lose-Zähler fehlgeschlagen:", error);
      return 0;
    }
  }
  const neu = (loseSpeicher.get(key) ?? 0) + 1;
  loseSpeicher.set(key, neu);
  return neu;
}

/** Exakter Lose-Stand (0 = keine Zählung, Verlauf-Rückfall greift). */
export async function leseLose(monat: string, userId: string): Promise<number> {
  const key = loseSchluessel(monat, userId);
  if (useUpstash && redis) {
    try {
      return alsZahl(await redis.get(key));
    } catch (error) {
      console.error("Verlosung: Lose-Lesen fehlgeschlagen:", error);
      return 0;
    }
  }
  return loseSpeicher.get(key) ?? 0;
}

/**
 * Alle Lose des Monats (userId → Anzahl). Upstash per SCAN, Dev per Map.
 * Nur für die Ziehung – einmal pro Monat.
 */
export async function leseAlleLose(monat: string): Promise<Map<string, number>> {
  const ergebnis = new Map<string, number>();
  const praefix = `${VERLOSUNG_LOSE_PREFIX}${monat}:`;
  if (useUpstash && redis) {
    try {
      let cursor = "0";
      do {
        const [naechster, keys] = await redis.scan(cursor, {
          match: `${praefix}*`,
          count: 1000,
        });
        cursor = naechster;
        for (const key of keys) {
          const userId = key.slice(praefix.length);
          if (!userId) continue;
          ergebnis.set(userId, alsZahl(await redis.get(key)));
        }
      } while (cursor !== "0");
    } catch (error) {
      console.error("Verlosung: Lose-Scan fehlgeschlagen:", error);
    }
    return ergebnis;
  }
  for (const [key, anzahl] of loseSpeicher) {
    if (key.startsWith(praefix)) {
      ergebnis.set(key.slice(praefix.length), anzahl);
    }
  }
  return ergebnis;
}
