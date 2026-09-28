/**
 * Gurken Roulette – europäisches Roulette (0–36) mit Spielgeld-Punkten.
 *
 * Anders als der erste Entwurf aus dem alten Casino-Projekt wird hier nichts
 * dem Client überlassen: Die Gewinnzahl zieht ausschließlich der Server, die
 * Auszahlung berechnet der Server, und jeder Einsatz wird gegen feste
 * Zahlenmengen geprüft. So kann niemand per manipuliertem Request eigene
 * 18er-Kombinationen mit 2×-Auszahlung erfinden.
 *
 * Der Kessel ist bewusst leicht gezinkt (siehe
 * ROULETTE_HAUS_STORNO_WAHRSCHEINLICHKEIT): Ein kleiner Teil der Treffer
 * wird serverseitig zu Nieten, damit der Hausvorteil bei ca. Slot-Niveau
 * liegt (~−6 % statt faire −2,7 %). Die angezeigten Quoten bleiben die
 * klassischen.
 *
 * Auszahlungen (inklusive zurückgezahltem Einsatz):
 * - Plein (einzelne Zahl): 36×
 * - Dutzend / Kolonne (12 Zahlen): 3×
 * - Einfache Chance (18 Zahlen): 2×
 */

/** Europäische Kessel-Reihenfolge (nur Optik – gezogen wird uniform 0–36). */
export const ROULETTE_RAD_REIHENFOLGE: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/** Rote Zahlen des europäischen Tisches. */
export const ROULETTE_ROT: number[] = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];

/** Schwarze Zahlen: alle 1–36, die nicht rot sind. */
export const ROULETTE_SCHWARZ: number[] = Array.from(
  { length: 36 },
  (_, i) => i + 1,
).filter((n) => !ROULETTE_ROT.includes(n));

/** Erlaubte Chipwerte – bewusst identisch zur Slotmaschine. */
export const ROULETTE_CHIPS = [10, 25, 50] as const;
export type RouletteChip = (typeof ROULETTE_CHIPS)[number];

export type RouletteEinsatzTyp = "straight" | "dozen" | "column" | "outside";

export type RouletteEinsatz = {
  type: RouletteEinsatzTyp;
  numbers: number[];
  amount: number;
  label: string;
};

/** Dutzende: 1–12, 13–24, 25–36 (der alte Entwurf hatte hier Spalten drin). */
export const ROULETTE_DUTZENDE: { label: string; numbers: number[] }[] = [
  {
    label: "1. Dutzend (1–12)",
    numbers: Array.from({ length: 12 }, (_, i) => i + 1),
  },
  {
    label: "2. Dutzend (13–24)",
    numbers: Array.from({ length: 12 }, (_, i) => i + 13),
  },
  {
    label: "3. Dutzend (25–36)",
    numbers: Array.from({ length: 12 }, (_, i) => i + 25),
  },
];

/** Kolonnen (2:1) in Tabellenreihenfolge. */
export const ROULETTE_KOLONNEN: { label: string; numbers: number[] }[] = [
  {
    label: "3er-Spalte",
    numbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  },
  {
    label: "2er-Spalte",
    numbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  },
  {
    label: "1er-Spalte",
    numbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  },
];

/** Einfache Chancen – korrigiert: 1–18 ist 1–18, Schwarz ist schwarz. */
export const ROULETTE_CHANCEN: { label: string; numbers: number[] }[] = [
  {
    label: "1–18",
    numbers: Array.from({ length: 18 }, (_, i) => i + 1),
  },
  { label: "Rot", numbers: [...ROULETTE_ROT] },
  {
    label: "Gerade",
    numbers: Array.from({ length: 18 }, (_, i) => (i + 1) * 2),
  },
  {
    label: "19–36",
    numbers: Array.from({ length: 18 }, (_, i) => i + 19),
  },
  {
    label: "Ungerade",
    numbers: Array.from({ length: 18 }, (_, i) => i * 2 + 1),
  },
  { label: "Schwarz", numbers: [...ROULETTE_SCHWARZ] },
];

/** Sicherheitsgrenzen pro Dreh: höchstens 15 Einsätze, höchstens 50 Punkte (Slot-Niveau). */
export const ROULETTE_MAX_EINSAETZE = 15;
export const ROULETTE_MAX_GESAMTEINSATZ = 50;

/**
 * Gezinkter Kessel: Anteil der Treffer, die serverseitig zu Nieten werden.
 * Fair wäre 0 (Hausvorteil −2,7 %). Mit 5 % liegt der Hausvorteil bei
 * ca. −7,6 % und damit ungefähr auf Slot-Niveau (ca. −6 %).
 */
export const ROULETTE_HAUS_STORNO_WAHRSCHEINLICHKEIT = 0.05;

function gleicheMenge(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortiert = [...a].sort((x, y) => x - y);
  const referenz = [...b].sort((x, y) => x - y);
  return sortiert.every((n, i) => n === referenz[i]);
}

/** Prüft, ob ein Chipwert aus der erlaubten Liste stammt. */
export function istGueltigerRouletteChip(
  value: unknown,
): value is RouletteChip {
  return (
    typeof value === "number" &&
    (ROULETTE_CHIPS as readonly number[]).includes(value)
  );
}

