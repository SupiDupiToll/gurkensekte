/**
 * Geteilte Cloudflare-Turnstile-Prüfung für alle Gurken-Endpunkte.
 *
 * Prinzip: Ein erfolgreich gelöstes Captcha schaltet die Sitzung (User-ID
 * bzw. IP + User-Agent) für 30 Minuten frei – danach ist ein frisches
 * Token nötig. Fehlt das Secret, wird die Prüfung übersprungen (Dev-Modus).
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** So lange gilt ein gelöstes Captcha für nachfolgende Anfragen. */
export const TURNSTILE_VALID_MS = 30 * 60 * 1000;

const turnstileSessions = new Map<string, number>();

/** Antwortkörper, wenn das Captcha fehlt oder abgelaufen ist. */
export function turnstileFehltFehler(grund: "fehlt" | "ungueltig" = "fehlt") {
  return {
    error:
      grund === "fehlt"
        ? "Turnstile-Captcha erforderlich"
        : "Turnstile-Captcha ungültig oder abgelaufen",
    requiresTurnstile: true as const,
  };
}

export function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

/**
 * Sitzungsschlüssel: Bei eingeloggten Mitgliedern die User-ID (stabiler als
 * die IP), sonst IP + User-Agent wie bisher im Gürkchen-Chat.
 */
export function getTurnstileSessionKey(
  req: Request,
  userId?: string | null,
): string {
  if (userId) return `user:${userId}`;
  const ip = getClientIp(req) ?? "no-ip";
  const userAgent = req.headers.get("user-agent") ?? "no-ua";
  return `${ip}:${userAgent}`;
}

function cleanupTurnstileSessions(now: number) {
  for (const [key, expiresAt] of turnstileSessions) {
    if (expiresAt <= now) turnstileSessions.delete(key);
  }
  if (turnstileSessions.size <= 1000) return;
  const entries = Array.from(turnstileSessions.entries()).sort(
    (a, b) => a[1] - b[1],
  );
  for (const [key] of entries.slice(0, turnstileSessions.size - 1000)) {
    turnstileSessions.delete(key);
  }
}

async function verifiziereToken(
  token: string,
  secret: string,
  remoteIp: string | null,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;

  const data = (await response.json()) as { success?: boolean };
  return Boolean(data.success);
}

/**
 * Prüft das Turnstile-Captcha für eine Anfrage: Eine noch gültige Sitzung
 * lässt die Anfrage ohne Token durch, sonst wird `token` einmalig gegen die
 * Cloudflare-API geprüft und bei Erfolg eine neue Sitzung angelegt.
 *
 * Damit ein gelöstes Captcha überall gilt (z. B. Chat und Punkte-Buchung
 * teilen sich die Sitzung), werden User-Schlüssel und IP-Schlüssel gemeinsam
 * geprüft und gemeinsam gesetzt.
 */
export async function pruefeTurnstile(
  req: Request,
  opts: { token?: unknown; userId?: string | null } = {},
): Promise<{ ok: true } | { ok: false; grund: "fehlt" | "ungueltig" }> {
  const now = Date.now();
  const schluessel = [getTurnstileSessionKey(req, opts.userId)];
  // Zweit-Schlüssel: Der Chat kennt keine User-ID (nur IP), die Punkte-API
  // kennt die User-ID – beide Sitzungen gelten gegenseitig.
  const ipSchluessel = getTurnstileSessionKey(req, null);
  if (!schluessel.includes(ipSchluessel)) schluessel.push(ipSchluessel);

  if (schluessel.some((k) => (turnstileSessions.get(k) ?? 0) > now)) {
    return { ok: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn(
      "Turnstile: TURNSTILE_SECRET_KEY fehlt, Prüfung übersprungen.",
    );
    return { ok: true };
  }

  const token = typeof opts.token === "string" ? opts.token.trim() : "";
  if (!token) {
    return { ok: false, grund: "fehlt" };
  }

  // Netzfehler gegen Cloudflare dürfen nie als 500 enden – dann gilt das
  // Captcha als ungültig und das Frontend zeigt das Widget erneut.
  let erfolgreich = false;
  try {
    erfolgreich = await verifiziereToken(token, secret, getClientIp(req));
  } catch {
    erfolgreich = false;
  }
  if (!erfolgreich) {
    return { ok: false, grund: "ungueltig" };
  }

  for (const k of schluessel) {
    turnstileSessions.set(k, now + TURNSTILE_VALID_MS);
  }
  cleanupTurnstileSessions(now);
  return { ok: true };
}
