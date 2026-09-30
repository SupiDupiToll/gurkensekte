/**
 * Geteilter Speicher für Duell-Sessions, Wartezimmer-Präsenz und
 * Herausforderungen (P2P-Spielstand zwischen zwei Nutzern).
 *
 * Die Punkte selbst liegen pro Konto in Hexclave-Metadaten – hier liegt nur
 * der Spielstand: Brett, Zug, Status, Pot, Anwesenheit, Challenges. Mit
 * Upstash Redis teilen sich alle Serverless-Instanzen denselben Stand; ohne
 * Upstash-Envs (lokaler Dev) greift ein In-Memory-Fallback pro Instanz.
 *
 * Zwei Namensräume: `gurken:duell` (echte Mitglieder) und
 * `gurken:demo:duell` (Demo) – damit Demo- und Echtgeld-Ökonomie
 * (beides Spielgeld, aber getrennte Konten) nie in einem Pot landen.
 */

import { Redis } from "@upstash/redis";
import { mitBenutzerSperre } from "@/lib/ratelimit";
import {
  DUELL_CHALLENGE_SPEICHER_TTL_S,
  DUELL_PRAESENZ_TTL_MS,
  DUELL_SPEICHER_TTL_S,
  type DuellChallenge,
  type DuellSession,
  type WartezimmerGast,
} from "@/lib/duell";

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
  speichern: (session: DuellSession) => Promise<void>;
  /** Heartbeat: meldet einen Gast im Wartezimmer anwesend. */
  praesenzMelden: (gast: WartezimmerGast) => Promise<void>;
  /** Alle Gäste mit frischem Heartbeat (abgelaufene werden entsorgt). */
  raumLesen: () => Promise<WartezimmerGast[]>;
  challengeLesen: (id: string) => Promise<DuellChallenge | null>;
  challengeSpeichern: (challenge: DuellChallenge) => Promise<void>;
  /**
   * Alle bekannten Challenges mit Beteiligung des Nutzers (als Herausforderer
   * oder Ziel) – tote Einträge werden dabei aus dem Index entsorgt.
   */
  challengesFuer: (userId: string) => Promise<DuellChallenge[]>;
};

/** In-Memory-Fallback (Dev ohne Upstash) – ein Satz Maps für alle Präfixe. */
const speicherSessions = new Map<string, string>();
const speicherPraesenz = new Map<string, Map<string, string>>();
const speicherChallenges = new Map<string, string>();
const speicherChallengeIndex = new Map<string, Set<string>>();

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

function alsGast(wert: unknown): WartezimmerGast | null {
  try {
    const gast =
      typeof wert === "string"
        ? (JSON.parse(wert) as WartezimmerGast)
        : (wert as WartezimmerGast);
    if (
      typeof gast === "object" &&
      gast !== null &&
      typeof gast.userId === "string" &&
      typeof gast.aktualisiertAm === "number"
    ) {
      return gast;
    }
  } catch {
    // korrupter Eintrag – wie nicht gefunden behandeln
  }
  return null;
}

function alsChallenge(wert: unknown): DuellChallenge | null {
  try {
    const challenge =
      typeof wert === "string"
        ? (JSON.parse(wert) as DuellChallenge)
        : (wert as DuellChallenge);
    if (
      typeof challenge === "object" &&
      challenge !== null &&
      typeof challenge.id === "string" &&
      typeof challenge.status === "string"
    ) {
      return challenge;
    }
  } catch {
    // korrupter Eintrag – wie nicht gefunden behandeln
  }
  return null;
}

