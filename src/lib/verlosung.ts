/**
 * Monatliche Gurken-Verlosung: reine Logik + Typen (ohne Node-Imports, damit
 * sie überall nutzbar bleibt). Persistenz liegt bewusst NICHT in Hexclave,
 * sondern in Upstash Redis (siehe `verlosungStore.ts`) – Hexclave bleibt für
 * Kontodaten, die Verlosung ist globaler Zustand (ein Topf pro Monat).
 *
 * Ablauf: Jeder abgeholte Daily-Tag gibt exakt 1 Los (eigener Monats-Zähler
 * in Upstash, `+1` pro Daily-Claim). Der Hexclave-Verlauf dient nur als
 * Rückfall für Claims von vor dem Zähler. Nach Monatsende zieht die erste
 * Status-Anfrage deterministisch (Hash über Monat) – das Ergebnis wird in
 * Redis festgeschrieben, danach ist es stabil. Der Gewinner sieht beim
 * nächsten Besuch ein Popup und wählt: echte Gurke (gratis, Adress-Flow wie
 * beim 1.000-Punkte-Einlösen) oder stattdessen +1.000 Punkte.
 */

export const VERLOSUNG_PUNKTE_ALTERNATIVE = 1000;
export const VERLOSUNG_KEY_PREFIX = "gurken:verlosung:";
/** Lose-Zähler pro Monat+Konto (exakter Monats-Wert statt Verlaufs-Deckels). */
export const VERLOSUNG_LOSE_PREFIX = "gurken:verlosung-lose:";
/** Wie viele zurückliegende Monate das Popup/Claim berücksichtigt. */
export const VERLOSUNG_MONATE_RUECKBLICK = 3;

export type VerlosungStatus = "offen" | "eingeloest";
export type VerlosungArt = "gurke" | "punkte";

export type VerlosungRecord = {
  monat: string;
  gewinnerId: string | null;
  gewinnerAnzeige: string | null;
  /** Lose des Gewinners (0 ohne Gewinner). */
  lose: number;
  gesamtLose: number;
  teilnehmer: number;
  gezogenAm: string;
  status: VerlosungStatus;
  art: VerlosungArt | null;
  eingeloestAm: string | null;
};

/** Abgeschlossener Verlosungsmonat (UTC, YYYY-MM): der Vormonat. */
export function verlosungsMonat(datum: Date = new Date()): string {
  const d = new Date(
    Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth() - 1, 1),
  );
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Die letzten N abgeschlossenen Monate, neueste zuerst (UTC). */
export function verlosungsMonate(
  rueckblick: number = VERLOSUNG_MONATE_RUECKBLICK,
  datum: Date = new Date(),
): string[] {
  const monate: string[] = [];
  for (let i = 1; i <= rueckblick; i++) {
    const d = new Date(
      Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth() - i, 1),
    );
    monate.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return monate;
}

/** Monatsname für Anzeige ("Oktober 2026"). */
export function verlosungsMonatName(monat: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monat);
  if (!m) return monat;
  const name = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, 1),
  ).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Lose-Rückfall für Claims von vor dem Zähler: gezählte Daily-Buchungen im
 * Verlauf (gedeckelt auf die letzten 10 Einträge) – mindestens 1, wenn der
 * letzte Daily in den Monat fällt. Sonst 0.
 */
export function ticketsFuerMonat(
  meta: Record<string, unknown>,
  monat: string,
): number {
  const praefix = `${monat}-`;
  const letzter =
    typeof meta.letzterDailyBonus === "string" ? meta.letzterDailyBonus : null;
  const imMonat = letzter !== null && letzter.startsWith(praefix);
  let gezaehlt = 0;
  const verlauf = meta.punkteVerlauf;
  if (Array.isArray(verlauf)) {
    for (const e of verlauf) {
      if (typeof e !== "object" || e === null) continue;
      const eintrag = e as Record<string, unknown>;
      if (
        eintrag.aktion === "daily" &&
        typeof eintrag.datum === "string" &&
        eintrag.datum.startsWith(praefix)
      ) {
        gezaehlt += 1;
      }
    }
  }
  if (!imMonat && gezaehlt === 0) return 0;
  return Math.max(1, gezaehlt);
}

/** FNV-1a über String (32 Bit) – deterministische Ziehung ohne Zufalls-API. */
export function hashStr(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type LosKandidat = { id: string; tickets: number };

/**
 * Deterministische Ziehung: Kandidaten nach ID sortieren (reihenfolgefest),
 * Losnummer = Hash(Monat) mod Gesamtlose, dann Gewichte ablaufen.
 * Gibt den Gewinner-Index zurück (-1 ohne Lose).
 */
export function zieheGewinnerIndex(
  kandidaten: LosKandidat[],
  monat: string,
): number {
  const sortiert = [...kandidaten].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const gesamt = sortiert.reduce((s, k) => s + k.tickets, 0);
  if (gesamt <= 0) return -1;
  let los = hashStr(`${monat}:gurken-verlosung`) % gesamt;
  for (let i = 0; i < sortiert.length; i++) {
    los -= sortiert[i].tickets;
    if (los < 0) return kandidaten.indexOf(sortiert[i]);
  }
  return kandidaten.indexOf(sortiert[sortiert.length - 1]);
}

/** Anzeigename wie in der Rangliste: Benutzername oder 2 Buchstaben. */
export function verlosungsAnzeige(
  displayName: unknown,
  benutzername: string | null,
): string {
  if (benutzername) return `@${benutzername}`;
  const name = typeof displayName === "string" ? displayName.trim() : "";
  return name.slice(0, 2) || "Anonymes Gurkenkind";
}
