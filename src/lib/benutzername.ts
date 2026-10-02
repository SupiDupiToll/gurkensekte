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
 * Vorschlag für den Benutzernamen (Default beim Onboarding):
 * 1. Teil vor dem @ der E-Mail-Adresse,
 * 2. sonst der Hexclave-Anzeigename,
 * 3. sonst Fallback "gurkenfreund".
 * Bereinigung jeweils: Umlaute → ae/oe/ue/ss, alles außer a-z0-9 → Punkte,
 * doppelte Punkte kollabieren, vorne/hinten trimmen, auf 20 Zeichen kürzen.
 * Reservierte/ungültige Kandidaten fallen auf die nächste Stufe zurück.
 */
function vorschlagBereinigen(roh: string): string | null {
  let s = umlauteErsetzen(roh.trim().toLowerCase());
  s = s.replace(/[^a-z0-9._-]+/g, ".");
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/^[._-]+|[._-]+$/g, "");
  s = s.slice(0, BENUTZERNAME_MAX);
  // Kürzen kann ungültige Enden erzeugen (z. B. Punkt am Ende).
  s = s.replace(/[._-]+$/g, "");
  if (s.length < BENUTZERNAME_MIN) return null;
  if (!BENUTZERNAME_MUSTER.test(s)) return null;
  if (BENUTZERNAME_RESERVIERT.has(s)) return null;
  return s;
}

export function benutzernameVorschlag(anzeigename: unknown, email?: unknown): string {
  const fallback = BENUTZERNAME_FALLBACK;
  if (typeof email === "string" && email.includes("@")) {
    const lokal = email.split("@")[0] ?? "";
    const ausMail = vorschlagBereinigen(lokal);
    if (ausMail) return ausMail;
  }
  if (typeof anzeigename === "string") {
    const ausName = vorschlagBereinigen(anzeigename);
    if (ausName) return ausName;
  }
  return fallback;
}

/** Guarded Read aus Hexclave-Metadaten (korrupte Werte → null). */
export function leseBenutzername(
  meta: Record<string, unknown>,
): string | null {
  const roh = meta.benutzername;
  if (typeof roh !== "string") return null;
  return normalisiereBenutzername(roh);
}

/**
 * Rohwert aus Hexclave-Metadaten (ungeprüft) – für Selbstheilung: Ein früher
 * (oder von außen) gespeicherter blockierter/ungültiger Name liefert bei
 * `leseBenutzername` null, belegt aber ggf. noch einen Redis-Key. Der
 * Rohwert erlaubt, diesen Key beim Umbenennen freizugeben.
 */
export function roherBenutzername(meta: Record<string, unknown>): string | null {
  const roh = meta.benutzername;
  return typeof roh === "string" ? roh : null;
}

/** true, wenn in den Metadaten ein Name steht, der heute ungültig/reserviert wäre. */
export function hatUngueltigenBenutzernamen(meta: Record<string, unknown>): boolean {
  const roh = roherBenutzername(meta);
  return roh !== null && roh.trim().length > 0 && leseBenutzername(meta) === null;
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

/**
 * Kompaktform für den Anzeigenamen-Vergleich: kleingeschrieben, Umlaute
 * aufgelöst, alles außer a-z0-9 entfernt. So werden auch „Admin“, „A.D.M.I.N“
 * oder „ADMIN!“ als reserviert erkannt. Absichtlich nur exakte Treffer (keine
 * Teilwortsuche), damit normale Namen wie „Mad Mint“ nicht blockiert werden.
 */
function kompaktForm(s: string): string {
  return umlauteErsetzen(s.toLowerCase()).replace(/[^a-z0-9]/g, "");
}

const RESERVIERT_KOMPAKT = new Set(
  [...BENUTZERNAME_RESERVIERT].map((w) => kompaktForm(w)),
);

/** true, wenn der Anzeigename (kompakt verglichen) einem reservierten Namen entspricht. */
export function istReservierterAnzeigename(eingabe: unknown): boolean {
  if (typeof eingabe !== "string") return false;
  const k = kompaktForm(eingabe.trim());
  return k.length > 0 && RESERVIERT_KOMPAKT.has(k);
}

/**
 * Anzeigename-Prüfung (Hexclave-`displayName`, 2–100 Zeichen, Freitext):
 * Längen + kein Mail-Lookalike + Sperrliste gegen Impersonation („admin“,
 * „support“, …). Blockierte Namen werden damit nicht mehr in Hexclave
 * gespeichert.
 */
export function anzeigenameFehlerText(eingabe: string): string | null {
  const wert = eingabe.trim().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
  if (wert.length < 2) return "Mindestens 2 Zeichen.";
  if (wert.length > 100) return "Maximal 100 Zeichen.";
  if (wert.includes("@"))
    return "Bitte einen echten Namen (keine E-Mail-Adresse).";
  if (istReservierterAnzeigename(wert))
    return "Dieser Name ist reserviert – bitte einen anderen wählen.";
  return null;
}
