/**
 * GurkenMail: geteilte Konstanten + Validierung.
 *
 * Empfang: Cloudflare Worker `gurkenmail-inbound` (email() Handler) auf
 * `gurkensekte.de`, speichert in D1 (kein R2 in v1 – Anhänge werden
 * verworfen, nur Metadaten bleiben).
 * Versand: Resend aus Next.js, max. 3 Mails / User / Tag, keine Anhänge.
 */

export const GURKENMAIL_DOMAIN =
  process.env.GURKENMAIL_DOMAIN ?? "gurkensekte.de";

/** Max. Mails pro User und Tag (UTC-Datum). */
export const GURKENMAIL_MAX_PRO_TAG = 3;
/**
 * Deckel für interne Mails (an andere @gurkensekte.de-Adressen) pro Tag.
 * Zählt NICHT zum 3er-Limit und geht nicht über Resend – reiner Spam-Schutz,
 * damit niemand fremde Postfächer flutet.
 */
export const GURKENMAIL_INTERN_MAX_PRO_TAG = 30;

export const GURKENMAIL_LOCALPART_MIN = 3;
export const GURKENMAIL_LOCALPART_MAX = 30;
export const GURKENMAIL_DISPLAYNAME_MIN = 2;
export const GURKENMAIL_DISPLAYNAME_MAX = 40;

const LOCALPART_MUSTER = /^[a-z0-9._-]+$/;

/** Systemadressen, die nie als GurkenMail vergeben werden. */
export const GURKENMAIL_RESERVIERT = new Set([
  "admin",
  "administrator",
  "kontakt",
  "hallo",
  "support",
  "help",
  "info",
  "noreply",
  "no-reply",
  "postmaster",
  "abuse",
  "security",
  "gurken",
  "guerkchen",
  "gürkchen",
  "sekte",
  "gurkenskte",
  "gurkensekte",
  "gurkenmail",
  "mail",
  "webmaster",
  "spenden",
  "pay",
  "billing",
]);

export function normalisiereLocalpart(eingabe: unknown): string | null {
  if (typeof eingabe !== "string") return null;
  const wert = eingabe.trim().toLowerCase();
  if (wert.length < GURKENMAIL_LOCALPART_MIN || wert.length > GURKENMAIL_LOCALPART_MAX)
    return null;
  if (!LOCALPART_MUSTER.test(wert)) return null;
  if (wert.startsWith(".") || wert.startsWith("-") || wert.startsWith("_")) return null;
  if (wert.endsWith(".") || wert.endsWith("-") || wert.endsWith("_")) return null;
  if (wert.includes("..")) return null;
  if (GURKENMAIL_RESERVIERT.has(wert)) return null;
  return wert;
}

export function normalisiereDisplayName(eingabe: unknown): string | null {
  if (typeof eingabe !== "string") return null;
  // Header-Injection verhindern: keine Zeilenumbrüche.
  const wert = eingabe.trim().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
  if (wert.length < GURKENMAIL_DISPLAYNAME_MIN || wert.length > GURKENMAIL_DISPLAYNAME_MAX)
    return null;
  // Kein Mail-Lookalike als Name – dann soll ein echter Name gewählt werden.
  if (wert.includes("@")) return null;
  return wert;
}

export function gurkenmailAdresse(localpart: string): string {
  return `${localpart}@${GURKENMAIL_DOMAIN}`;
}

/**
 * Vorgegebene Adress-Basis aus dem Mitgliedsnamen: Vorname (alphanumerisch,
 * klein), Fallback voller Name ohne Leerzeichen, sonst "gurke".
 * Max. 26 Zeichen, damit eine 1–4-stellige Zahl noch dranpasst (Limit 30).
 * Die Basis ist nicht frei wählbar – nur die Zahl bei belegter Adresse.
 */
export function vorschlagsBasis(anzeigename: unknown): string {
  const fallback = "gurke";
  if (typeof anzeigename !== "string") return fallback;
  const teile = anzeigename.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const norm = (s: string) => s.replace(/[^a-z0-9]/g, "").slice(0, 26);
  const kandidaten = [
    teile.length > 0 ? norm(teile[0]) : "",
    norm(teile.join("")),
  ];
  for (const k of kandidaten) {
    if (k.length < GURKENMAIL_LOCALPART_MIN) continue;
    if (GURKENMAIL_RESERVIERT.has(k)) continue;
    return k;
  }
  return fallback;
}

