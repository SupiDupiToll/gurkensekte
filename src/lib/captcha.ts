/**
 * Geteilte Captcha-Prüfung für alle Gurken-Endpunkte.
 *
 * Primär wird Cap (self-hosted, https://cap.sdtoll.de) geprüft. Ist Cap nicht
 * erreichbar oder nicht konfiguriert, wird Cloudflare Turnstile als Fallback
 * verwendet. Beide Dienste stellen Single-Use-Tokens aus – ein Token darf
 * niemals an zwei Routen geprüft werden.
 *
 * Prinzip: Ein erfolgreich gelöstes Captcha schaltet die Sitzung (User-ID
 * bzw. IP + User-Agent) für 30 Minuten frei – danach ist ein frisches
 * Token nötig. Fehlen beide Captcha-Konfigurationen, wird die Prüfung in
 * Development übersprungen, in Production aber fail-closed abgelehnt.
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const STANDARD_CAP_SERVER_URL = "https://cap.sdtoll.de";
const CAP_TIMEOUT_MS = 5_000;
const TURNSTILE_TIMEOUT_MS = 5_000;

/** So lange gilt ein gelöstes Captcha für nachfolgende Anfragen. */
export const CAPTCHA_VALID_MS = 30 * 60 * 1000;

const captchaSessions = new Map<string, number>();

/** Grund, warum eine Captcha-Prüfung fehlgeschlagen ist. */
export type CaptchaGrund = "fehlt" | "ungueltig" | "nicht_verfuegbar";

