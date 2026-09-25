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
