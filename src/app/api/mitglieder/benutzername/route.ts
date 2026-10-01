import { hexclaveServerApp } from "@/hexclave/server";
import {
  benutzernameVorschlag,
  leseBenutzername,
  normalisiereBenutzername,
} from "@/lib/benutzername";
import { mitBenutzerSperre, istSperreBelegtFehler } from "@/lib/ratelimit";

export const runtime = "nodejs";

type MetaUser = {
  id: string;
  displayName?: string | null;
  clientReadOnlyMetadata?: Record<string, unknown>;
  setClientReadOnlyMetadata?: (meta: Record<string, unknown>) => Promise<unknown>;
};

function redisEnv(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
    process.env.KV_REST_API_TOKEN;
  if (url && token) return { url, token };
  return null;
}

async function leseUser(req: Request): Promise<MetaUser | null> {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  })) as unknown as MetaUser | null;
  if (!user?.id) return null;
  return user;
}

/**
 * GET: eigener Benutzername + Vorschlag.
 * `?pruefe=NAME` → Verfügbarkeitscheck (200 frei / 409 belegt / 400 ungültig).
 */
export async function GET(req: Request) {
  const user = await leseUser(req);
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const benutzername = leseBenutzername(meta);
  const vorschlag = benutzernameVorschlag(user.displayName);

  const url = new URL(req.url);
  const pruefe = url.searchParams.get("pruefe");
  if (pruefe !== null) {
    const norm = normalisiereBenutzername(pruefe);
    if (!norm) {
      return Response.json({ frei: false, error: "Ungültiger Benutzername." }, { status: 400 });
    }
    if (norm === benutzername) {
      return Response.json({ frei: true, eigen: true, benutzername: norm });
    }
    const env = redisEnv();
    if (!env) {
      if (process.env.NODE_ENV === "production") {
        return Response.json(
          { frei: false, error: "Prüfung gerade nicht verfügbar." },
          { status: 503 },
        );
      }
      return Response.json({ frei: true, devHinweis: "ohne Upstash" });
    }
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url: env.url, token: env.token });
    const belegt = await redis.get(`gurke:benutzername:${norm}`);
    if (belegt) {
      return Response.json({ frei: false }, { status: 409 });
    }
    return Response.json({ frei: true });
  }

  return Response.json({ benutzername, vorschlag });
}

/**
 * POST { benutzername }: erstmaliges Setzen oder Umbenennen.
 * Global eindeutig (Upstash SET NX). Umbenennen gibt den alten Namen frei.
 */
export async function POST(req: Request) {
  const user = await leseUser(req);
  if (!user?.id || typeof user.setClientReadOnlyMetadata !== "function") {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ungültiger Request" }, { status: 400 });
  }
  const norm = normalisiereBenutzername(
    (body as Record<string, unknown> | null)?.benutzername,
  );
  if (!norm) {
    return Response.json(
      {
        error:
          "Ungültiger Benutzername: 3–20 Zeichen, nur Kleinbuchstaben, Zahlen und . _ - (nicht am Anfang/Ende, kein ..).",
      },
      { status: 400 },
    );
  }

  const env = redisEnv();
  if (!env) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Vergabe gerade nicht verfügbar – bitte später erneut versuchen." },
        { status: 503 },
      );
    }
    // Lokaler Dev ohne Upstash: nur lokal speichern (keine globale Prüfung).
    try {
      const gespeichert = await mitBenutzerSperre(`benutzername:${user.id}`, async () => {
        const frisch = (await leseUser(req)) as MetaUser | null;
        if (!frisch || frisch.id !== user.id) throw new Error("unauthorized");
        const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
        await frisch.setClientReadOnlyMetadata!({ ...meta, benutzername: norm });
        return norm;
      });
      return Response.json({ benutzername: gespeichert, devHinweis: "ohne Upstash" });
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
      }
      if (istSperreBelegtFehler(error)) {
        return Response.json({ error: "Bitte kurz warten und erneut versuchen." }, { status: 409 });
      }
      throw error;
    }
  }

  try {
    const gespeichert = await mitBenutzerSperre(`benutzername:${user.id}`, async () => {
      const frisch = (await leseUser(req)) as MetaUser | null;
      if (!frisch || frisch.id !== user.id) throw new Error("unauthorized");
      const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
      const alt = leseBenutzername(meta);
      if (alt === norm) return norm;

      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: env.url, token: env.token });

      // Eigener alter Key (oder Leak aus früherem Rename) darf übernommen werden.
      const belegtVon = await redis.get<string>(`gurke:benutzername:${norm}`);
      if (belegtVon !== null && belegtVon !== user.id) throw new Error("belegt");

      // Neu reservieren (NX – falls Race seit dem GET).
      const gesetzt = await redis.set(`gurke:benutzername:${norm}`, user.id, { nx: true });
      if (gesetzt !== "OK") {
        const nochmal = await redis.get<string>(`gurke:benutzername:${norm}`);
        if (nochmal !== user.id) throw new Error("belegt");
      }
      await redis.set(`gurke:benutzername:user:${user.id}`, norm);

      await frisch.setClientReadOnlyMetadata!({ ...meta, benutzername: norm });

      // Alten Namen freigeben (best-effort – zeigt ggf. noch auf uns, dann löschen).
      if (alt && alt !== norm) {
        try {
          const altBesitzer = await redis.get<string>(`gurke:benutzername:${alt}`);
          if (altBesitzer === user.id) await redis.del(`gurke:benutzername:${alt}`);
        } catch {
          // Freigabe fehlgeschlagen: Name bleibt reserviert, Funktion ok.
        }
      }
      return norm;
    });
    return Response.json({ benutzername: gespeichert });
  } catch (error) {
    if (error instanceof Error && error.message === "belegt") {
      return Response.json(
        { error: "Dieser Benutzername ist schon vergeben – bitte einen anderen wählen." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "unauthorized") {
      return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }
    if (istSperreBelegtFehler(error)) {
      return Response.json({ error: "Bitte kurz warten und erneut versuchen." }, { status: 409 });
    }
    console.error("Benutzername-Fehler:", error);
    return Response.json({ error: "Konnte Benutzernamen nicht speichern." }, { status: 500 });
  }
}