/** Antwortkörper, wenn das Captcha fehlt, ungültig oder nicht erreichbar ist. */
export function captchaFehltFehler(grund: CaptchaGrund = "fehlt") {
  return {
    error:
      grund === "fehlt"
        ? "Captcha erforderlich"
        : grund === "nicht_verfuegbar"
          ? "Captcha-Dienst nicht erreichbar – bitte alternativen Schutz verwenden"
          : "Captcha ungültig oder abgelaufen",
    // Legacy-Feld: Das Frontend erkennt daran weiterhin "Captcha erneut
    // zeigen". Der Name bleibt aus Kompatibilitätsgründen erhalten.
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
export function getCaptchaSessionKey(
  req: Request,
  userId?: string | null,
): string {
  if (userId) return `user:${userId}`;
  const ip = getClientIp(req) ?? "no-ip";
  const userAgent = req.headers.get("user-agent") ?? "no-ua";
  return `${ip}:${userAgent}`;
}

export function capServerUrl(): string {
  const konfiguriert = process.env.NEXT_PUBLIC_CAP_SERVER_URL?.trim();
  return (konfiguriert || STANDARD_CAP_SERVER_URL).replace(/\/+$/, "");
}

export function capSiteKey(): string | null {
  const key =
    process.env.CAP_SITE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_CAP_SITE_KEY?.trim();
  return key || null;
}

export function capSecretKey(): string | null {
  const secret = process.env.CAP_SECRET_KEY?.trim();
  return secret || null;
}

/** Ob Cap serverseitig vollständig konfiguriert ist (Site-Key + Secret). */
export function capKonfiguriert(): boolean {
  return Boolean(capSiteKey() && capSecretKey());
}

/** Ob der Turnstile-Fallback serverseitig konfiguriert ist. */
export function turnstileKonfiguriert(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

function cleanupCaptchaSessions(now: number) {
  for (const [key, expiresAt] of captchaSessions) {
    if (expiresAt <= now) captchaSessions.delete(key);
  }
  if (captchaSessions.size <= 1000) return;
  const entries = Array.from(captchaSessions.entries()).sort(
    (a, b) => a[1] - b[1],
  );
  for (const [key] of entries.slice(0, captchaSessions.size - 1000)) {
    captchaSessions.delete(key);
  }
}

type CapErgebnis = "gueltig" | "ungueltig" | "nicht_verfuegbar";

/**
 * Prüft ein Cap-Token gegen `<server>/<siteKey>/siteverify`.
 *
 * - `gueltig`: Token akzeptiert.
 * - `ungueltig`: Cap hat das Token definitiv abgelehnt (abgelaufen, verbraucht,
 *   gefälscht). Dann ist ein Turnstile-Fallback nur sinnvoll, wenn der Client
 *   zusätzlich ein Turnstile-Token mitschickt.
 * - `nicht_verfuegbar`: Netzwerkfehler, Timeout, 5xx oder Fehlkonfiguration.
 *   Dann darf der Turnstile-Fallback greifen.
 */
async function verifiziereCapToken(
  token: string,
  secret: string,
  siteKey: string,
): Promise<CapErgebnis> {
  const url = `${capServerUrl()}/${encodeURIComponent(siteKey)}/siteverify`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(CAP_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(
        `Captcha: Cap-siteverify antwortete mit HTTP ${response.status} – Turnstile-Fallback wird versucht.`,
      );
      return "nicht_verfuegbar";
    }

    const data = (await response.json()) as { success?: boolean };
    return data.success === true ? "gueltig" : "ungueltig";
  } catch (error) {
    console.warn(
      "Captcha: Cap-siteverify nicht erreichbar – Turnstile-Fallback wird versucht.",
      error,
    );
    return "nicht_verfuegbar";
  }
}

async function verifiziereTurnstileToken(
  token: string,
  secret: string,
  remoteIp: string | null,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    if (!response.ok) return false;

    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Prüft das Captcha für eine Anfrage: Eine noch gültige Sitzung lässt die
 * Anfrage ohne Token durch. Sonst wird zuerst ein mitgeschicktes Cap-Token
 * geprüft, danach – bei fehlendem, nicht erreichbarem oder abgelehntem
 * Cap-Token – ein mitgeschicktes Turnstile-Token.
 *
 * Härtung:
 * - Ohne jegliche Captcha-Konfiguration schlägt die Prüfung in Production
 *   fehl (fail-closed), damit eine fehlende Env nicht lautlos allen
 *   Bot-Schutz abschaltet. Nur in Non-Production (Dev) wird mit Warnung
 *   durchgelassen.
 * - Mit eingeloggtem Nutzer zählt nur die User-Sitzung, nicht die IP-Sitzung:
 *   Sonst könnte sich jeder hinter derselben IP/User-Agent (NAT, Proxy) oder
 *   mit gefälschtem `x-forwarded-for` an fremden Captchas bedienen.
 * - `frischesToken: true` schaltet den Sitzungs-Shortcut ab: Jede Anfrage
 *   braucht ein frisch gelöstes, noch unverbrauchtes Token. Nötig für Chat
 *   (jede Nachricht) und Casino/Roulette (jeder Dreh) – sonst farmt ein
 *   Skript mit einer einzigen Lösung 30 Minuten lang Punkte.
 */
export async function pruefeCaptcha(
  req: Request,
  opts: {
    capToken?: unknown;
    turnstileToken?: unknown;
    userId?: string | null;
    frischesToken?: boolean;
  } = {},
): Promise<
  { ok: true } | { ok: false; grund: CaptchaGrund }
> {
  const now = Date.now();

  const siteKey = capSiteKey();
  const capSecret = capSecretKey();
  const capAktiv = Boolean(siteKey && capSecret);
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const turnstileAktiv = Boolean(turnstileSecret);

  if (!capAktiv && !turnstileAktiv) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Captcha: weder Cap noch Turnstile konfiguriert – Anfragen werden abgelehnt (fail-closed).",
      );
      return { ok: false, grund: "fehlt" };
    }
    console.warn(
      "Captcha: weder Cap noch Turnstile konfiguriert, Prüfung übersprungen (nur Dev).",
    );
    return { ok: true };
  }

  if (siteKey && !capSecret) {
    console.error(
      "Captcha: NEXT_PUBLIC_CAP_SITE_KEY/CAP_SITE_KEY gesetzt, aber CAP_SECRET_KEY fehlt – Cap wird übersprungen.",
    );
  }
  if (!siteKey && capSecret) {
    console.warn(
      "Captcha: CAP_SECRET_KEY gesetzt, aber kein Cap-Site-Key – Cap wird übersprungen.",
    );
  }

  // Eingeloggt: Nur die eigene User-Sitzung gilt – die IP-Sitzung fremder
  // Nutzer hinter derselben IP (oder mit gespooftem x-forwarded-for) darf
  // nicht für fremde Konten zählen.
  const sitzungsSchluessel = getCaptchaSessionKey(req, opts.userId);

  // Frisch-Token-Modus (Chat, Casino, Roulette): Die Sitzung wird bewusst
  // ignoriert – jede Anfrage braucht ein neues, live geprüftes Token.
  if (!opts.frischesToken) {
    if ((captchaSessions.get(sitzungsSchluessel) ?? 0) > now) {
      return { ok: true };
    }
  }

  const capToken =
    typeof opts.capToken === "string" ? opts.capToken.trim() : "";
  const turnstileToken =
    typeof opts.turnstileToken === "string" ? opts.turnstileToken.trim() : "";

  if (!capToken && !turnstileToken) {
    return { ok: false, grund: "fehlt" };
  }

  let grund: CaptchaGrund = "fehlt";
  let capNichtVerfuegbar = false;

  // Turnstile zuerst? Nein: Cap ist primär. Ein ungültiges Cap-Token blockt
  // aber nicht, wenn der Client ein gültiges Turnstile-Fallback-Token
  // mitschickt (z. B. während einer Migration oder bei abgelaufenem Token).
  if (capToken) {
    if (!capAktiv || !siteKey || !capSecret) {
      capNichtVerfuegbar = true;
    } else {
      const ergebnis = await verifiziereCapToken(capToken, capSecret, siteKey);
      if (ergebnis === "gueltig") {
        captchaSessions.set(sitzungsSchluessel, now + CAPTCHA_VALID_MS);
        cleanupCaptchaSessions(now);
        return { ok: true };
      }
      if (ergebnis === "ungueltig") {
        grund = "ungueltig";
      } else {
        capNichtVerfuegbar = true;
      }
    }
  }

  if (turnstileToken) {
    if (!turnstileAktiv || !turnstileSecret) {
      if (grund === "fehlt" && !capNichtVerfuegbar) {
        grund = "nicht_verfuegbar";
      }
    } else {
      const erfolgreich = await verifiziereTurnstileToken(
        turnstileToken,
        turnstileSecret,
        getClientIp(req),
      );
      if (erfolgreich) {
        captchaSessions.set(sitzungsSchluessel, now + CAPTCHA_VALID_MS);
        cleanupCaptchaSessions(now);
        return { ok: true };
      }
      grund = "ungueltig";
    }
  }

  if (grund === "fehlt" && capNichtVerfuegbar) {
    grund = "nicht_verfuegbar";
  }
  return { ok: false, grund };
}
