/**
 * Gurken Duell – Spieler-gegen-Spieler mit Punkte-Einsatz (Spielgeld).
 *
 * Reine Spiellogik + Typen, bewusst ohne Node-Imports: Diese Datei wird auch
 * in Client-Komponenten gebündelt (Konstanten, Validierung).
 *
 * Ablauf (Wartezimmer): Wer die Duell-Seite öffnet, nimmt mit Gurken-Avatar
 * und Namen im Wartezimmer Platz (Heartbeat-Präsenz). Per Klick auf eine
 * andere Gurke schickt man eine Herausforderung mit festem Einsatz; der
 * Einsatz wird dabei sofort vom eigenen Konto abgezogen. Nimmt die andere
 * Seite an, zieht sie ihren Einsatz per eigenem Request ab und das Spiel
 * startet. Wer gewinnt, holt den ganzen Pot ab, bei Unentschieden bekommt
 * jeder seinen Einsatz zurück.
 *
 * Regeln:
 * - Beide Spieler setzen denselben Einsatz, der Pot (2× Einsatz) liegt in
 *   der Session. Wer gewinnt, holt den ganzen Pot ab, bei Unentschieden
 *   bekommt jeder seinen Einsatz zurück.
 * - Tic Tac Toe: Der Herausforderer ist 🥒 (X) und beginnt, die annehmende
 *   Seite ist 🫙 (O). Drei in einer Reihe gewinnt, volles Brett ohne Reihe
 *   ist unentschieden.
 * - Punkte werden nie vom Server auf fremde Konten gebucht: Jeder zieht
 *   seinen Einsatz per eigenem Request ab und holt Gewinn/Refund per eigenem
 *   Claim-Request ab. Deshalb braucht ein beendetes Duell immer einen Claim
 *   des Berechtigten – und eine abgelehnte Challenge einen Refund-Claim des
 *   Herausforderers.
 */

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
  avatar: DuellAvatar;
};

export type DuellSession = {
  id: string;
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

/** Eindeutige Session-ID (Web Crypto – läuft im Browser wie auf Node). */
export function generiereDuellId(): string {
  return globalThis.crypto.randomUUID();
}

/** Kürzt Wunschnamen auf Anzeigeformat (max. 24 Zeichen). */
export function saubererDuellName(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().slice(0, 24);
  }
  return fallback.slice(0, 24);
}

/* ── Gurken-Avatar (Wartezimmer-Umkleide, Kahoot-Prinzip) ── */

export type DuellAvatar = { basis: number; accessoire: number };

/** Vier Gurken-Basen: dasselbe Emoji, per CSS-Filter getönt (Client rendert). */
export const DUELL_GURKEN_BASEN = [
  { emoji: "🥒", filter: "none", label: "Salatgurke" },
  { emoji: "🥒", filter: "saturate(1.5)", label: "Gewächshausgurke" },
  { emoji: "🥒", filter: "hue-rotate(35deg) saturate(1.2)", label: "Senfgurke" },
  {
    emoji: "🥒",
    filter: "saturate(0.35) brightness(1.15)",
    label: "Bleiche Gurke",
  },
] as const;

/** Aufsetzbares: schlichtes Emoji-Overlay über der Gurke (Client rendert). */
export const DUELL_ACCESSOIRES = [
  { emoji: null, label: "Natur" },
  { emoji: "🕶️", label: "Sonnenbrille" },
  { emoji: "🎩", label: "Zylinder" },
  { emoji: "🩹", label: "Pflaster" },
  { emoji: "🩺", label: "Stethoskop" },
  { emoji: "👑", label: "Krone" },
] as const;

export const STANDARD_AVATAR: DuellAvatar = { basis: 0, accessoire: 0 };

/** Klammert Avatar-Indizes auf gültige Katalogwerte (Fallback: Standard). */
export function saubererDuellAvatar(value: unknown): DuellAvatar {
  if (typeof value !== "object" || value === null) return STANDARD_AVATAR;
  const { basis, accessoire } = value as Record<string, unknown>;
  const b =
    typeof basis === "number" && Number.isInteger(basis)
      ? Math.min(Math.max(basis, 0), DUELL_GURKEN_BASEN.length - 1)
      : 0;
  const a =
    typeof accessoire === "number" && Number.isInteger(accessoire)
      ? Math.min(Math.max(accessoire, 0), DUELL_ACCESSOIRES.length - 1)
      : 0;
  return { basis: b, accessoire: a };
}

/* ── Wartezimmer-Präsenz (Heartbeat) ── */

/** Wie lange ein Gast ohne Heartbeat als anwesend gilt. */
export const DUELL_PRAESENZ_TTL_MS = 45_000;