/**
 * Prüft, ob der Localpart zur vorgegebenen Basis passt: exakt die Basis
 * oder Basis + selbst gewählte Zahl (1–4 Ziffern).
 */
export function passtZuBasis(localpart: string, basis: string): boolean {
  if (localpart.length > GURKENMAIL_LOCALPART_MAX) return false;
  if (localpart === basis) return true;
  if (!localpart.startsWith(basis)) return false;
  return /^\d{1,4}$/.test(localpart.slice(basis.length));
}

export function heuteISO(): string {
  return new Date().toISOString().split("T")[0];
}

export type GurkenmailBox = {
  localpart: string;
  address: string;
  displayName: string;
};

export function leseMailbox(
  meta: Record<string, unknown>,
): GurkenmailBox | null {
  const localpart =
    typeof meta.gurkenmailLocalpart === "string" ? meta.gurkenmailLocalpart : null;
  const displayName =
    typeof meta.gurkenmailDisplayName === "string" ? meta.gurkenmailDisplayName : null;
  const normLocal = localpart ? normalisiereLocalpart(localpart) : null;
  // DisplayName aus Altbestand ggf. nachträglich kürzen/säubern.
  const normName = displayName ? normalisiereDisplayName(displayName) : null;
  if (!normLocal || !normName) return null;
  return { localpart: normLocal, address: gurkenmailAdresse(normLocal), displayName: normName };
}

/** Gesendete Mails heute (Zähler in Hexclave-Metadaten, wie Zitat-Quota). */
export function gesendetHeute(meta: Record<string, unknown>, heute: string): number {
  if (meta.gurkenmailSentDate !== heute) return 0;
  const n = meta.gurkenmailSentCount;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Heute versendete interne Mails (separater Zähler, kein Limit-Abzug). */
export function internGesendetHeute(meta: Record<string, unknown>, heute: string): number {
  if (meta.gurkenmailInternSentDate !== heute) return 0;
  const n = meta.gurkenmailInternSentCount;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** true, wenn der Empfänger eine GurkenMail-Adresse auf der eigenen Domain ist. */
export function istInterneAdresse(empfaenger: string, domain = GURKENMAIL_DOMAIN): boolean {
  return empfaenger.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

/** Localpart aus einer internen Empfängeradresse ziehen (null wenn ungültig). */
export function internerLocalpart(empfaenger: string): string | null {
  const [lokal, dom] = empfaenger.toLowerCase().split("@");
  if (!dom || dom !== GURKENMAIL_DOMAIN.toLowerCase()) return null;
  return normalisiereLocalpart(lokal);
}

/**
 * Anzeigenamen aus einem Absender-String ("Name <mail>" oder "mail") ziehen.
 * Vor- + Nachname → nur Vorname (erstes Wort). Kein Name (pure Mail) → "".
 */
export function absenderVorname(absender: string): string {
  const m = absender.match(/^\s*"?([^"<]+?)"?\s*<[^<>\s]+@[^<>\s]+>\s*$/);
  const name = (m ? m[1] : "").trim().replace(/\s+/g, " ");
  if (!name || name.includes("@")) return "";
  return name.split(" ")[0];
}

/** Reine Mail-Adresse aus "Name <mail>" oder purer Adresse ziehen (""). */
export function absenderMail(absender: string): string {
  const m = absender.match(/<([^<>\s]+@[^<>\s]+)>/);
  const kandidat = (m ? m[1] : absender).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kandidat) ? kandidat : "";
}

export type GurkenmailEingang = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  read: boolean;
  attachmentsDropped: number;
};

export type GurkenmailDetail = {
  id: string;
  from: string;
  subject: string;
  text: string;
  receivedAt: string;
  attachmentsDropped: number;
};

export type GurkenmailGesendet = {
  id: string;
  to: string;
  subject: string;
  snippet: string;
  sentAt: string;
};

export type GurkenmailGesendetDetail = {
  id: string;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
};
