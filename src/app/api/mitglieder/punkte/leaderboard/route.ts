import type { ServerUser } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import { rateLimit, rateLimitAntwort } from "@/lib/ratelimit";
import {
  type LeaderboardEintrag,
  positionFuer,
  vergleicheEintraege,
} from "@/lib/leaderboard";
import { leseBenutzername } from "@/lib/benutzername";
import { lesePunkte, lesePunkteGesamt, leseStreakTage } from "@/lib/punkte";

export const runtime = "nodejs";

/** So viele Mitglieder landen sichtbar in der Rangliste. */
const TOP_LIMIT = 10;
const SEITEN_GROESSE = 100;
/** Sicherheitsnetz: 10 Seiten × 100 Mitglieder, danach ist Schluss. */
const SEITEN_LIMIT = 10;
/** Fangnetz gegen Enumerations-Spam (Upstream-Last bei Hexclave). */
const LEADERBOARD_LIMIT = 30;
const LEADERBOARD_FENSTER_MS = 60 * 1000;
/** Ranglisten-Cache: Allen sehen dieselben Top-10, nur `du` ist persönlich. */
const LEADERBOARD_CACHE_MS = 60 * 1000;
let cacheEintraege: LeaderboardEintrag[] | null = null;
let cacheZeitpunkt = 0;

/** Anzeigenamen sind fremdkontrolliert (Hexclave-Signup) – Länge kappen,
 *  damit kein Eintrag die Rangliste sprengt oder HTML-Kontext bricht. */
const NAME_MAX = 48;

function zuEintrag(user: ServerUser): LeaderboardEintrag {
  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  // Rang nach je gesammelten XP (fällt nie): Wer eine echte Gurke einlöst,
  // verliert Guthaben, aber keinen Rang. Fallback für Altbestand ohne XP-Feld.
  const guthaben = lesePunkte(meta);
  const punkte = lesePunkteGesamt(meta, guthaben);
  const name = (user.displayName ?? "").trim().slice(0, NAME_MAX) || "Anonymes Gurkenkind";
  const seit = user.signedUpAt ? new Date(user.signedUpAt).getTime() : null;
  return { id: user.id, name, benutzername: leseBenutzername(meta), punkte, seit, streak: leseStreakTage(meta) };
}

/**
 * Gurken-Rangliste: sortiert alle Mitglieder ausschließlich nach je
 * gesammelten XP (fällt nie, auch nicht beim Einlösen), bei Gleichstand
 * gewinnt das ältere Mitglied.
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

  if (
    !(await rateLimit(
      `leaderboard:${user.id}`,
      LEADERBOARD_LIMIT,
      LEADERBOARD_FENSTER_MS,
    ))
  ) {
    return rateLimitAntwort(LEADERBOARD_FENSTER_MS);
  }

  const meinEintrag = zuEintrag(user);

  try {
    const jetzt = Date.now();
    let eintraege = cacheEintraege;
    if (!eintraege || jetzt - cacheZeitpunkt > LEADERBOARD_CACHE_MS) {
      eintraege = [];
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
      cacheEintraege = eintraege;
      cacheZeitpunkt = jetzt;
    }

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
