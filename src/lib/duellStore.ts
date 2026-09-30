/**
 * Geteilter Speicher für Duell-Sessions (P2P-Spielstand zwischen zwei Nutzern).
 *
 * Die Punkte selbst liegen pro Konto in Hexclave-Metadaten – hier liegt nur
 * der Spielstand: Brett, Zug, Status, Pot. Mit Upstash Redis teilen sich alle
 * Serverless-Instanzen denselben Stand; ohne Upstash-Envs (lokaler Dev)
 * greift ein In-Memory-Fallback pro Instanz.
 *
 * Zwei Namensräume: `gurken:duell` (echte Mitglieder) und
 * `gurken:demo:duell` (Demo) – damit Demo- und Echtgeld-Ökonomie
 * (beides Spielgeld, aber getrennte Konten) nie in einem Pot landen.
 */

import { Redis } from "@upstash/redis";
import { mitBenutzerSperre } from "@/lib/ratelimit";
import { DUELL_SPEICHER_TTL_S, type DuellSession } from "@/lib/duell";

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
  process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
  process.env.KV_REST_API_TOKEN;

let redis: Redis | null = null;
if (redisUrl && redisToken) {
  redis = new Redis({ url: redisUrl, token: redisToken });
}

export type DuellStore = {
  lesen: (id: string) => Promise<DuellSession | null>;
  lesenNachCode: (code: string) => Promise<DuellSession | null>;
  speichern: (session: DuellSession) => Promise<void>;
  /** Offene Duelle mit passendem Einsatz (ohne das eigene), gemischt. */
  wartendeFinden: (
    stake: number,
    ohneUserId: string,
    limit?: number,
  ) => Promise<DuellSession[]>;
};

/** In-Memory-Fallback (Dev ohne Upstash) – ein Satz Maps für alle Präfixe. */
const speicherSessions = new Map<string, string>();
const speicherCodes = new Map<string, string>();
const speicherWartend = new Map<string, Set<string>>();

function alsSession(wert: unknown): DuellSession | null {
  try {
    if (typeof wert === "string") {
      const parsed = JSON.parse(wert) as DuellSession;
      return Array.isArray(parsed.board) ? parsed : null;
    }
    if (typeof wert === "object" && wert !== null) {
      const kandidat = wert as DuellSession;
      return Array.isArray(kandidat.board) ? kandidat : null;
    }
  } catch {
    // korrupter Eintrag – wie nicht gefunden behandeln
  }
  return null;
}

export function duellStore(prefix: string): DuellStore {
  const sessionKey = (id: string) => `${prefix}:session:${id}`;
  const codeKey = (code: string) => `${prefix}:code:${code}`;
  const warteKey = `${prefix}:waiting`;

  function warteSet(): Set<string> {
    let set = speicherWartend.get(warteKey);
    if (!set) {
      set = new Set<string>();
      speicherWartend.set(warteKey, set);
    }
    return set;
  }

  async function speichern(session: DuellSession): Promise<void> {
    const json = JSON.stringify(session);
    if (redis) {
      try {
        await Promise.all([
          redis.set(sessionKey(session.id), json, {
            ex: DUELL_SPEICHER_TTL_S,
          }),
          redis.set(codeKey(session.code), session.id, {
            ex: DUELL_SPEICHER_TTL_S,
          }),
          session.status === "waiting"
            ? redis.sadd(warteKey, session.id)
            : redis.srem(warteKey, session.id),
        ]);
        return;
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    speicherSessions.set(sessionKey(session.id), json);
    speicherCodes.set(codeKey(session.code), session.id);
    if (session.status === "waiting") warteSet().add(session.id);
    else warteSet().delete(session.id);
  }

  async function lesen(id: string): Promise<DuellSession | null> {
    if (redis) {
      try {
        return alsSession(await redis.get(sessionKey(id)));
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    return alsSession(speicherSessions.get(sessionKey(id)) ?? null);
  }

  async function lesenNachCode(code: string): Promise<DuellSession | null> {
    let id: string | null = null;
    if (redis) {
      try {
        const gefunden = await redis.get(codeKey(code));
        id = typeof gefunden === "string" ? gefunden : null;
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    } else {
      id = speicherCodes.get(codeKey(code)) ?? null;
    }
    if (!id) return null;
    return lesen(id);
  }

  async function wartendeIds(): Promise<string[]> {
    if (redis) {
      try {
        return (await redis.smembers(warteKey)) as string[];
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
        return [];
      }
    }
    return Array.from(warteSet());
  }

  async function wartendeFinden(
    stake: number,
    ohneUserId: string,
    limit = 8,
  ): Promise<DuellSession[]> {
    const ids = await wartendeIds();
    // Mischen, damit sich nicht alle auf dasselbe Duell stürzen.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const treffer: DuellSession[] = [];
    for (const id of ids) {
      if (treffer.length >= limit) break;
      const session = await lesen(id);
      if (
        session &&
        session.status === "waiting" &&
        session.stake === stake &&
        !session.spieler.some((s) => s.userId === ohneUserId)
      ) {
        treffer.push(session);
      }
    }
    return treffer;
  }

  return { lesen, lesenNachCode, speichern, wartendeFinden };
}

/** Serialisiert Zugriffe auf eine Session (Join-Race, Doppel-Move, Doppel-Claim). */
export function mitDuellSperre<T>(
  prefix: string,
  sessionId: string,
  arbeit: () => Promise<T>,
): Promise<T> {
  return mitBenutzerSperre(`duell:${prefix}:${sessionId}`, arbeit);
}
