import { hexclaveServerApp } from "@/hexclave/server";
import {
  REFERRAL_CLAIMED_KEY,
  REFERRAL_COOKIE,
  REFERRAL_PENDING_KEY,
  REFERRAL_PENDING_MAX,
  REFERRAL_POINTS,
  REFERRAL_REVIEW_EMAIL,
  buildReferralConfirmLink,
  createReferralToken,
  decodeReferralCookie,
  getPendingReferrals,
  parseCookieValue,
  type ReferralPendingEntry,
} from "@/lib/referral";

export const runtime = "nodejs";

const CLEAR_COOKIE = `${REFERRAL_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;

function respond(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Set-Cookie": CLEAR_COOKIE } });
}

/** Lässt das Werbe-Cookie stehen, damit es später erneut versucht wird. */
function respondKeepCookie(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
  const proto = first(req.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  const host = first(req.headers.get("x-forwarded-host")) ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

/**
 * Löst eine offene Werbung aus: Ist ein Werbe-Cookie gesetzt und gehört das
 * Konto zu einer Person, die sich über den Link registriert hat, wird die
 * Werbung *nicht* sofort gutgeschrieben, sondern als offene Prüfung beim
 * Werber hinterlegt. Die Sekten-Leitung erhält per Hexclave eine E-Mail mit
 * einem Bestätigungs-Token; erst der Klick darauf schreibt die
 * {@link REFERRAL_POINTS} Punkte gut (siehe `.../referral/bestaetigen`).
 */
export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  if (meta.referralCredited || meta[REFERRAL_CLAIMED_KEY]) {
    return respond({ credited: false, reason: "already" });
  }

  const referral = decodeReferralCookie(
    parseCookieValue(req.headers.get("cookie"), REFERRAL_COOKIE),
  );
  if (!referral) {
    return Response.json({ credited: false, reason: "no-referral" });
  }

  if (referral.code === user.id) {
    return respond({ credited: false, reason: "self" });
  }

  // Nur frische Konten zählen: Das Konto muss nach dem Klick auf den Link
  // entstanden sein (mit Puffer für Uhren-Drift zwischen Browser und Server).
  const signedUpAt = new Date(user.signedUpAt).getTime();
  if (referral.at > 0 && signedUpAt < referral.at - 5 * 60 * 1000) {
    return respond({ credited: false, reason: "existing-account" });
  }

  const referrer = await hexclaveServerApp.getUser(referral.code);
  if (!referrer) {
    return respond({ credited: false, reason: "unknown-referrer" });
  }

  const referrerMeta = (referrer.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const pending = getPendingReferrals(referrerMeta);
  if (pending.some((entry) => entry.inviteeId === user.id)) {
    return respond({ credited: false, reason: "already-pending" });
  }

  const token = createReferralToken();
  const confirmLink = buildReferralConfirmLink(requestOrigin(req), referrer.id, token);
  const inviteeEmail = user.primaryEmail ?? null;

  // Erst die Prüf-Mail verschicken: Ohne Link darf keine offene Werbung liegen
  // bleiben, die niemand bestätigen kann.
  try {
    await hexclaveServerApp.sendEmail({
      emails: [REFERRAL_REVIEW_EMAIL],
      subject: "🥒 Neue Werbung zur Prüfung",
      html: `
        <h2 style="font-family:sans-serif">Neue Gurken-Werbung zur Prüfung</h2>
        <p style="font-family:sans-serif">
          <strong>${escapeHtml(inviteeEmail ?? user.id)}</strong> wurde von
          <strong>${escapeHtml(referrer.primaryEmail ?? referrer.id)}</strong> geworben.
        </p>
        <p style="font-family:sans-serif">
          Bei Bestätigung erhält der Werber <strong>+${REFERRAL_POINTS} Punkte</strong>.
        </p>
        <p style="font-family:sans-serif">
          <a href="${confirmLink}"
             style="display:inline-block;padding:12px 24px;border-radius:10px;background:#22c55e;color:#052e16;font-weight:700;text-decoration:none">
            Werbung bestätigen &amp; +${REFERRAL_POINTS} Punkte gutschreiben
          </a>
        </p>
        <p style="font-family:sans-serif;font-size:12px;color:#666">
          Falls der Button nicht funktioniert: ${confirmLink}
        </p>
      `,
    });
  } catch {
    // Cookie absichtlich behalten: Beim nächsten Dashboard-Besuch wird die
    // Prüf-Mail erneut verschickt, statt die Werbung stillschweigend zu verlieren.
    return respondKeepCookie({ credited: false, reason: "email-failed" }, 502);
  }

  const entry: ReferralPendingEntry = {
    token,
    inviteeId: user.id,
    inviteeEmail,
    at: Date.now(),
  };

  await referrer.setClientReadOnlyMetadata({
    ...referrerMeta,
    [REFERRAL_PENDING_KEY]: [...pending, entry].slice(-REFERRAL_PENDING_MAX),
  });

  // Das geworbene Konto gilt als "gemeldet" – so kann dieselbe Werbung nicht
  // mehrfach zur Prüfung eingereicht werden. `referralCredited` setzt erst die
  // Bestätigung.
  await user.setClientReadOnlyMetadata({
    ...meta,
    [REFERRAL_CLAIMED_KEY]: true,
    referredBy: referral.code,
  });

  return respond({
    credited: false,
    pending: true,
    punkteDelta: REFERRAL_POINTS,
  });
}
