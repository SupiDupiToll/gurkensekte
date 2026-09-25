/**
 * Gurken Casino – reines Spielgeld mit Punkten, kein echtes Geld.
 *
 * Der Wurf passiert ausschließlich serverseitig (die Clients bekommen nur
 * das Ergebnis), der höchste Multiplikator beträgt 3×, der schlechteste −1×.
 * Verluste ziehen das Guthaben, erhöhen aber nie die nie fallenden XP.
 *
 * Die Chancen sind Spieler-freundlich gestimmt: rund 30 % der Drehungen
 * gewinnen (vorher 20 %), nur noch rund 45 % verlieren – bei einem mäßigen
 * Hausvorteil von ca. −7,5 %, damit sich Punkte nicht am Automaten farmen lassen.
 */

/** Erlaubte Einsätze in Punkten. */
export const CASINO_EINSAETZE = [10, 25, 50] as const;
export type CasinoEinsatz = (typeof CASINO_EINSAETZE)[number];

export type CasinoFaktor = {
  /** Multiplikator auf den Einsatz: maximal 3, minimal −1. */
  faktor: number;
  /** Ziehgewicht in Prozent – summiert sich auf 100. */
  gewicht: number;
  /** Die drei Walzen, die dieses Ergebnis anzeigt. */
  symbole: [string, string, string];
  label: string;
};

export const CASINO_FAKTOREN: CasinoFaktor[] = [
  { faktor: 3, gewicht: 4, symbole: ["🥒", "🥒", "✨"], label: "Heiliger Volltreffer – 3×!" },
  { faktor: 2, gewicht: 8, symbole: ["🥒", "🥒", "🥒"], label: "Dreifach-Gurke – 2×!" },
  { faktor: 1, gewicht: 18, symbole: ["🥒", "🥒", "🫙"], label: "Sauber eingefallen – 1×!" },
  { faktor: 0, gewicht: 25, symbole: ["🫙", "🫙", "🫙"], label: "Ins Glas gefallen – nichts passiert" },
  { faktor: -0.5, gewicht: 23, symbole: ["💧", "🫙", "💧"], label: "Halb eingelegt – 0,5× minus" },
  { faktor: -1, gewicht: 22, symbole: ["🫠", "💥", "🫠"], label: "Zerschellt – 1× minus" },
];

/** Prüft, ob ein Einsatzwert aus der erlaubten Liste stammt. */
export function istGueltigerEinsatz(value: unknown): value is CasinoEinsatz {
  return (
    typeof value === "number" &&
    (CASINO_EINSAETZE as readonly number[]).includes(value)
  );
}

/** Serverseitiger Wurf: zieht nach Gewicht einen der fünf Faktoren. */
export function casinoWurf(): CasinoFaktor {
  const gesamt = CASINO_FAKTOREN.reduce((summe, f) => summe + f.gewicht, 0);
  let zufall = Math.random() * gesamt;
  for (const f of CASINO_FAKTOREN) {
    zufall -= f.gewicht;
    if (zufall < 0) return f;
  }
  return CASINO_FAKTOREN[CASINO_FAKTOREN.length - 1];
}

/** Punkte-Gewinn oder -Verlust: Einsatz × Faktor, gerundet. */
export function casinoDelta(einsatz: number, faktor: number): number {
  return Math.round(einsatz * faktor);
}