export function duellStore(prefix: string): DuellStore {
  const sessionKey = (id: string) => `${prefix}:session:${id}`;
  const praesenzKey = `${prefix}:praesenz`;
  const challengeKey = (id: string) => `${prefix}:challenge:${id}`;
  const challengeIndexKey = `${prefix}:challenges`;

  function praesenzMap(): Map<string, string> {
    let map = speicherPraesenz.get(praesenzKey);
    if (!map) {
      map = new Map<string, string>();
      speicherPraesenz.set(praesenzKey, map);
    }
    return map;
  }

  function challengeIndex(): Set<string> {
    let set = speicherChallengeIndex.get(challengeIndexKey);
    if (!set) {
      set = new Set<string>();
      speicherChallengeIndex.set(challengeIndexKey, set);
    }
    return set;
  }

  async function speichern(session: DuellSession): Promise<void> {
    const json = JSON.stringify(session);
    if (redis) {
      try {
        await redis.set(sessionKey(session.id), json, {
          ex: DUELL_SPEICHER_TTL_S,
        });
        return;
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    speicherSessions.set(sessionKey(session.id), json);
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

  async function praesenzMelden(gast: WartezimmerGast): Promise<void> {
    const json = JSON.stringify(gast);
    if (redis) {
      try {
        await redis.hset(praesenzKey, { [gast.userId]: json });
        return;
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    praesenzMap().set(gast.userId, json);
  }

  /** Liest alle Gäste und entsorgt nebenbei abgelaufene Heartbeats. */
  async function raumLesen(): Promise<WartezimmerGast[]> {
    const jetzt = Date.now();
    const frisch: WartezimmerGast[] = [];
    const abgelaufen: string[] = [];
    const einsammeln = (userId: string, wert: unknown) => {
      const gast = alsGast(wert);
      if (!gast) {
        abgelaufen.push(userId);
        return;
      }
      if (jetzt - gast.aktualisiertAm > DUELL_PRAESENZ_TTL_MS) {
        abgelaufen.push(userId);
        return;
      }
      frisch.push(gast);
    };
    if (redis) {
      try {
        const alle = (await redis.hgetall<Record<string, string>>(
          praesenzKey,
        )) as Record<string, string> | null;
        for (const [userId, wert] of Object.entries(alle ?? {})) {
          einsammeln(userId, wert);
        }
        if (abgelaufen.length > 0) {
          await redis.hdel(praesenzKey, ...abgelaufen);
        }
        return frisch;
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    const map = praesenzMap();
    for (const [userId, wert] of map) {
      einsammeln(userId, wert);
    }
    for (const userId of abgelaufen) map.delete(userId);
    return frisch;
  }

  async function challengeLesen(id: string): Promise<DuellChallenge | null> {
    if (redis) {
      try {
        return alsChallenge(await redis.get(challengeKey(id)));
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    return alsChallenge(speicherChallenges.get(challengeKey(id)) ?? null);
  }

  async function challengeSpeichern(challenge: DuellChallenge): Promise<void> {
    const json = JSON.stringify(challenge);
    if (redis) {
      try {
        await Promise.all([
          redis.set(challengeKey(challenge.id), json, {
            ex: DUELL_CHALLENGE_SPEICHER_TTL_S,
          }),
          redis.sadd(challengeIndexKey, challenge.id),
        ]);
        return;
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    }
    speicherChallenges.set(challengeKey(challenge.id), json);
    challengeIndex().add(challenge.id);
  }

  async function challengesFuer(userId: string): Promise<DuellChallenge[]> {
    let ids: string[] = [];
    if (redis) {
      try {
        ids = (await redis.smembers(challengeIndexKey)) as string[];
      } catch (error) {
        console.error("Duell-Store (Upstash) nicht erreichbar:", error);
      }
    } else {
      ids = Array.from(challengeIndex());
    }
    const treffer: DuellChallenge[] = [];
    const tot: string[] = [];
    // Alte Terminal-Challenges (lange entschieden) aus dem Index werfen,
    // damit die Discovery-Liste klein bleibt – der direkte Zugriff per ID
    // (für späte Refund-Claims) läuft über die TTL der Challenge weiter.
    const indexAblaufMs = 10 * 60 * 1000;
    for (const id of ids) {
      const challenge = await challengeLesen(id);
      if (!challenge) {
        tot.push(id);
        continue;
      }
      if (
        challenge.status !== "offen" &&
        Date.now() - challenge.aktualisiertAm > indexAblaufMs
      ) {
        tot.push(id);
        continue;
      }
      if (
        challenge.von.userId === userId ||
        challenge.an.userId === userId
      ) {
        treffer.push(challenge);
      }
    }
    for (const id of tot) {
      if (redis) {
        try {
          await redis.srem(challengeIndexKey, id);
        } catch {
          // best-effort
        }
      } else {
        challengeIndex().delete(id);
      }
    }
    return treffer;
  }

  return {
    lesen,
    speichern,
    praesenzMelden,
    raumLesen,
    challengeLesen,
    challengeSpeichern,
    challengesFuer,
  };
}

/** Serialisiert Zugriffe auf eine Session (Doppel-Move, Doppel-Claim). */
export function mitDuellSperre<T>(
  prefix: string,
  sessionId: string,
  arbeit: () => Promise<T>,
): Promise<T> {
  return mitBenutzerSperre(`duell:${prefix}:${sessionId}`, arbeit);
}

/** Serialisiert Zugriffe auf eine Challenge (Doppel-Annahme, Doppel-Claim). */
export function mitChallengeSperre<T>(
  prefix: string,
  challengeId: string,
  arbeit: () => Promise<T>,
): Promise<T> {
  return mitBenutzerSperre(`duell:${prefix}:challenge:${challengeId}`, arbeit);
}
