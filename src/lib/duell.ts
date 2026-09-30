/**
 * Gurken Duell – Spieler-gegen-Spieler mit Punkte-Einsatz (Spielgeld).
 *
 * Reine Spiellogik + Typen, bewusst ohne Node-Imports: Diese Datei wird auch
 * in Client-Komponenten gebündelt (Konstanten, Validierung).
 *
 * Regeln:
 * - Beide Spieler setzen denselben Einsatz, der Pot (2× Einsatz) liegt in
 *   der Session. Wer gewinnt, holt den ganzen Pot ab, bei Unentschieden
 *   bekommt jeder seinen Einsatz zurück.
 * - Tic Tac Toe: Der Ersteller ist 🥒 (X) und beginnt, der Beitretende ist
 *   🫙 (O). Drei in einer Reihe gewinnt, volles Brett ohne Reihe ist
 *   unentschieden.
 * - Punkte werden nie vom Server auf fremde Konten gebucht: Jeder zieht
 *   seinen Einsatz per eigenem Request ab und holt Gewinn/Refund per eigenem
 *   Claim-Request ab. Deshalb gibt es keinen automatischen Payout.
 */

import { zufallsInt } from "@/lib/zufall";

/** Erlaubte Einsätze pro Spieler – bewusst identisch zum Casino. */
export const DUELL_EINSAETZE = [10, 25, 50] as const;
export type DuellEinsatz = (typeof DUELL_EINSAETZE)[number];

/** Prüft, ob ein Einsatzwert aus der erlaubten Liste stammt. */
export function istGueltigerDuellEinsatz(value: unknown): value is DuellEinsatz {
  return (
    typeof value === "number" &&
    (DUELL_EINSAETZE as readonly number[]).includes(value)
  );
}

export type DuellSymbol = "X" | "O";
export type DuellZelle = DuellSymbol | null;

export type DuellStatus =
  | "waiting"
  | "playing"
  | "finished"
  | "cancelled"
  | "expired";

export type DuellSpieler = {
  userId: string;
  name: string;
  symbol: DuellSymbol;
};

export type DuellSession = {
  id: string;
  /** 6-stelliger Einladungs-Code zum Teilen. */
  code: string;
  /** Einsatz pro Spieler – der Pot ist immer 2× Einsatz. */
  stake: number;
  pot: number;
  status: DuellStatus;
  spieler: DuellSpieler[];
  board: DuellZelle[];
  amZug: DuellSymbol;
  gewinner: DuellSymbol | "draw" | null;
  gewinnLinie: number[] | null;
  /** Index des zuletzt gesetzten Steins (Last-Move-Markierung im Client). */
  letzterZug: number | null;
  erstelltAm: number;
  aktualisiertAm: number;
  /** User-ID des Spielers, der den Pot bereits abgeholt hat. */
  ausgezahltAn: string | null;
  /** User-IDs, die ihren Einsatz bereits zurückerhalten haben. */
  erstattetAn: string[];
};

/** Wie lange ein offenes Duell auf einen Gegner wartet (dann verfällt es). */
export const DUELL_WARTE_TIMEOUT_MS = 10 * 60 * 1000;
/** Inaktivität im laufenden Spiel, ab der der wartende Spieler per Timeout siegt. */
export const DUELL_ZUG_TIMEOUT_MS = 5 * 60 * 1000;
/** Aufbewahrung einer Session im Store (danach ist nicht abgeholtes Guthaben weg). */
export const DUELL_SPEICHER_TTL_S = 7 * 24 * 60 * 60;

/** Alle acht Gewinnlinien auf dem 3×3-Brett. */
export const DUELL_GEWINN_LINIEN: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Prüft das Brett auf drei in einer Reihe. */
export function pruefeTicTacToe(board: DuellZelle[]): {
  gewinner: DuellSymbol;
  linie: number[];
} | null {
  for (const linie of DUELL_GEWINN_LINIEN) {
    const [a, b, c] = linie;
    const wert = board[a];
    if (wert && wert === board[b] && wert === board[c]) {
      return { gewinner: wert, linie };
    }
  }
  return null;
}

/** Ob kein leeres Feld mehr übrig ist. */
export function istBrettVoll(board: DuellZelle[]): boolean {
  return board.every((zelle) => zelle !== null);
}

/** Leeres Startbrett. */
export function leeresBrett(): DuellZelle[] {
  return Array.from({ length: 9 }, () => null);
}

const CODE_ZEICHEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 6-stelliger Einladungs-Code (ohne leicht verwechselbare Zeichen). */
export function generiereDuellCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ZEICHEN[zufallsInt(CODE_ZEICHEN.length)];
  }
  return code;
}

/** Eindeutige Session-ID (Web Crypto – läuft im Browser wie auf Node). */
export function generiereDuellId(): string {
  return globalThis.crypto.randomUUID();
}

