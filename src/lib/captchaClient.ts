/**
 * Client-Helfer für Captcha-Lösungen. Bewusst ohne Server-Importe, damit
 * weder Cap-Secret noch Turnstile-Secret in das Browser-Bundle gelangen.
 */

export type CaptchaAnbieter = "cap" | "turnstile";

export type CaptchaLoesung = {
  token: string;
  anbieter: CaptchaAnbieter;
};

/**
 * Baut die Request-Felder für eine Captcha-Lösung. Der Server akzeptiert
 * `capToken` (primär) und `turnstileToken` (Fallback) parallel.
 */
export function captchaPayload(
  loesung: CaptchaLoesung | null,
): { capToken?: string; turnstileToken?: string } {
  if (!loesung) return {};
  return loesung.anbieter === "cap"
    ? { capToken: loesung.token }
    : { turnstileToken: loesung.token };
}
