import { hexclaveServerApp } from "@/hexclave/server";
import {
  GURKENMAIL_MAX_PRO_TAG,
  gesendetHeute,
  gurkenmailAdresse,
  heuteISO,
  leseMailbox,
  normalisiereDisplayName,
  normalisiereLocalpart,
  passtZuBasis,
  vorschlagsBasis,
} from "@/lib/gurkenmail";
import { leseBenutzername } from "@/lib/benutzername";
import { mitBenutzerSperre } from "@/lib/ratelimit";
import { syncMailboxZumWorker } from "@/lib/gurkenmailServer";

export const runtime = "nodejs";

/** Vergibt genau eine Mailbox pro User: localpart@gurkensekte.de + Absendername. */
export async function POST(req: Request) {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  })) as unknown as {
    id: string;
    displayName?: string | null;
    clientReadOnlyMetadata?: Record<string, unknown>;
    setClientReadOnlyMetadata?: (meta: Record<string, unknown>) => Promise<unknown>;
  } | null;
  if (!user?.id || typeof user.setClientReadOnlyMetadata !== "function") {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Ungültiger Request" }, { status: 400 });
  }
  const { localpart, displayName } = (body ?? {}) as Record<string, unknown>;
  const normLocal = normalisiereLocalpart(localpart);
  const normName = normalisiereDisplayName(displayName);
  // Adress-Basis: bevorzugt der eindeutige Benutzername (neue Nutzer),
  // Fallback der Hexclave-Anzeigename (Altbestand ohne Benutzername).
  // Nur die Zahl bei belegter Adresse ist frei wählbar.
  const metaVorab = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const nameAusBenutzername = leseBenutzername(metaVorab);
  const basis =
    (nameAusBenutzername && normalisiereLocalpart(nameAusBenutzername)) ||
    vorschlagsBasis(user.displayName);
  if (!normLocal || !passtZuBasis(normLocal, basis)) {
    return Response.json(
      {
        error:
          "Diese Adresse ist nicht für dich vorgesehen – nimm deine vorgegebene Basis, ggf. mit Zahl.",
      },
      { status: 400 },
    );
  }
  if (!normName) {
    return Response.json(
      { error: "Absendername ungültig: 2–40 Zeichen, bitte einen echten Namen (keine E-Mail-Adresse)." },
      { status: 400 },
    );
  }

  try {
    const mailbox = await mitBenutzerSperre(`gurkenmail:${user.id}`, async () => {
      // Frisch lesen: kein doppeltes Vergabe-Race im selben Konto.
      const frisch = (await hexclaveServerApp.getUser({
        tokenStore: req,
        or: "return-null",
      })) as unknown as {
        id: string;
        clientReadOnlyMetadata?: Record<string, unknown>;
        setClientReadOnlyMetadata: (meta: Record<string, unknown>) => Promise<unknown>;
      } | null;
      if (!frisch || frisch.id !== user.id) {
        throw new Error("unauthorized");
      }
      const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
      const bestehend = leseMailbox(meta);
      if (bestehend) return bestehend;

      // Globale Eindeutigkeit: Upstash SET NX auf den Localpart.
      // Ohne Upstash (lokaler Dev) entfällt die globale Prüfung – in
      // Production ist Upstash Pflicht, sonst 503 statt stiller Doppelvergabe.
      const url =
        process.env.UPSTASH_REDIS_REST_URL ??
        process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ??
        process.env.KV_REST_API_URL;
      const token =
        process.env.UPSTASH_REDIS_REST_TOKEN ??
        process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ??
        process.env.KV_REST_API_TOKEN;
      if (url && token) {
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({ url, token });
        const belegt = await redis.set(`gurkenmail:addr:${normLocal}`, user.id, { nx: true });
        if (belegt !== "OK") {
          throw new Error("belegt");
        }
        await redis.set(`gurkenmail:user:${user.id}`, normLocal, { nx: true });
      } else if (process.env.NODE_ENV === "production") {
        throw new Error("kein-redis");
      }

      const update: Record<string, unknown> = {
        ...meta,
        gurkenmailLocalpart: normLocal,
        gurkenmailDisplayName: normName,
        gurkenmailSentDate: meta.gurkenmailSentDate ?? heuteISO(),
        gurkenmailSentCount:
          typeof meta.gurkenmailSentCount === "number" ? meta.gurkenmailSentCount : 0,
      };
      await frisch.setClientReadOnlyMetadata(update);
      // D1-Spiegel für Zustellung (fail-open – wird sonst nachgeholt).
      await syncMailboxZumWorker(normLocal, user.id);
      return {
        localpart: normLocal,
        address: gurkenmailAdresse(normLocal),
        displayName: normName,
      };
    });
    return Response.json({ mailbox, limitProTag: GURKENMAIL_MAX_PRO_TAG });
  } catch (error) {
    if (error instanceof Error && error.message === "belegt") {
      return Response.json({ error: "Diese Adresse ist schon vergeben – häng einfach eine Zahl an (z. B. eine 2)." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "kein-redis") {
      return Response.json(
        { error: "Adressvergabe gerade nicht verfügbar – bitte später erneut versuchen." },
        { status: 503 },
      );
    }
    if (error instanceof Error && error.message === "unauthorized") {
      return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }
    console.error("GurkenMail Mailbox-Fehler:", error);
    return Response.json({ error: "Konnte Adresse nicht anlegen." }, { status: 500 });
  }
}

/** Eigene Mailbox + heutiges Sende-Kontingent abfragen. */
export async function GET(req: Request) {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  })) as unknown as {
    id: string;
    clientReadOnlyMetadata?: Record<string, unknown>;
  } | null;
  if (!user?.id) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const mailbox = leseMailbox(meta);
  const heute = heuteISO();
  const gesendet = gesendetHeute(meta, heute);
  return Response.json({
    mailbox,
    gesendetHeute: gesendet,
    limitProTag: GURKENMAIL_MAX_PRO_TAG,
    restHeute: Math.max(0, GURKENMAIL_MAX_PRO_TAG - gesendet),
  });
}
