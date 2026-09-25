import { hexclaveServerApp } from "@/hexclave/server";
import {
  REFERRAL_ACTIVITY,
  REFERRAL_COOKIE,
  REFERRAL_POINTS,
  decodeReferralCookie,
  parseCookieValue,
} from "@/lib/referral";

export const runtime = "nodejs";

const CLEAR_COOKIE = `${REFERRAL_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;

function respond(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Set-Cookie": CLEAR_COOKIE } });
}

/**
 * Löst eine offene Werbung ein: Ist ein Werbe-Cookie gesetzt und gehört das
 * Konto zu einer Person, die sich über den Link registriert hat, erhält der
 * Werber {@link REFERRAL_POINTS} Punkte. Pro Konto passiert das genau einmal.
 */
export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  if (meta.referralCredited) {
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
  const referrerPoints = (referrerMeta.punkte as number) ?? 0;
  const newPoints = referrerPoints + REFERRAL_POINTS;
  const verlauf = ((referrerMeta.punkteVerlauf as unknown[]) ?? []).slice(-9);
  verlauf.push({
    datum: new Date().toISOString(),
    aktion: REFERRAL_ACTIVITY,
    punkte: REFERRAL_POINTS,
    saldo: newPoints,
  });

  await referrer.setClientReadOnlyMetadata({
    ...referrerMeta,
    punkte: newPoints,
    punkteVerlauf: verlauf,
    werbungen: ((referrerMeta.werbungen as number) ?? 0) + 1,
  });

  await user.setClientReadOnlyMetadata({
    ...meta,
    referralCredited: true,
    referredBy: referral.code,
  });

  return respond({
    credited: true,
    punkteDelta: REFERRAL_POINTS,
    referrerPunkte: newPoints,
  });
}
