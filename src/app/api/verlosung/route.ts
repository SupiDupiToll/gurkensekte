import { hexclaveServerApp } from "@/hexclave/server";
import { mitBenutzerSperre } from "@/lib/ratelimit";
import { leseBenutzername } from "@/lib/benutzername";
import {
  VERLOSUNG_MONATE_RUECKBLICK,
  ticketsFuerMonat,
  verlosungsAnzeige,
  verlosungsMonat,
  verlosungsMonate,
  zieheGewinnerIndex,
  type LosKandidat,
  type VerlosungRecord,
} from "@/lib/verlosung";
import {
  leseAlleLose,
  leseLose,
  leseVerlosung,
  speichereVerlosungNeu,
} from "@/lib/verlosungStore";

export const runtime = "nodejs";

/** Wie in der Rangliste: begrenzte Enumeration als Spam-Schutz. */
const SEITEN_GROESSE = 100;
const SEITEN_LIMIT = 10;

const NAME_MAX = 48;

type MitgliedKurz = {
  id: string;
  name: string;
  benutzername: string | null;
  meta: Record<string, unknown>;
};

/**
 * Zieht den Monatsgewinner (genau einmal, Redis SET NX entscheidet das
 * Rennen): Lose aus Daily-Buchungen, deterministische Auswahl per Hash.
 * Ohne Teilnehmer wird ein leerer Datensatz festgeschrieben (kein
 * Neuaufzählen bei jedem Aufruf).
 */
async function zieheMonat(monat: string): Promise<VerlosungRecord> {
  return mitBenutzerSperre(`verlosung-ziehen:${monat}`, async () => {
    const vorhanden = await leseVerlosung(monat);
    if (vorhanden) return vorhanden;

    const mitglieder: MitgliedKurz[] = [];
    let cursor: string | undefined;
    for (let seite = 0; seite < SEITEN_LIMIT; seite++) {
      const antwort = await hexclaveServerApp.listUsers({
        cursor,
        limit: SEITEN_GROESSE,
      });
      for (const m of antwort) {
        mitglieder.push({
          id: m.id,
          name: (m.displayName ?? "").trim().slice(0, NAME_MAX) || "Anonymes Gurkenkind",
          benutzername: leseBenutzername(
            (m.clientReadOnlyMetadata ?? {}) as Record<string, unknown>,
          ),
          meta: (m.clientReadOnlyMetadata ?? {}) as Record<string, unknown>,
        });
      }
      cursor = antwort.nextCursor ?? undefined;
      if (!cursor) break;
    }

    const kandidaten: (LosKandidat & { anzeige: string })[] = [];
    // Exakte Monats-Werte aus Upstash; Hexclave-Verlauf nur als Rückfall für
    // Claims von vor dem Zähler (kein Zähler-Wert → Verlauf, gedeckelt).
    const zaehler = await leseAlleLose(monat);
    for (const m of mitglieder) {
      const exakt = zaehler.get(m.id) ?? 0;
      const tickets =
        exakt > 0 ? exakt : ticketsFuerMonat(m.meta, monat);
      if (tickets > 0) {
        kandidaten.push({
          id: m.id,
          tickets,
          anzeige: verlosungsAnzeige(m.name, m.benutzername),
        });
      }
    }

    const gesamtLose = kandidaten.reduce((s, k) => s + k.tickets, 0);
    const gewinnerIndex =
      kandidaten.length > 0 ? zieheGewinnerIndex(kandidaten, monat) : -1;
    const gewinner =
      gewinnerIndex >= 0 ? kandidaten[gewinnerIndex] : null;

    const record: VerlosungRecord = {
      monat,
      gewinnerId: gewinner ? gewinner.id : null,
      gewinnerAnzeige: gewinner ? gewinner.anzeige : null,
      lose: gewinner ? gewinner.tickets : 0,
      gesamtLose,
      teilnehmer: kandidaten.length,
      gezogenAm: new Date().toISOString(),
      status: "offen",
      art: null,
      eingeloestAm: null,
    };
    await speichereVerlosungNeu(monat, record);
    // Rennen verloren oder Redis weg: Stand erneut lesen (kann null bleiben –
    // dann antwortet der Aufrufer mit "noch nicht gezogen").
    return (await leseVerlosung(monat)) ?? record;
  });
}

/** Eigene Lose: exakter Zähler, Verlauf nur als Rückfall (Vor-Zähler-Ära). */
async function meineLoseFuer(
  meta: Record<string, unknown>,
  monat: string,
  userId: string,
): Promise<number> {
  const exakt = await leseLose(monat, userId);
  return exakt > 0 ? exakt : ticketsFuerMonat(meta, monat);
}

export async function GET(req: Request) {
  const user = await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  try {
    const monate = verlosungsMonate(VERLOSUNG_MONATE_RUECKBLICK);
    const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;

    // Neuester offener Eigengewinn zuerst (letzte 3 Monate).
    for (const monat of monate) {
      let record = await leseVerlosung(monat);
      if (!record) record = await zieheMonat(monat);
      if (
        record.gewinnerId === user.id &&
        record.status === "offen"
      ) {
        return Response.json({
          monat: record.monat,
          gewinner: record.gewinnerAnzeige,
          ichGewinner: true,
          status: record.status,
          art: record.art,
          meineLose: await meineLoseFuer(meta, record.monat, user.id),
          teilnehmer: record.teilnehmer,
          gesamtLose: record.gesamtLose,
        });
      }
    }

    // Sonst: Stand des aktuellen Topfs (neuester Monat).
    const aktuell = monate[0] ?? verlosungsMonat();
    let record = await leseVerlosung(aktuell);
    if (!record) record = await zieheMonat(aktuell);
    return Response.json({
      monat: record.monat,
      gewinner: record.gewinnerAnzeige,
      ichGewinner: record.gewinnerId === user.id,
      status: record.status,
      art: record.art,
      meineLose: await meineLoseFuer(meta, record.monat, user.id),
      teilnehmer: record.teilnehmer,
      gesamtLose: record.gesamtLose,
    });
  } catch {
    return Response.json(
      { error: "Verlosung derzeit nicht verfügbar" },
      { status: 502 },
    );
  }
}
