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
  // Infrastruktur-gesetzte Header zuerst: Hinter Cloudflare/Vercel stammen
  // diese vom Proxy und nicht vom Client. `x-forwarded-for` kann der Client
  // fälschen – deshalb wird dort der LETZTE Eintrag genommen (vom nächsten
  // vertrauenswürdigen Proxy angehängt), nicht der erste.
  const direkt =
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim();
  if (direkt) return direkt;
  const weitergeleitet = req.headers.get("x-forwarded-for");
  if (weitergeleitet) {
    const eintraege = weitergeleitet
      .split(",")
      .map((eintrag) => eintrag.trim())
      .filter(Boolean);
    const letzte = eintraege[eintraege.length - 1];
    if (letzte) return letzte;
  }
  return null;
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
 * Anonyme Anfragen (Chat) nutzen die IP-Sitzung, eingeloggte Mitglieder die
 * User-Sitzung – bewusst getrennt, damit sich niemand an fremden Captchas
 * bedient (siehe Härtung unten).
 *
 * Härtung:
 * - Ohne Secret schlägt die Prüfung in Production fehl (fail-closed), damit
 *   eine fehlende Env nicht lautlos allen Bot-Schutz abschaltet. Nur in
 *   Non-Production (Dev) wird mit Warnung durchgelassen.
 * - Mit eingeloggtem Nutzer zählt nur die User-Sitzung, nicht die IP-Sitzung:
 *   Sonst könnte sich jeder hinter derselben IP/User-Agent (NAT, Proxy) oder
 *   mit gefälschtem `x-forwarded-for` an fremden Captchas bedienen.
 * - `frischesToken: true` schaltet den Sitzungs-Shortcut ab: Jede Anfrage
 *   braucht ein frisch gelöstes, noch unverbrauchtes Token, das immer live
 *   gegen Cloudflare geprüft wird. Nötig für Chat (jede Nachricht) und
 *   Casino/Roulette (jeder Dreh) – sonst farmt ein Skript mit einer einzigen
 *   Lösung 30 Minuten lang Punkte. Hintergrund: Turnstile-Tokens sind
 *   Single-Use (`timeout-or-duplicate` bei Zweitprüfung), deshalb darf ein
 *   Token nie an zwei Routen zur Prüfung weitergereicht werden.
 */
export async function pruefeTurnstile(
  req: Request,
  opts: {
    token?: unknown;
    userId?: string | null;
    frischesToken?: boolean;
  } = {},
): Promise<{ ok: true } | { ok: false; grund: "fehlt" | "ungueltig" }> {
  const now = Date.now();

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Turnstile: TURNSTILE_SECRET_KEY fehlt in Production – Anfragen werden abgelehnt (fail-closed).",
      );
      return { ok: false, grund: "fehlt" };
    }
    console.warn(
      "Turnstile: TURNSTILE_SECRET_KEY fehlt, Prüfung übersprungen (nur Dev).",
    );
    return { ok: true };
  }

  // Eingeloggt: Nur die eigene User-Sitzung gilt – die IP-Sitzung fremder
  // Nutzer hinter derselben IP (oder mit gespooftem x-forwarded-for) darf
  // nicht für fremde Konten zählen.
  const gueltigeSchluessel = opts.userId
    ? [getTurnstileSessionKey(req, opts.userId)]
    : [
        getTurnstileSessionKey(req, null),
      ];

  // Frisch-Token-Modus (Chat, Casino, Roulette): Die Sitzung wird bewusst
  // ignoriert – jede Anfrage braucht ein neues, live geprüftes Token.
  if (!opts.frischesToken) {
    if (gueltigeSchluessel.some((k) => (turnstileSessions.get(k) ?? 0) > now)) {
      return { ok: true };
    }
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

  // Nur der jeweils passende Schlüssel wird gesetzt: Eine als Mitglied
  // gelöste Challenge schaltet nicht zusätzlich die ganze IP (NAT) frei.
  for (const k of gueltigeSchluessel) {
    turnstileSessions.set(k, now + TURNSTILE_VALID_MS);
  }
  cleanupTurnstileSessions(now);
  return { ok: true };
}
