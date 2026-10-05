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
/** Täglicher Bonus: Basis pro Tag, Meilenstein alle 7 Tage in Folge. */
export const STREAK_BONUS_BASIS = 20;
export const STREAK_BONUS_MEILENSTEIN = 50;
export const STREAK_MEILENSTEIN_ABSTAND = 7;
/** Comeback-Segen: Wer so viele Tage pausiert hat, kriegt einmalig extra. */
export const COMEBACK_PAUSE_TAGE = 7;
export const COMEBACK_BONUS = 50;
/** Wochenbonus: alle 7 Wochentage (Mo–So) abgeholt → extra. */
export const WOCHENBONUS_PUNKTE = 100;
/** Verzeih-Tag: so viele verpasste Tage pro Kalenderwoche überbrückt der Freeze. */
export const STREAK_FREEZE_MAX_LUECKE_TAGE = 2;
/** Max. gespeicherte eigene Zitate im Sammelalbum ("Mein Glas"). */
export const ZITAT_SAMMLUNG_MAX = 10;
export const ZITAT_SAMMLUNG_TEXT_MAX = 140;
/** Max. Zitat-Boni pro Konto und Tag. */
export const ZITAT_MAX_PRO_TAG = 3;
/**
 * GurkenMail-Boni: 10 pro versendeter Mail, 5 pro empfangener Mail –
 * gedeckelt auf insgesamt 10 Punkte pro Stunde (Rolling-Window).
 */
export const PUNKTE_GURKENMAIL_SENDEN = 10;
export const PUNKTE_GURKENMAIL_EMPFANGEN = 5;
export const PUNKTE_GURKENMAIL_MAX_PRO_STUNDE = 10;
export const GURKENMAIL_PUNKTE_FENSTER_MS = 60 * 60 * 1000;
/** Max. gespeicherte Mail-IDs für die Einmal-Gutschrift empfangener Mails. */
export const GURKENMAIL_AWARDED_IDS_MAX = 200;

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

