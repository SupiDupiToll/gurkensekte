import { hexclaveServerApp } from "@/hexclave/server";
import { leseBenutzername } from "@/lib/benutzername";
import {
  leseTourStatus,
  normalisiereTourSchritt,
} from "@/lib/tour";
import { mitBenutzerSperre, istSperreBelegtFehler } from "@/lib/ratelimit";

export const runtime = "nodejs";

type MetaUser = {
  id: string;
  clientReadOnlyMetadata?: Record<string, unknown>;
  setClientReadOnlyMetadata?: (meta: Record<string, unknown>) => Promise<unknown>;
};

async function leseUser(req: Request): Promise<MetaUser | null> {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  })) as unknown as MetaUser | null;
  if (!user?.id) return null;
  return user;
}

/** GET: Tour-Status + Benutzername (damit die Tour weiß, ob sie starten darf). */
export async function GET(req: Request) {
  const user = await leseUser(req);
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  return Response.json({
    tour: leseTourStatus(meta),
    benutzername: leseBenutzername(meta),
  });
}

/**
 * POST { schritt?, abgeschlossen?, abgebrochen? }: speichert den Fortschritt.
 * Eigene Sperre `tour:<id>` (nicht `punkte:<id>`), Merge via Spread –
 * fremde Metadaten (Punkte, Mailbox, Benutzername) bleiben unangetastet.
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
  const b = (body ?? {}) as Record<string, unknown>;
  const schritt =
    b.schritt === undefined ? undefined : normalisiereTourSchritt(b.schritt);
  if (b.schritt !== undefined && !schritt) {
    return Response.json({ error: "Ungültiger Tour-Schritt." }, { status: 400 });
  }

  try {
    const tour = await mitBenutzerSperre(`tour:${user.id}`, async () => {
      const frisch = await leseUser(req);
      if (!frisch || frisch.id !== user.id) throw new Error("unauthorized");
      const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
      const update: Record<string, unknown> = { ...meta };
      if (schritt) update.tourSchritt = schritt;
      if (b.abgeschlossen === true) update.tourAbgeschlossen = true;
      if (b.abgeschlossen === false) update.tourAbgeschlossen = false;
      if (b.abgebrochen === true) update.tourAbgebrochen = true;
      await frisch.setClientReadOnlyMetadata!(update);
      return leseTourStatus(update);
    });
    return Response.json({ tour });
  } catch (error) {
    if (error instanceof Error && error.message === "unauthorized") {
      return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }
    if (istSperreBelegtFehler(error)) {
      return Response.json(
        { error: "Bitte kurz warten und erneut versuchen." },
        { status: 409 },
      );
    }
    console.error("Tour-Fehler:", error);
    return Response.json({ error: "Konnte Tour-Status nicht speichern." }, { status: 500 });
  }
}
