import type { ServerUser } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import {
  type LeaderboardEintrag,
  positionFuer,
  vergleicheEintraege,
} from "@/lib/leaderboard";

export const runtime = "nodejs";

/** So viele Mitglieder landen sichtbar in der Rangliste. */
const TOP_LIMIT = 10;
const SEITEN_GROESSE = 100;
/** Sicherheitsnetz: 10 Seiten × 100 Mitglieder, danach ist Schluss. */
const SEITEN_LIMIT = 10;

function zuEintrag(user: ServerUser): LeaderboardEintrag {
  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const punkte = typeof meta.punkte === "number" ? meta.punkte : 0;
  const name = (user.displayName ?? "").trim() || "Anonymes Gurkenkind";
  const seit = user.signedUpAt ? new Date(user.signedUpAt).getTime() : null;
  return { id: user.id, name, punkte, seit };
}

/**
 * Gurken-Rangliste: sortiert alle Mitglieder ausschließlich nach den normalen
 * Punkten (Guthaben), bei Gleichstand gewinnt das ältere Mitglied.
 * E-Mails werden bewusst nicht herausgegeben, nur Anzeigename und Punkte.
 */
export async function GET(req: Request) {
  let user: ServerUser | null;
  try {
    user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  } catch {
    return Response.json(
      { error: "Rangliste derzeit nicht verfügbar" },
      { status: 502 },
    );
  }
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const meinEintrag = zuEintrag(user);

  try {
    const eintraege: LeaderboardEintrag[] = [];
    let cursor: string | undefined;

    for (let seite = 0; seite < SEITEN_LIMIT; seite++) {
      const antwort = await hexclaveServerApp.listUsers({
        cursor,
        limit: SEITEN_GROESSE,
      });
      for (const mitglied of antwort) {
        eintraege.push(zuEintrag(mitglied));
      }
      cursor = antwort.nextCursor ?? undefined;
      if (!cursor) break;
    }

    eintraege.sort(vergleicheEintraege);

    const index = eintraege.findIndex((e) => e.id === meinEintrag.id);
    const rang =
      index >= 0 ? index + 1 : positionFuer(eintraege, meinEintrag);
    const gesamt = index >= 0 ? eintraege.length : eintraege.length + 1;

    return Response.json({
      eintraege: eintraege.slice(0, TOP_LIMIT),
      gesamt,
      du: { rang, eintrag: index >= 0 ? eintraege[index] : meinEintrag },
    });
  } catch {
    return Response.json(
      { error: "Rangliste derzeit nicht verfügbar" },
      { status: 502 },
    );
  }
}
