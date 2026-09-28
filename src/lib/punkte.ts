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
