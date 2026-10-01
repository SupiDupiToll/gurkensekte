/**
 * Benutzername: global eindeutiger, öffentlich sichtbarer Name.
 *
 * Gespeichert in Hexclave `clientReadOnlyMetadata.benutzername` (nur
 * serverseitig schreibbar), Eindeutigkeit via Upstash `SET NX`
 * (`gurke:benutzername:<name>` → userId) – gleiches Muster wie die
 * GurkenMail-Adressvergabe. Ohne Upstash in Production 503 (keine stille
 * Doppelvergabe).
 */

export const BENUTZERNAME_MIN = 3;
export const BENUTZERNAME_MAX = 20;

/**
 * Fallback, wenn aus dem Anzeigenamen kein gültiger Name ableitbar ist
 * (zu kurz, reserviert, nur Sonderzeichen). Muss selbst gültig + nicht
 * reserviert sein – "gurke" scheidet aus (reserviert).
 */
export const BENUTZERNAME_FALLBACK = "gurkenfreund";
const BENUTZERNAME_MUSTER = /^[a-z0-9._-]+$/;

/** Reserviert: System + GurkenMail-Namen + Generisches (kein Impersonation). */
export const BENUTZERNAME_RESERVIERT = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "support",
  "help",
  "info",
  "kontakt",
  "hallo",
  "noreply",
  "no-reply",
  "postmaster",
  "abuse",
  "security",
  "webmaster",
  "root",
  "system",
  "gurke",
  "gurken",
  "guerkchen",
  "gürkchen",
  "sekte",
  "gurkensekte",
  "gurkenskte",
  "gurkenmail",
  "mail",
  "spenden",
  "pay",
  "billing",
  "anonymous",
  "anonym",
  "geloescht",
  "deleted",
  "user",
  "benutzer",
  "mitglied",
  "offiziell",
  "official",
]);

function umlauteErsetzen(s: string): string {
  return s
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Strikte Prüfung: nur bereits gültige Namen. Kein stilles Umschreiben –
 * der Nutzer sieht exakt, was gespeichert wird.
 */
export function normalisiereBenutzername(eingabe: unknown): string | null {
  if (typeof eingabe !== "string") return null;
  const wert = eingabe.trim().toLowerCase();
  if (wert.length < BENUTZERNAME_MIN || wert.length > BENUTZERNAME_MAX)
    return null;
  if (!BENUTZERNAME_MUSTER.test(wert)) return null;
  if (
    wert.startsWith(".") ||
    wert.startsWith("-") ||
    wert.startsWith("_") ||
    wert.endsWith(".") ||
    wert.endsWith("-") ||
    wert.endsWith("_")
  )
    return null;
  if (wert.includes("..")) return null;
  if (BENUTZERNAME_RESERVIERT.has(wert)) return null;
  return wert;
}

/**
 * Vorschlag aus dem Hexclave-Anzeigenamen (Default beim Onboarding):
 * Umlaute → ae/oe/ue/ss, alles außer a-z0-9 → Punkte, doppelte Punkte
 * kollabieren, vorne/hinten trimmen, auf 20 Zeichen kürzen.
 * Fallback "gurkenfreund".
 */
export function benutzernameVorschlag(anzeigename: unknown): string {
  const fallback = BENUTZERNAME_FALLBACK;
  if (typeof anzeigename !== "string") return fallback;
  let s = umlauteErsetzen(anzeigename.trim().toLowerCase());
  s = s.replace(/[^a-z0-9._-]+/g, ".");
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/^[._-]+|[._-]+$/g, "");
  s = s.slice(0, BENUTZERNAME_MAX);
  // Kürzen kann ungültige Enden erzeugen (z. B. Punkt am Ende).
  s = s.replace(/[._-]+$/g, "");
  if (s.length < BENUTZERNAME_MIN) return fallback;
  if (!BENUTZERNAME_MUSTER.test(s)) return fallback;
  if (BENUTZERNAME_RESERVIERT.has(s)) return fallback;
  return s;
}

/** Guarded Read aus Hexclave-Metadaten (korrupte Werte → null). */
export function leseBenutzername(
  meta: Record<string, unknown>,
): string | null {
  const roh = meta.benutzername;
  if (typeof roh !== "string") return null;
  return normalisiereBenutzername(roh);
}

export function benutzernameFehlerText(eingabe: string): string | null {
  const wert = eingabe.trim().toLowerCase();
  if (wert.length < BENUTZERNAME_MIN)
    return `Mindestens ${BENUTZERNAME_MIN} Zeichen.`;
  if (wert.length > BENUTZERNAME_MAX)
    return `Maximal ${BENUTZERNAME_MAX} Zeichen.`;
  if (!BENUTZERNAME_MUSTER.test(wert))
    return "Nur Kleinbuchstaben, Zahlen sowie . _ - erlaubt (keine Leerzeichen/Umlaute).";
  if (
    wert.startsWith(".") ||
    wert.startsWith("-") ||
    wert.startsWith("_") ||
    wert.endsWith(".") ||
    wert.endsWith("-") ||
    wert.endsWith("_")
  )
    return "Nicht mit . _ - beginnen oder enden.";
  if (wert.includes("..")) return "Keine doppelten Punkte (..).";
  if (BENUTZERNAME_RESERVIERT.has(wert))
    return "Dieser Name ist reserviert – bitte einen anderen wählen.";
  return null;
}