export type WartezimmerGast = {
  userId: string;
  name: string;
  avatar: DuellAvatar;
  /** Wunscheinsatz des Gasts (reine Anzeige im Wartezimmer). */
  stake: number;
  aktualisiertAm: number;
};

/** Client-sichere Gäste-Ansicht (eigener Eintrag ist markiert). */
export type OeffentlicherGast = {
  userId: string;
  name: string;
  avatar: DuellAvatar;
  stake: number;
  ich: boolean;
};

/* ── Herausforderung (Challenge mit Annehmen/Ablehnen) ── */

export type DuellChallengeStatus =
  | "offen"
  | "angenommen"
  | "abgelehnt"
  | "abgelaufen"
  | "storniert";

/** Wie lange eine Herausforderung zur Annahme offen bleibt. */
export const DUELL_CHALLENGE_TIMEOUT_MS = 90_000;
/** Aufbewahrung einer Challenge (danach ist ein nicht abgeholter Einsatz weg). */
export const DUELL_CHALLENGE_SPEICHER_TTL_S = 3600;

export type DuellChallenge = {
  id: string;
  von: { userId: string; name: string; avatar: DuellAvatar };
  an: { userId: string; name: string };
  stake: number;
  status: DuellChallengeStatus;
  /** Session-ID nach Annahme, sonst null. */
  sessionId: string | null;
  erstelltAm: number;
  aktualisiertAm: number;
  /** User-IDs, die ihren Challenge-Einsatz bereits zurückerhalten haben. */
  erstattetAn: string[];
};

export type OeffentlicheChallenge = {
  id: string;
  stake: number;
  pot: number;
  status: DuellChallengeStatus;
  erstelltAm: number;
  von: { name: string; avatar: DuellAvatar };
  anName: string;
  ichBinHerausforderer: boolean;
  sessionId: string | null;
  /** Ob der Aufrufer seinen Challenge-Einsatz zurückholen kann. */
  kannClaimen: boolean;
  bereitsAbgeholt: boolean;
};

/**
 * Lässt Annahme-Timeouts in den Status `abgelaufen` kippen. Gibt true
 * zurück, wenn sich die Challenge verändert hat (Aufrufer muss speichern).
 */
export function wendeChallengeAblaufAn(
  challenge: DuellChallenge,
  jetzt: number = Date.now(),
): boolean {
  if (
    challenge.status === "offen" &&
    jetzt - challenge.erstelltAm > DUELL_CHALLENGE_TIMEOUT_MS
  ) {
    challenge.status = "abgelaufen";
    challenge.aktualisiertAm = jetzt;
    return true;
  }
  return false;
}

/**
 * Was der Herausforderer zurückholen darf: seinen Einsatz, wenn die
 * Challenge abgelehnt wurde, ablief oder storniert wurde. Null sonst.
 * (Angenommene Challenges wandern als Pot in die Session – dort gilt der
 * normale Session-Claim.)
 */
export function challengeAnspruch(
  challenge: DuellChallenge,
  userId: string,
): { art: "refund"; betrag: number } | null {
  if (challenge.von.userId !== userId) return null;
  if (
    challenge.status !== "abgelehnt" &&
    challenge.status !== "abgelaufen" &&
    challenge.status !== "storniert"
  ) {
    return null;
  }
  return challenge.erstattetAn.includes(userId)
    ? null
    : { art: "refund", betrag: challenge.stake };
}

export function oeffentlicheChallenge(
  challenge: DuellChallenge,
  aufruferId: string,
): OeffentlicheChallenge {
  return {
    id: challenge.id,
    stake: challenge.stake,
    pot: challenge.stake * 2,
    status: challenge.status,
    erstelltAm: challenge.erstelltAm,
    von: { name: challenge.von.name, avatar: challenge.von.avatar },
    anName: challenge.an.name,
    ichBinHerausforderer: challenge.von.userId === aufruferId,
    sessionId: challenge.sessionId,
    kannClaimen: challengeAnspruch(challenge, aufruferId) !== null,
    bereitsAbgeholt: challenge.erstattetAn.includes(aufruferId),
  };
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
  stake: number;
  pot: number;
  status: DuellStatus;
  spieler: {
    name: string;
    symbol: DuellSymbol;
    ich: boolean;
    avatar: DuellAvatar;
  }[];
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
    stake: session.stake,
    pot: session.pot,
    status: session.status,
    spieler: session.spieler.map((s) => ({
      name: s.name,
      symbol: s.symbol,
      ich: s.userId === aufruferId,
      avatar: s.avatar ?? STANDARD_AVATAR,
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
