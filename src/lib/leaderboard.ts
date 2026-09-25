/**
 * Gemeinsame Typen und Sortierregeln der Gurken-Rangliste.
 *
 * Gerechnet wird ausschließlich mit den normalen Punkten (Guthaben) – es gibt
 * kein XP. Wer seine echte Gurke einlöst (-1000), verliert entsprechend Punkte
 * und kann dadurch auch rutschen.
 */
export type LeaderboardEintrag = {
  id: string;
  name: string;
  /** Aktuelles Punkte-Guthaben – Basis des Rankings. */
  punkte: number;
  /** Mitgliedschaft beginnend (ms seit Epoch) – dient als Gleichspiel-Regel. */
  seit: number | null;
};

export type LeaderboardDaten = {
  eintraege: LeaderboardEintrag[];
  gesamt: number;
  du: { rang: number; eintrag: LeaderboardEintrag } | null;
};

/** Sortiert absteigend: erst Punkte, dann älteres Mitglied zuerst. */
export function vergleicheEintraege(
  a: LeaderboardEintrag,
  b: LeaderboardEintrag,
): number {
  if (b.punkte !== a.punkte) return b.punkte - a.punkte;
  const aSeit = a.seit ?? Number.MAX_SAFE_INTEGER;
  const bSeit = b.seit ?? Number.MAX_SAFE_INTEGER;
  return aSeit - bSeit;
}

/**
 * Rangzeichen der Gurken-Sekte: Wer genug Punkte hat, bekommt einen
 * prestigeträchtigeren Titel. Schwellen liegen auf der normalen Punkteskala
 * (1000 = eine echte Gurke einlösbar).
 */
export const RANG_TITEL: { ab: number; titel: string }[] = [
  { ab: 0, titel: "Nano Gurke" },
  { ab: 250, titel: "Mini Gurke" },
  { ab: 500, titel: "Gurke" },
  { ab: 1000, titel: "Große Gurke" },
  { ab: 2500, titel: "Super große Gurke" },
  { ab: 5000, titel: "Riesen Gurke" },
  { ab: 10000, titel: "Extremst riesige Gurke" },
];

/** Höchste Stufe, die man mit diesen Punkten erreicht hat. */
export function rangTitelFuer(punkte: number): string {
  let titel = RANG_TITEL[0].titel;
  for (const stufe of RANG_TITEL) {
    if (punkte >= stufe.ab) titel = stufe.titel;
  }
  return titel;
}

/** 1-basierte Position, die der Eintrag in der sortierten Liste hätte. */
export function positionFuer(
  eintraege: LeaderboardEintrag[],
  eintrag: LeaderboardEintrag,
): number {
  return (
    eintraege.filter((e) => e.id !== eintrag.id && vergleicheEintraege(e, eintrag) < 0)
      .length + 1
  );
}