/** Normalisiert einen eingegebenen Code (Großbuchstaben, ohne Leerzeichen). */
export function normalisiereDuellCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

/** Kürzt Wunschnamen auf Anzeigeformat (max. 24 Zeichen). */
export function saubererDuellName(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().slice(0, 24);
  }
  return fallback.slice(0, 24);
}

/**
 * Lässt Warte-Timeouts in den Status `expired` kippen. Gibt true zurück,
 * wenn sich die Session verändert hat (Aufrufer muss dann speichern).
 * Laufende Spiele verfallen nie automatisch – dort siegt der wartende
 * Spieler per Timeout-Claim (siehe Route), damit Aufgabe nicht belohnt wird.
 */
export function wendeDuellAblaufAn(
  session: DuellSession,
  jetzt: number = Date.now(),
): boolean {
  if (
    session.status === "waiting" &&
    jetzt - session.erstelltAm > DUELL_WARTE_TIMEOUT_MS
  ) {
    session.status = "expired";
    session.aktualisiertAm = jetzt;
    return true;
  }
  return false;
}

/** Ob der Gegner gerade per Timeout besiegt werden darf. */
export function istZugTimeout(
  session: DuellSession,
  jetzt: number = Date.now(),
): boolean {
  return (
    session.status === "playing" &&
    jetzt - session.aktualisiertAm > DUELL_ZUG_TIMEOUT_MS
  );
}

/** Client-sichere Ansicht einer Session (ohne fremde User-IDs). */
export type OeffentlichesDuell = {
  id: string;
  code: string;
  stake: number;
  pot: number;
  status: DuellStatus;
  spieler: { name: string; symbol: DuellSymbol; ich: boolean }[];
  board: DuellZelle[];
  amZug: DuellSymbol;
  gewinner: DuellSymbol | "draw" | null;
  gewinnLinie: number[] | null;
  /** Index des zuletzt gesetzten Steins (Last-Move-Markierung im Client). */
  letzterZug: number | null;
  erstelltAm: number;
  aktualisiertAm: number;
  meinSymbol: DuellSymbol | null;
  /** Der Gegner ist so lange inaktiv, dass der Timeout-Sieg möglich ist. */
  zugTimeout: boolean;
  /** Ob der Aufrufer seinen Anteil (Pot oder Refund) schon abgeholt hat. */
  bereitsAbgeholt: boolean;
  /** Ob der Pot schon an den Sieger ausgezahlt wurde. */
  potAbgeholt: boolean;
  /** Ob der Aufrufer gerade etwas abholen kann (Pot oder Einsatz-Refund). */
  kannClaimen: boolean;
};

/**
 * Was der Aufrufer abholen darf: den vollen Pot (Sieg) oder seinen Einsatz
 * zurück (Unentschieden, Storno, Ablauf). Null, wenn nichts offen ist.
 */
export function claimAnspruch(
  session: DuellSession,
  userId: string,
): { art: "pot"; betrag: number } | { art: "refund"; betrag: number } | null {
  const ich = session.spieler.find((s) => s.userId === userId);
  if (!ich) return null;
  if (session.status === "finished") {
    if (session.gewinner === "draw") {
      return session.erstattetAn.includes(userId)
        ? null
        : { art: "refund", betrag: session.stake };
    }
    if (session.gewinner === ich.symbol) {
      return session.ausgezahltAn ? null : { art: "pot", betrag: session.pot };
    }
    return null;
  }
  if (session.status === "cancelled" || session.status === "expired") {
    if (session.ausgezahltAn) return null;
    return session.erstattetAn.includes(userId)
      ? null
      : { art: "refund", betrag: session.stake };
  }
  return null;
}

export function oeffentlichesDuell(
  session: DuellSession,
  aufruferId: string,
  jetzt: number = Date.now(),
): OeffentlichesDuell {
  const ich = session.spieler.find((s) => s.userId === aufruferId);
  return {
    id: session.id,
    code: session.code,
    stake: session.stake,
    pot: session.pot,
    status: session.status,
    spieler: session.spieler.map((s) => ({
      name: s.name,
      symbol: s.symbol,
      ich: s.userId === aufruferId,
    })),
    board: [...session.board],
    amZug: session.amZug,
    gewinner: session.gewinner,
    gewinnLinie: session.gewinnLinie ? [...session.gewinnLinie] : null,
    letzterZug: session.letzterZug,
    erstelltAm: session.erstelltAm,
    aktualisiertAm: session.aktualisiertAm,
    meinSymbol: ich?.symbol ?? null,
    zugTimeout:
      session.status === "playing" &&
      !!ich &&
      ich.symbol !== session.amZug &&
      istZugTimeout(session, jetzt),
    bereitsAbgeholt:
      session.ausgezahltAn === aufruferId ||
      session.erstattetAn.includes(aufruferId),
    potAbgeholt: session.ausgezahltAn !== null,
    kannClaimen: claimAnspruch(session, aufruferId) !== null,
  };
}
