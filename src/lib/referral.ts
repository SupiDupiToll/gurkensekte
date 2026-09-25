/**
 * "Freunde werben Freunde"-System der Gurken Sekte.
 *
 * Jedes Mitglied hat einen Werbe-Link `/?ref=<userId>`. Öffnet jemand diesen
 * Link, wird der Code als Cookie hinterlegt. Registriert sich die Person
 * anschließend, bekommt der Werber einmalig Punkte gutgeschrieben.
 */

export const REFERRAL_COOKIE = "gurken_ref";

/** 30 Tage, damit zögerliche Konvertiten noch belohnt werden. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** So viele Punkte erhält der Werber pro neuem Mitglied. */
export const REFERRAL_POINTS = 100;

/** Aktionsname im Punkte-Verlauf des Werbers. */
export const REFERRAL_ACTIVITY = "freund-werben";

export function buildReferralLink(origin: string, code: string): string {
  return `${origin}/?ref=${encodeURIComponent(code)}`;
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
