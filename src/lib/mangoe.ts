/**
 * Mangoe Payments – gemeinsame Konstanten & Browser-Typen.
 *
 * Server-Geheimnisse (MANGOE_API_KEY, MANGOE_WEBHOOK_SECRET) gehören NIE
 * hierher und NIE ins Frontend – sie werden nur in den
 * spenden-API-Routen gelesen.
 */

export const MANGOE_BASE_URL =
  process.env.NEXT_PUBLIC_MANGOE_URL?.replace(/\/+$/, "") ||
  "https://payments.mangoe.de";

/** Vom Skill dokumentiertes Browser-SDK (mangoe.js). */
export interface MangoePaySdk {
  redirect: (checkoutUrl: string) => void;
  embed: (
    selector: string | HTMLElement,
    checkoutUrl: string,
    options?: { height?: number; border?: boolean; title?: string },
  ) => void;
  auto: () => void;
  pollSession: (
    base: string,
    sessionId: string,
    apiKey: string,
  ) => Promise<unknown>;
}

declare global {
  interface Window {
    MangoePay?: MangoePaySdk;
  }
}

/** Erfolgs-Event, das die Mangoe-Erfolgsseite per postMessage schickt (nur Iframe). */
export interface MangoeSuccessMessage {
  type: "mangoe:payment.succeeded";
  sessionId: string;
  order?: string;
}

export function isMangoeSuccessMessage(
  value: unknown,
): value is MangoeSuccessMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "mangoe:payment.succeeded" &&
    typeof v.sessionId === "string" &&
    (v.order === undefined || typeof v.order === "string")
  );
}
