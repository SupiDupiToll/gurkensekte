/**
 * "Freunde werben Freunde"-System der Gurken Sekte.
 *
 * Jedes Mitglied hat einen Werbe-Link `/?ref=<userId>`. Öffnet jemand diesen
 * Link, wird der Code als Cookie hinterlegt. Registriert sich die Person
 * anschließend, wird die Werbung als offene Prüfung hinterlegt und die
 * Sekten-Leitung per E-Mail informiert. Erst nach Bestätigung über den
 * Token-Link bekommt der Werber die Punkte gutgeschrieben.
 */

export const REFERRAL_COOKIE = "gurken_ref";

/** 30 Tage, damit zögerliche Konvertiten noch belohnt werden. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** So viele Punkte erhält der Werber pro neuem Mitglied. */
export const REFERRAL_POINTS = 100;

/** Aktionsname im Punkte-Verlauf des Werbers. */
export const REFERRAL_ACTIVITY = "freund-werben";

/**
 * An diese Adresse geht jede offene Werbung zur Prüfung. Die Sekten-Leitung
 * bestätigt sie über den Link in der E-Mail, erst danach werden die Punkte
 * gutgeschrieben.
 */
export const REFERRAL_REVIEW_EMAIL = "rui@sdtoll.de";

/** Name des Metadaten-Feldes, in dem offene (unbestätigte) Werbungen liegen. */
export const REFERRAL_PENDING_KEY = "referralPending";

/** Flag auf dem geworbenen Konto, sobald eine Prüfung angestoßen wurde. */
export const REFERRAL_CLAIMED_KEY = "referralClaimed";

/** So viele offene Werbungen werden pro Werber maximal vorgehalten. */
export const REFERRAL_PENDING_MAX = 50;

export type ReferralPendingEntry = {
  token: string;
  inviteeId: string;
  inviteeEmail: string | null;
  at: number;
};

export function buildReferralLink(origin: string, code: string): string {
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}

/** Einmal-Token für die Bestätigungs-Mail (URL-sicher, ohne Bindestriche). */
export function createReferralToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Bestätigungslink aus der Prüf-Mail an die Sekten-Leitung. */
export function buildReferralConfirmLink(
  origin: string,
  referrerId: string,
  token: string,
): string {
  return `${origin}/api/mitglieder/referral/bestaetigen?k=${encodeURIComponent(
    referrerId,
  )}&token=${encodeURIComponent(token)}`;
}

/** Liest die Liste der offenen Werbungen defensiv aus den Metadaten. */
export function getPendingReferrals(
  meta: Record<string, unknown> | null | undefined,
): ReferralPendingEntry[] {
  const raw = meta?.[REFERRAL_PENDING_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is ReferralPendingEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as ReferralPendingEntry).token === "string" &&
      typeof (entry as ReferralPendingEntry).inviteeId === "string",
  );
}

/**
 * Cookie-Wert `<code>|<timestamp>`. Der Zeitstempel sagt beim Einlösen, ob das
 * Konto *nach* dem Klick auf den Link entstanden ist — nur dann wird gewertet.
 */
export function encodeReferralCookie(code: string, at: number = Date.now()): string {
  return `${encodeURIComponent(code)}|${at}`;
}

export function decodeReferralCookie(
  raw: string | null | undefined,
): { code: string; at: number } | null {
  const [encoded, timestamp] = (raw ?? "").trim().split("|");
  if (!encoded) return null;
  return { code: decodeURIComponent(encoded), at: Number(timestamp) || 0 };
}

export function parseCookieValue(
  header: string | null | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export function hasReferralCookie(cookieString: string): boolean {
  return cookieString.split("; ").some((entry) => entry.startsWith(`${REFERRAL_COOKIE}=`));
}
