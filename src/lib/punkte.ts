/**
 * Geteilte Punkte-Buchungshelfer: guarded Reads + TOCTOU-sicheres Schreiben.
 *
 * Alle Buchungen liefen als Lese-Ändern-Schreiben ohne Lock (doppelter Bonus
 * bei parallelen Requests). Das Muster ist jetzt überall gleich:
 *  1. Vorab-Checks auf ggf. veralteten Metadaten (schnelles UX-Feedback),
 *  2. `mitFrischemBenutzer(...)`: Lock pro Konto + frischer Re-Read der
 *     Metadaten + erneute Prüfung + Schreiben.
 */

import type { ServerUser } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
import { mitBenutzerSperre } from "@/lib/ratelimit";

export type BuchungsUser = ServerUser & {
  setClientReadOnlyMetadata: (
    meta: Record<string, unknown>,
  ) => Promise<unknown>;
};

/** Punkte pro Chat-Nachricht bzw. Zitat – jede Buchung kostet ein frisches Captcha. */
export const PUNKTE_CHAT = 5;
export const PUNKTE_ZITAT = 5;
/** Max. Zitat-Boni pro Konto und Tag. */
export const ZITAT_MAX_PRO_TAG = 3;

/** Fehler mit HTTP-Status für Buchungs-Abbrüche (Quota, Guthaben, Login). */
export class PunkteFehler extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PunkteFehler";
    this.status = status;
  }
}

export function istPunkteFehler(error: unknown): error is PunkteFehler {
  return error instanceof PunkteFehler;
}

/** Tagesdatum (UTC) für Tagesquoten. */
export function heuteISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Guarded Read: `?? 0` allein fängt nur null/undefined – korrupte Strings,
 * NaN oder Objekte würden sonst String-Konkatenation (`"0"+5`) oder
 * NaN-Salden erzeugen.
 */
export function lesePunkte(meta: Record<string, unknown>): number {
  const wert = meta.punkte;
  return typeof wert === "number" && Number.isFinite(wert) ? wert : 0;
}

export function lesePunkteGesamt(
  meta: Record<string, unknown>,
  fallback: number,
): number {
  const wert = meta.punkteGesamt;
  return typeof wert === "number" && Number.isFinite(wert) ? wert : fallback;
}

export function leseVerlauf(meta: Record<string, unknown>): unknown[] {
  const wert = meta.punkteVerlauf;
  return Array.isArray(wert) ? wert : [];
}

/** Zitat-Zählerstand für heute (max. 3/Tag). */
export function zitatZaehlerHeute(
  meta: Record<string, unknown>,
  heute: string,
): number {
  if (meta.letzterZitatBonus !== heute) return 0;
  const gespeichert = meta.zitatBonusCount;
  const anzahl =
    typeof gespeichert === "number" && Number.isFinite(gespeichert)
      ? gespeichert
      : 0;
  return Math.max(anzahl, 1);
}

/**
 * Führt `arbeit` unter der Konto-Sperre mit frisch gelesenen Metadaten aus.
 * Schließt das TOCTOU-Fenster: Checks und Write sehen denselben Stand.
 */
export async function mitFrischemBenutzer<T>(
  req: Request,
  userId: string,
  arbeit: (frisch: BuchungsUser, meta: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  return mitBenutzerSperre(`punkte:${userId}`, async () => {
    const frisch = (await hexclaveServerApp.getUser({
      tokenStore: req,
      or: "return-null",
    })) as BuchungsUser | null;
    if (!frisch || frisch.id !== userId) {
      throw new PunkteFehler(401, "Nicht eingeloggt");
    }
    const meta = (frisch.clientReadOnlyMetadata ?? {}) as Record<
      string,
      unknown
    >;
    return arbeit(frisch, meta);
  });
}

export type BonusErgebnis = {
  punkte: number;
  punkteGesamt: number;
  delta: number;
  quoteRemaining: number;
};

/**
 * Gutschrift für Chat (unbegrenzt – jede Buchung kostet ein frisches
 * Captcha) oder Zitat (max. 3/Tag). Wirft PunkteFehler bei Quota-Verstößen.
 * Aufrufer: Gürkchen-Chat, Zitat-Route. Die Punkte-Route bucht direkt (sie
 * hat zusätzlich Daily/Einlösen-Flows).
 */
export async function bucheBonus(
  req: Request,
  userId: string,
  aktion: "chat" | "zitat",
): Promise<BonusErgebnis> {
  const delta = aktion === "chat" ? PUNKTE_CHAT : PUNKTE_ZITAT;
  return mitFrischemBenutzer(req, userId, async (frisch, meta) => {
    const heute = heuteISO();
    const zitatBisher = zitatZaehlerHeute(meta, heute);
    if (aktion === "zitat" && zitatBisher >= ZITAT_MAX_PRO_TAG) {
      throw new PunkteFehler(400, "Heute schon 3 Zitate generiert");
    }
    const stand = lesePunkte(meta);
    const newPoints = stand + delta;
    const newTotal = lesePunkteGesamt(meta, stand) + delta;
    const verlauf = leseVerlauf(meta).slice(-9);
    verlauf.push({
      datum: new Date().toISOString(),
      aktion,
      punkte: delta,
      saldo: newPoints,
    });
    const update: Record<string, unknown> = {
      punkte: newPoints,
      punkteGesamt: newTotal,
      punkteVerlauf: verlauf,
    };
    let quoteRemaining = ZITAT_MAX_PRO_TAG;
    if (aktion === "zitat") {
      update.letzterZitatBonus = heute;
      update.zitatBonusCount = zitatBisher + 1;
      quoteRemaining = Math.max(0, ZITAT_MAX_PRO_TAG - (zitatBisher + 1));
    }
    await frisch.setClientReadOnlyMetadata({ ...meta, ...update });
    return { punkte: newPoints, punkteGesamt: newTotal, delta, quoteRemaining };
  });
}
