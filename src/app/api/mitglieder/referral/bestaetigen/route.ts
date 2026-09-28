import { hexclaveServerApp } from "@/hexclave/server";
import {
  istSperreBelegtFehler,
  mitBenutzerSperre,
  rateLimit,
  rateLimitAntwort,
} from "@/lib/ratelimit";
import {
  REFERRAL_ACTIVITY,
  REFERRAL_PENDING_KEY,
  REFERRAL_POINTS,
  getPendingReferrals,
} from "@/lib/referral";
import { lesePunkte, lesePunkteGesamt, leseVerlauf } from "@/lib/punkte";

export const runtime = "nodejs";

/** Bestätigungs-Links verfallen nach 7 Tagen (unbegrenzt gültige Token aus
 *  E-Mail-Plaintext, Logs und Browser-Historie sind ein unnötiges Risiko). */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Fangnetz gegen Token-Raten und User-Enumeration. */
const BESTAETIGEN_LIMIT = 20;
const BESTAETIGEN_FENSTER_MS = 60 * 60 * 1000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function seite(
  title: string,
  messageHtml: string,
  ok: boolean,
  bestaetigen?: { referrerId: string; token: string },
) {
  const accent = ok ? "#22c55e" : "#f87171";
  const formular = bestaetigen
    ? `<form method="POST" action="/api/mitglieder/referral/bestaetigen?k=${encodeURIComponent(
        bestaetigen.referrerId,
      )}&amp;token=${encodeURIComponent(bestaetigen.token)}">
         <button type="submit" style="display:inline-block;padding:12px 24px;border-radius:12px;border:none;background:#22c55e;color:#052e16;font-weight:700;font-size:16px;cursor:pointer">
           Werbung bestätigen &amp; +${REFERRAL_POINTS} Punkte gutschreiben
         </button>
       </form>`
    : `<a href="/mitglieder" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#22c55e;color:#052e16;font-weight:700;text-decoration:none">
         Zum Mitgliederbereich
       </a>`;
  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · Gurken Sekte</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1a0f;color:#e8f5e9;font-family:system-ui,sans-serif;padding:24px">
    <div style="max-width:480px;width:100%;border:1px solid ${accent}55;border-radius:20px;background:#0f2417;padding:32px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">${ok ? "🥒" : "⚠️"}</div>
      <h1 style="margin:0 0 12px;font-size:22px;color:${accent}">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#bbf7d0">${messageHtml}</p>
      ${formular}
    </div>
  </body>
</html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function leseToken(req: Request): { token: string; referrerId: string } | null {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  const referrerId = url.searchParams.get("k")?.trim();
  if (!token || !referrerId) return null;
  return { token, referrerId };
}

async function begrenze(req: Request, referrerId: string) {
  if (
    !(await rateLimit(
      `bestaetigen:${referrerId}`,
      BESTAETIGEN_LIMIT,
      BESTAETIGEN_FENSTER_MS,
    ))
  ) {
    return rateLimitAntwort(BESTAETIGEN_FENSTER_MS);
  }
  return null;
}

/**
 * Zeigt die Bestätigung als Formular – GET verändert bewusst nichts mehr:
 * Ein GET mit Seiteneffekt wäre per `<img src=…>` fremdauslösbar (CSRF) und
 * stünde in Logs/Historie. Erst der POST schreibt gut.
 */
export async function GET(req: Request) {
  const params = leseToken(req);
  if (!params) {
    return seite(
      "Ungültiger Link",
      "Dieser Bestätigungslink ist unvollständig.",
      false,
    );
  }

  const begrenzt = await begrenze(req, params.referrerId);
  if (begrenzt) return begrenzt;

  const referrer = await hexclaveServerApp.getUser(params.referrerId);
  if (!referrer) {
    return seite(
      "Unbekannter Werber",
      "Zu diesem Link existiert kein Mitglied mehr.",
      false,
    );
  }

  const meta = (referrer.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const pending = getPendingReferrals(meta);
  const entry = pending.find((item) => item.token === params.token);
  if (!entry) {
    return seite(
      "Bereits erledigt",
      "Diese Werbung wurde schon bestätigt oder ist nicht mehr offen.",
      false,
    );
  }
  if (Date.now() - entry.at > TOKEN_TTL_MS) {
    return seite(
      "Link abgelaufen",
      "Dieser Bestätigungslink ist älter als 7 Tage. Bitte eine neue Prüf-Mail anfordern.",
      false,
    );
  }

  return seite(
    "Werbung prüfen",
    `Bitte bestätigen: <strong>+${REFERRAL_POINTS} Punkte</strong> gutschreiben?`,
    true,
    { referrerId: params.referrerId, token: params.token },
  );
}

/**
 * Bestätigt eine offene Werbung aus der Prüf-Mail: Der Token-Link schreibt dem
 * Werber {@link REFERRAL_POINTS} Punkte gut und markiert das geworbene Konto als
 * endgültig geworben. Single-Use, mit Ablauf und Konto-Sperre gegen
 * parallele Doppel-Gutschriften.
 */
export async function POST(req: Request) {
  const params = leseToken(req);
  if (!params) {
    return seite(
      "Ungültiger Link",
      "Dieser Bestätigungslink ist unvollständig.",
      false,
    );
  }

  const begrenzt = await begrenze(req, params.referrerId);
  if (begrenzt) return begrenzt;

  try {
    return await mitBenutzerSperre(
      `referral:${params.referrerId}`,
      async () => {
        const referrer = await hexclaveServerApp.getUser(params.referrerId);
        if (!referrer) {
          return seite(
            "Unbekannter Werber",
            "Zu diesem Link existiert kein Mitglied mehr.",
            false,
          );
        }

        const meta = (referrer.clientReadOnlyMetadata ?? {}) as Record<
          string,
          unknown
        >;
        const pending = getPendingReferrals(meta);
        const entry = pending.find((item) => item.token === params.token);
        if (!entry) {
          return seite(
            "Bereits erledigt",
            "Diese Werbung wurde schon bestätigt oder ist nicht mehr offen.",
            false,
          );
        }
        if (Date.now() - entry.at > TOKEN_TTL_MS) {
          return seite(
            "Link abgelaufen",
            "Dieser Bestätigungslink ist älter als 7 Tage. Bitte eine neue Prüf-Mail anfordern.",
            false,
          );
        }

        const currentPoints = lesePunkte(meta);
        const newPoints = currentPoints + REFERRAL_POINTS;
        // XP-Bestand: nie fallend, wird nur nach oben geschrieben.
        const currentTotal = lesePunkteGesamt(meta, currentPoints);
        const verlauf = leseVerlauf(meta).slice(-9);
        verlauf.push({
          datum: new Date().toISOString(),
          aktion: REFERRAL_ACTIVITY,
          punkte: REFERRAL_POINTS,
          saldo: newPoints,
        });
        const werbungen = meta.werbungen;
        const bisher =
          typeof werbungen === "number" && Number.isFinite(werbungen)
            ? werbungen
            : 0;

        await referrer.setClientReadOnlyMetadata({
          ...meta,
          punkte: newPoints,
          punkteGesamt: currentTotal + REFERRAL_POINTS,
          punkteVerlauf: verlauf,
          werbungen: bisher + 1,
          [REFERRAL_PENDING_KEY]: pending.filter(
            (item) => item.token !== params.token,
          ),
        });

        // Das geworbene Konto endgültig als geworben markieren (falls es noch existiert).
        const invitee = await hexclaveServerApp.getUser(entry.inviteeId);
        if (invitee) {
          const inviteeMeta = (invitee.clientReadOnlyMetadata ?? {}) as Record<
            string,
            unknown
          >;
          await invitee.setClientReadOnlyMetadata({
            ...inviteeMeta,
            referralCredited: true,
          });
        }

        return seite(
          "Werbung bestätigt",
          `+${REFERRAL_POINTS} Punkte für <strong>${escapeHtml(
            referrer.primaryEmail ?? referrer.id,
          )}</strong> wurden gutgeschrieben.`,
          true,
        );
      },
    );
  } catch (error) {
    if (istSperreBelegtFehler(error)) {
      return seite(
        "Bitte erneut versuchen",
        "Die Bestätigung läuft bereits – bitte kurz warten und erneut versuchen.",
        false,
      );
    }
    throw error;
  }
}
