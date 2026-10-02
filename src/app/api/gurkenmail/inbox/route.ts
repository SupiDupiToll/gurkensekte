import { hexclaveServerApp } from "@/hexclave/server";
import { leseMailbox } from "@/lib/gurkenmail";
import { syncMailboxZumWorker } from "@/lib/gurkenmailServer";
import type { GurkenmailEingang } from "@/lib/gurkenmail";
import {
  GURKENMAIL_AWARDED_IDS_MAX,
  gurkenmailEmpfangsBonus,
  leseGurkenmailAwardedIds,
  lesePunkte,
  lesePunkteGesamt,
  leseVerlauf,
} from "@/lib/punkte";
import { istSperreBelegtFehler, mitBenutzerSperre } from "@/lib/ratelimit";

export const runtime = "nodejs";

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

type FrischUser = {
  id: string;
  clientReadOnlyMetadata?: Record<string, unknown>;
  setClientReadOnlyMetadata: (meta: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Posteingang: proxyt zum Empfangs-Worker (D1). Ohne konfigurierten Worker
 * (lokal / vor dem Routing-Setup) leeres Ergebnis + `bereit: false`.
 *
 * Empfangs-Punkte (+5 je neuer Mail, max. 10/Stunde) werden hier einmalig
 * je Mail-ID gutgeschrieben – im selben Lock wie der Fresh-Read, damit
 * parallele Refreshs keine Doppel-Boni erzeugen.
 */
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
  if (!mailbox) {
    return Response.json({ error: "Noch keine GurkenMail-Adresse", mails: [] }, { status: 404 });
  }

  if (!INBOUND_URL || !INBOUND_SECRET) {
    const mails: GurkenmailEingang[] = [];
    return Response.json({ mailbox, mails, bereit: false, ungelesen: 0, punkteDelta: 0 });
  }

  // Selbstheilung: eigene Mailbox in D1 spiegeln, falls der Sync bei der
  // Vergabe (Worker war noch nicht deployed) fehlgeschlagen ist.
  await syncMailboxZumWorker(mailbox.localpart, user.id);

  try {
    const aufruf = new URL(req.url);
    const url = new URL("/inbox", INBOUND_URL);
    url.searchParams.set("mailbox", mailbox.localpart);
    // Paginierung durchreichen (Default: erste 5, für schnelleres Laden).
    url.searchParams.set("limit", aufruf.searchParams.get("limit") ?? "5");
    url.searchParams.set("offset", aufruf.searchParams.get("offset") ?? "0");
    // Inkrementelles Nachladen: nur Mails neuer als `since` (ISO-Zeit).
    const since = aufruf.searchParams.get("since");
    if (since && since.length <= 100) url.searchParams.set("since", since);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${INBOUND_SECRET}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Inbound ${res.status}`);
    const data = (await res.json()) as {
      mails?: GurkenmailEingang[];
      hasMore?: boolean;
      ungelesen?: number;
    };
    const mails = data.mails ?? [];
    const ungelesen =
      typeof data.ungelesen === "number" && Number.isFinite(data.ungelesen) ? data.ungelesen : 0;

    const punkteDelta = await bucheEmpfangsPunkte(req, user.id, mails);

    return Response.json({
      mailbox,
      mails,
      hasMore: data.hasMore ?? false,
      bereit: true,
      ungelesen,
      punkteDelta,
    });
  } catch (error) {
    if (istSperreBelegtFehler(error)) {
      return Response.json(
        { mailbox, mails: [], bereit: false, ungelesen: 0, punkteDelta: 0, error: "Bitte kurz warten und erneut versuchen." },
        { status: 409 },
      );
    }
    console.error("GurkenMail Inbox-Proxy:", error);
    return Response.json(
      { mailbox, mails: [], bereit: false, ungelesen: 0, punkteDelta: 0, error: "Postfach gerade nicht erreichbar." },
      { status: 502 },
    );
  }
}

/**
 * Schreibt +5 je neuer Mail gut, max. 2 vergütete Mails pro Stunde (ganze
 * Einheiten, kein Teilbetrag). Alle erstmals gesehenen IDs werden als
 * verarbeitet markiert – auch ohne Budget, damit der Stundendeckel strikt
 * bei max. 10 Punkten bleibt und nichts in die nächste Stunde rutscht.
 */
async function bucheEmpfangsPunkte(
  req: Request,
  userId: string,
  mails: GurkenmailEingang[],
): Promise<number> {
  if (mails.length === 0) return 0;
  try {
    return await mitBenutzerSperre(`gurkenmail:${userId}`, async () => {
      const frisch = (await hexclaveServerApp.getUser({
        tokenStore: req,
        or: "return-null",
      })) as unknown as FrischUser | null;
      if (!frisch || frisch.id !== userId) return 0;
      const frischeMeta = (frisch.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
      const bekannt = new Set(leseGurkenmailAwardedIds(frischeMeta));
      const neu = mails.filter((m) => m && typeof m.id === "string" && !bekannt.has(m.id));
      if (neu.length === 0) return 0;

      const jetzt = Date.now();
      let entwurf: Record<string, unknown> = { ...frischeMeta };
      let gesamt = 0;
      for (let i = 0; i < neu.length; i++) {
        const { bonus, update } = gurkenmailEmpfangsBonus(entwurf, jetzt);
        entwurf = { ...entwurf, ...update };
        gesamt += bonus;
      }
      const neueIds = neu.map((m) => m.id);
      if (gesamt <= 0) {
        // Nur als verarbeitet markieren (kein Punkte-Write nötig).
        const awarded = [...bekannt, ...neueIds].slice(-GURKENMAIL_AWARDED_IDS_MAX);
        await frisch.setClientReadOnlyMetadata({
          ...entwurf,
          gurkenmailPunkteMailIds: awarded,
        });
        return 0;
      }

      const stand = lesePunkte(entwurf);
      const newPoints = stand + gesamt;
      const newTotal = lesePunkteGesamt(entwurf, stand) + gesamt;
      const verlauf = leseVerlauf(entwurf).slice(-9);
      verlauf.push({
        datum: new Date().toISOString(),
        aktion: "gurkenmail-empfang",
        punkte: gesamt,
        saldo: newPoints,
      });
      const awarded = [...bekannt, ...neueIds].slice(-GURKENMAIL_AWARDED_IDS_MAX);
      await frisch.setClientReadOnlyMetadata({
        ...entwurf,
        punkte: newPoints,
        punkteGesamt: newTotal,
        punkteVerlauf: verlauf,
        gurkenmailPunkteMailIds: awarded,
      });
      return gesamt;
    });
  } catch (error) {
    if (istSperreBelegtFehler(error)) return 0;
    console.error("GurkenMail Empfangs-Punkte:", error);
    return 0;
  }
}
