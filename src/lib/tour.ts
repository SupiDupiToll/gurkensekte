/**
 * Einführungs-Tour („Setup"): Schritt-Status in Hexclave
 * `clientReadOnlyMetadata` (nur serverseitig schreibbar, wie Punkte &
 * Benutzername). Felder: `tourAbgeschlossen`, `tourSchritt`, `tourAbgebrochen`.
 */

export const TOUR_SCHRITTE = [
  "gurke",
  "chat",
  "punkte",
  "casino",
  "mail",
  "fertig",
] as const;

export type TourSchritt = (typeof TOUR_SCHRITTE)[number];

export type TourStatus = {
  abgeschlossen: boolean;
  schritt: TourSchritt;
  abgebrochen: boolean;
};

const FALLBACK: TourStatus = {
  abgeschlossen: false,
  schritt: "gurke",
  abgebrochen: false,
};

function istGueltigerSchritt(schritt: unknown): schritt is TourSchritt {
  return (
    typeof schritt === "string" &&
    (TOUR_SCHRITTE as readonly string[]).includes(schritt)
  );
}

/** Guarded Read (korrupte Werte → Defaults, nie crashen). */
export function leseTourStatus(
  meta: Record<string, unknown>,
): TourStatus {
  const abgeschlossen = meta.tourAbgeschlossen === true;
  const abgebrochen = meta.tourAbgebrochen === true;
  const schrittRaw = meta.tourSchritt;
  return {
    abgeschlossen,
    abgebrochen,
    schritt: istGueltigerSchritt(schrittRaw) ? schrittRaw : FALLBACK.schritt,
  };
}

/** Validiert einen Schritt aus einem API-Body (null = ungültig). */
export function normalisiereTourSchritt(eingabe: unknown): TourSchritt | null {
  return istGueltigerSchritt(eingabe) ? eingabe : null;
}

/**
 * Überspringbar, wenn das Konto älter als 24 h ist und die Tour noch nicht
 * abgeschlossen wurde (Altbestand / Abgebrochene werden nicht gezwungen).
 */
export function istTourUeberspringbar(
  signedUpAt: string | Date | null | undefined,
  jetztMs = Date.now(),
): boolean {
  if (!signedUpAt) return true;
  const zeit = new Date(signedUpAt).getTime();
  if (!Number.isFinite(zeit)) return true;
  return jetztMs - zeit > 24 * 60 * 60 * 1000;
}