/** Serverseitige Ziehung: uniform 0–36. */
export function rouletteGewinnzahl(): number {
  return Math.floor(Math.random() * 37);
}

/**
 * Gesamtauszahlung inklusive aller zurückgezahlten Einsätze.
 * Nur Treffer zählen – alles andere ist verloren.
 */
export function rouletteAuszahlung(
  gewinnzahl: number,
  einsaetze: RouletteEinsatz[],
): number {
  let summe = 0;
  for (const einsatz of einsaetze) {
    if (!einsatz.numbers.includes(gewinnzahl)) continue;
    switch (einsatz.type) {
      case "straight":
        summe += einsatz.amount * 36;
        break;
      case "dozen":
      case "column":
        summe += einsatz.amount * 3;
        break;
      case "outside":
        summe += einsatz.amount * 2;
        break;
    }
  }
  return summe;
}

/**
 * Gezinkte Ziehung auf Slot-Niveau: erst fair ziehen, dann mit
 * ROULETTE_HAUS_STORNO_WAHRSCHEINLICHKEIT einen Treffer zu einer zufälligen
 * Niete umbiegen. Gibt es keine Niete (Vollabdeckung), bleibt es bei fair –
 * Vollabdeckung verliert ohnehin immer.
 */
export function rouletteGewinnzahlGezinkt(
  einsaetze: RouletteEinsatz[],
): number {
  const fair = rouletteGewinnzahl();
  if (rouletteAuszahlung(fair, einsaetze) <= 0) return fair;
  if (Math.random() >= ROULETTE_HAUS_STORNO_WAHRSCHEINLICHKEIT) return fair;
  const nieten: number[] = [];
  for (let n = 0; n < 37; n++) {
    if (rouletteAuszahlung(n, einsaetze) <= 0) nieten.push(n);
  }
  if (nieten.length === 0) return fair;
  return nieten[Math.floor(Math.random() * nieten.length)];
}

/**
 * Strenge Prüfung eines Einsatz-Arrays vom Client. Lehnt alles ab, was nicht
 * exakt einer erlaubten Zahlenmenge entspricht – inkl. Mengenbegrenzung.
 */
export function validiereRouletteEinsaetze(einsaetze: unknown):
  | { ok: true; einsaetze: RouletteEinsatz[]; gesamt: number }
  | { ok: false; error: string } {
  if (!Array.isArray(einsaetze) || einsaetze.length === 0) {
    return { ok: false, error: "Bitte platziere mindestens einen Einsatz." };
  }
  if (einsaetze.length > ROULETTE_MAX_EINSAETZE) {
    return {
      ok: false,
      error: `Höchstens ${ROULETTE_MAX_EINSAETZE} Einsätze pro Dreh.`,
    };
  }

  const geprüft: RouletteEinsatz[] = [];
  for (const roh of einsaetze) {
    if (typeof roh !== "object" || roh === null) {
      return { ok: false, error: "Ungültiger Einsatz." };
    }
    const { type, numbers, amount, label } = roh as Record<string, unknown>;
    if (!istGueltigerRouletteChip(amount)) {
      return { ok: false, error: "Ungültiger Chipwert." };
    }
    if (
      !Array.isArray(numbers) ||
      numbers.some((n) => typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 36)
    ) {
      return { ok: false, error: "Ungültige Zahlen im Einsatz." };
    }
    if (typeof label !== "string" || label.length === 0 || label.length > 48) {
      return { ok: false, error: "Ungültige Einsatz-Bezeichnung." };
    }

    if (type === "straight") {
      if (numbers.length !== 1) {
        return { ok: false, error: "Plein braucht genau eine Zahl." };
      }
    } else if (type === "dozen") {
      if (!ROULETTE_DUTZENDE.some((d) => gleicheMenge(d.numbers, numbers))) {
        return { ok: false, error: "Ungültiges Dutzend." };
      }
    } else if (type === "column") {
      if (!ROULETTE_KOLONNEN.some((k) => gleicheMenge(k.numbers, numbers))) {
        return { ok: false, error: "Ungültige Kolonne." };
      }
    } else if (type === "outside") {
      if (!ROULETTE_CHANCEN.some((c) => gleicheMenge(c.numbers, numbers))) {
        return { ok: false, error: "Ungültige einfache Chance." };
      }
    } else {
      return { ok: false, error: "Unbekannte Einsatzart." };
    }

    geprüft.push({
      type: type as RouletteEinsatzTyp,
      numbers: [...numbers],
      amount,
      label,
    });
  }

  const gesamt = geprüft.reduce((summe, e) => summe + e.amount, 0);
  if (gesamt > ROULETTE_MAX_GESAMTEINSATZ) {
    return {
      ok: false,
      error: `Höchstens ${ROULETTE_MAX_GESAMTEINSATZ} Punkte pro Dreh.`,
    };
  }
  return { ok: true, einsaetze: geprüft, gesamt };
}

/** Ob eine Zahl rot ist (für die Anzeige). */
export function istRoteZahl(n: number): boolean {
  return ROULETTE_ROT.includes(n);
}