/** Vortag zu einem Tagesdatum (UTC, YYYY-MM-DD) – ungültig → "". */
export function gesternISO(heute: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(heute);
  if (!m) return "";
  const zeit = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(zeit)) return "";
  return new Date(zeit - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

/** Guarded Read: aktuelle Streak (aufeinanderfolgende Daily-Tage). */
export function leseStreakTage(meta: Record<string, unknown>): number {
  const wert = meta.streakTage;
  return typeof wert === "number" && Number.isFinite(wert) && wert > 0
    ? Math.floor(wert)
    : 0;
}

/** Guarded Read: längste je erreichte Streak (Rekord, fällt nie). */
export function leseStreakBest(meta: Record<string, unknown>): number {
  const wert = meta.streakBest;
  return typeof wert === "number" && Number.isFinite(wert) && wert > 0
    ? Math.floor(wert)
    : 0;
}

/** Bonus für den n-ten Streak-Tag: alle 7 Tage Meilenstein, sonst Basis. */
export function streakBonusFuer(streakNeu: number): number {
  return streakNeu > 0 && streakNeu % STREAK_MEILENSTEIN_ABSTAND === 0
    ? STREAK_BONUS_MEILENSTEIN
    : STREAK_BONUS_BASIS;
}

/**
 * Streak-Fortschreibung für den Daily-Claim:
 * - gestern abgeholt → +1,
 * - genau 1 Tag Lücke + Freeze frei → +1 (Verzeih-Tag, 1× pro Kalenderwoche),
 * - sonst Neustart bei 1.
 * Heute schon abgeholt → Bonus 0 (Vorab-Check schlägt an).
 */
export type StreakErgebnis = {
  streakNeu: number;
  bestNeu: number;
  bonus: number;
  freezeVerbraucht: boolean;
};

export function berechneStreakUpdate(
  meta: Record<string, unknown>,
  heute: string,
): StreakErgebnis {
  const letzter =
    typeof meta.letzterDailyBonus === "string" ? meta.letzterDailyBonus : null;
  if (letzter === heute) {
    const aktuell = leseStreakTage(meta);
    return {
      streakNeu: aktuell,
      bestNeu: leseStreakBest(meta),
      bonus: 0,
      freezeVerbraucht: false,
    };
  }
  const aktuell = leseStreakTage(meta);
  const luecke = tageSeit(letzter, heute);
  let streakNeu = 1;
  let freezeVerbraucht = false;
  if (letzter !== null && luecke === 1 && aktuell > 0) {
    streakNeu = aktuell + 1;
  } else if (
    letzter !== null &&
    luecke === STREAK_FREEZE_MAX_LUECKE_TAGE &&
    aktuell > 0 &&
    istFreezeVerfuegbar(meta, heute)
  ) {
    streakNeu = aktuell + 1;
    freezeVerbraucht = true;
  }
  const bestNeu = Math.max(leseStreakBest(meta), streakNeu);
  return { streakNeu, bestNeu, bonus: streakBonusFuer(streakNeu), freezeVerbraucht };
}

/** Tagesdifferenz (UTC) zwischen Tagesdatum und heute – ungültig → null. */
export function tageSeit(
  datum: string | null,
  heute: string,
): number | null {
  if (typeof datum !== "string") return null;
  const mDatum = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const mHeute = /^(\d{4})-(\d{2})-(\d{2})$/.exec(heute);
  if (!mDatum || !mHeute) return null;
  const von = Date.UTC(Number(mDatum[1]), Number(mDatum[2]) - 1, Number(mDatum[3]));
  const bis = Date.UTC(Number(mHeute[1]), Number(mHeute[2]) - 1, Number(mHeute[3]));
  if (!Number.isFinite(von) || !Number.isFinite(bis)) return null;
  const diff = Math.round((bis - von) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

/** Comeback-Bonus für den heutigen Claim: Pause lang genug (kein Neukonto). */
export function berechneComebackBonus(
  meta: Record<string, unknown>,
  heute: string,
): number {
  const letzter =
    typeof meta.letzterDailyBonus === "string" ? meta.letzterDailyBonus : null;
  if (letzter === null || letzter === heute) return 0;
  const luecke = tageSeit(letzter, heute);
  return luecke !== null && luecke >= COMEBACK_PAUSE_TAGE ? COMEBACK_BONUS : 0;
}

/** ISO-Kalenderwochen-Schlüssel (UTC) für den wöchentlichen Verzeih-Tag. */
export function wochenSchluessel(heute: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(heute);
  if (!m) return "";
  const tag = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // ISO-Woche: Montag = 1 … Sonntag = 7 (Donnerstag bestimmt das Wochenjahr).
  const wochentag = (tag.getUTCDay() + 6) % 7;
  tag.setUTCDate(tag.getUTCDate() - wochentag + 3);
  const jahr = tag.getUTCFullYear();
  const donnerstagJahrStart = Date.UTC(jahr, 0, 4);
  const woche =
    1 + Math.round((tag.getTime() - donnerstagJahrStart) / (7 * 24 * 60 * 60 * 1000));
  return `${jahr}-W${String(woche).padStart(2, "0")}`;
}

/** Ob der wöchentliche Verzeih-Tag noch ungenutzt ist. */
export function istFreezeVerfuegbar(
  meta: Record<string, unknown>,
  heute: string,
): boolean {
  const woche = wochenSchluessel(heute);
  if (!woche) return false;
  return meta.streakFreezeWoche !== woche;
}

export type StreakVorschau = {
  streakAktuell: number;
  streakBest: number;
  /** Heute auszahlbar: Streak-Bonus + ggf. Comeback (nach Claim: erhalten). */
  bonusHeute: number;
  comebackMoeglich: boolean;
  freezeVerfuegbar: boolean;
  /** Was der heutige (bereits abgeholte) Claim extra brachte – sonst null. */
  letzterExtra: "comeback" | "freeze" | "wochenbonus" | null;
};

/** Vorschau fürs Dashboard: was ein Claim heute bringt bzw. brachte. */
export function streakVorschau(
  meta: Record<string, unknown>,
  heute: string,
): StreakVorschau {
  const letzter =
    typeof meta.letzterDailyBonus === "string" ? meta.letzterDailyBonus : null;
  const extraRaw = meta.letzterDailyExtra;
  const letzterExtra: StreakVorschau["letzterExtra"] =
    extraRaw === "comeback" || extraRaw === "freeze" || extraRaw === "wochenbonus"
      ? extraRaw
      : null;
  if (letzter === heute) {
    const aktuell = leseStreakTage(meta);
    return {
      streakAktuell: aktuell,
      streakBest: leseStreakBest(meta),
      bonusHeute: aktuell > 0 ? streakBonusFuer(aktuell) : STREAK_BONUS_BASIS,
      comebackMoeglich: false,
      freezeVerfuegbar: istFreezeVerfuegbar(meta, heute),
      letzterExtra,
    };
  }
  const { bonus } = berechneStreakUpdate(meta, heute);
  const comeback = berechneComebackBonus(meta, heute);
  return {
    streakAktuell: leseStreakTage(meta),
    streakBest: leseStreakBest(meta),
    bonusHeute: bonus + comeback,
    comebackMoeglich: comeback > 0,
    freezeVerfuegbar: istFreezeVerfuegbar(meta, heute),
    letzterExtra: null,
  };
}

export type WochenStand = {
  woche: string;
  /** Mo=0 … So=6, true = Daily abgeholt (nur echte Claims, kein Freeze). */
  tage: boolean[];
  bonusGeholt: boolean;
};

/** Wochentag-Index Mo=0 … So=6 (UTC) – ungültig → -1. */
export function wochentagIndex(heute: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(heute);
  if (!m) return -1;
  const tag = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (!Number.isFinite(tag.getTime())) return -1;
  return (tag.getUTCDay() + 6) % 7;
}

/**
 * Wochenstand (Mo–So): alte Woche → frisch starten. Guarded gegen korrupte
 * Werte (falsche Länge, keine Booleans).
 */
export function wochenStand(
  meta: Record<string, unknown>,
  heute: string,
): WochenStand {
  const woche = wochenSchluessel(heute);
  const gespeichert = meta.streakWoche;
  if (
    typeof gespeichert === "object" &&
    gespeichert !== null &&
    (gespeichert as Record<string, unknown>).woche === woche &&
    woche !== ""
  ) {
    const daten = gespeichert as Record<string, unknown>;
    const tageRaw = daten.tage;
    const tage = Array.from({ length: 7 }, (_, i) =>
      Array.isArray(tageRaw) ? tageRaw[i] === true : false,
    );
    return { woche, tage, bonusGeholt: daten.bonusGeholt === true };
  }
  return { woche, tage: Array.from({ length: 7 }, () => false), bonusGeholt: false };
}

/** Guarded Read: eigene Zitat-Sammlung ("Mein Glas", neueste zuerst). */
export function leseZitatSammlung(meta: Record<string, unknown>): string[] {
  const wert = meta.zitatSammlung;
  if (!Array.isArray(wert)) return [];
  return wert
    .filter(
      (e): e is string =>
        typeof e === "string" && e.trim().length > 0 && e.length <= 500,
    )
    .slice(0, ZITAT_SAMMLUNG_MAX);
}

/** Legt ein Zitat oben auf die Sammlung (gedeckelt, Duplikate rutschen vor). */
export function sammlungMitZitat(
  meta: Record<string, unknown>,
  zitat: string,
): string[] {
  const text = zitat.trim().slice(0, ZITAT_SAMMLUNG_TEXT_MAX);
  if (!text) return leseZitatSammlung(meta);
  const rest = leseZitatSammlung(meta).filter((e) => e !== text);
  return [text, ...rest].slice(0, ZITAT_SAMMLUNG_MAX);
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

/** Guarded Read für das GurkenMail-Stundenfenster (Rolling-Window). */
export function leseGurkenmailPunkteStand(
  meta: Record<string, unknown>,
  jetztMs: number,
): { fensterStart: number; inFenster: number } {
  const start = meta.gurkenmailPunkteFenster;
  const drin = meta.gurkenmailPunkteInFenster;
  const fensterStart =
    typeof start === "number" && Number.isFinite(start) && start > 0 && start <= jetztMs
      ? start
      : 0;
  const inFenster =
    typeof drin === "number" && Number.isFinite(drin) && drin > 0 ? Math.floor(drin) : 0;
  // Abgelaufenes Fenster gilt als leer (Reset passiert beim Buchen).
  if (!fensterStart || jetztMs - fensterStart >= GURKENMAIL_PUNKTE_FENSTER_MS) {
    return { fensterStart: 0, inFenster: 0 };
  }
  return { fensterStart, inFenster };
}

/** Bereits per Punkte honorierte Empfangs-Mail-IDs (guarded, gedeckelt). */
export function leseGurkenmailAwardedIds(meta: Record<string, unknown>): string[] {
  const wert = meta.gurkenmailPunkteMailIds;
  if (!Array.isArray(wert)) return [];
  return wert.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100);
}

/**
 * Wendet den Stunden-Deckel auf einen Wunsch-Bonus an und liefert das
 * Update-Fragment für die Metadaten (Fenster-Start + Zähler).
 * Teilgutschrift: Reicht das Restbudget nicht, gibt es den Rest.
 * (Versand – selten, max. 3/Tag extern.)
 */
export function gurkenmailBonusUpdate(
  meta: Record<string, unknown>,
  jetztMs: number,
  wunsch: number,
): { bonus: number; update: { gurkenmailPunkteFenster: number; gurkenmailPunkteInFenster: number } } {
  const stand = leseGurkenmailPunkteStand(meta, jetztMs);
  const abgelaufen = stand.fensterStart === 0;
  const bisher = abgelaufen ? 0 : stand.inFenster;
  const rest = Math.max(0, PUNKTE_GURKENMAIL_MAX_PRO_STUNDE - bisher);
  const bonus = Math.max(0, Math.min(Math.floor(wunsch), rest));
  return {
    bonus,
    update: {
      gurkenmailPunkteFenster: abgelaufen ? jetztMs : stand.fensterStart,
      gurkenmailPunkteInFenster: bisher + bonus,
    },
  };
}

/**
 * Empfangs-Bonus in ganzen Einheiten: +5 nur bei ausreichendem Restbudget,
 * sonst +0 – pro Stunde werden also max. 2 empfangene Mails vergütet
 * (2×5 = 10 = Stundendeckel). Keine Teilbeträge beim Empfang.
 */
export function gurkenmailEmpfangsBonus(
  meta: Record<string, unknown>,
  jetztMs: number,
): { bonus: 0 | 5; update: { gurkenmailPunkteFenster: number; gurkenmailPunkteInFenster: number } } {
  const stand = leseGurkenmailPunkteStand(meta, jetztMs);
  const abgelaufen = stand.fensterStart === 0;
  const bisher = abgelaufen ? 0 : stand.inFenster;
  const rest = PUNKTE_GURKENMAIL_MAX_PRO_STUNDE - bisher;
  const bonus: 0 | 5 = rest >= PUNKTE_GURKENMAIL_EMPFANGEN ? 5 : 0;
  return {
    bonus,
    update: {
      gurkenmailPunkteFenster: abgelaufen ? jetztMs : stand.fensterStart,
      gurkenmailPunkteInFenster: bisher + bonus,
    },
  };
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
 * hat zusätzlich Daily/Einlösen-Flows). `detail` legt bei Zitaten den Text
 * oben auf die Sammlung ("Mein Glas").
 */
export async function bucheBonus(
  req: Request,
  userId: string,
  aktion: "chat" | "zitat",
  detail?: string,
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
      if (detail && detail.trim()) {
        update.zitatSammlung = sammlungMitZitat(meta, detail);
      }
    }
    await frisch.setClientReadOnlyMetadata({ ...meta, ...update });
    return { punkte: newPoints, punkteGesamt: newTotal, delta, quoteRemaining };
  });
}
