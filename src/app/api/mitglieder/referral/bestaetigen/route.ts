import { hexclaveServerApp } from "@/hexclave/server";
import {
  REFERRAL_ACTIVITY,
  REFERRAL_PENDING_KEY,
  REFERRAL_POINTS,
  getPendingReferrals,
} from "@/lib/referral";

export const runtime = "nodejs";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, message: string, ok: boolean) {
  const accent = ok ? "#22c55e" : "#f87171";
  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Gurken Sekte</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1a0f;color:#e8f5e9;font-family:system-ui,sans-serif;padding:24px">
    <div style="max-width:480px;width:100%;border:1px solid ${accent}55;border-radius:20px;background:#0f2417;padding:32px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">${ok ? "🥒" : "⚠️"}</div>
      <h1 style="margin:0 0 12px;font-size:22px;color:${accent}">${title}</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#bbf7d0">${message}</p>
      <a href="/mitglieder" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#22c55e;color:#052e16;font-weight:700;text-decoration:none">
        Zum Mitgliederbereich
      </a>
    </div>
  </body>
</html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Bestätigt eine offene Werbung aus der Prüf-Mail: Der Token-Link schreibt dem
 * Werber {@link REFERRAL_POINTS} Punkte gut und markiert das geworbene Konto als
 * endgültig geworben.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  const referrerId = url.searchParams.get("k")?.trim();

  if (!token || !referrerId) {
    return page("Ungültiger Link", "Dieser Bestätigungslink ist unvollständig.", false);
  }

  const referrer = await hexclaveServerApp.getUser(referrerId);
  if (!referrer) {
    return page("Unbekannter Werber", "Zu diesem Link existiert kein Mitglied mehr.", false);
  }

  const meta = (referrer.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const pending = getPendingReferrals(meta);
  const entry = pending.find((item) => item.token === token);
  if (!entry) {
    return page(
      "Bereits erledigt",
      "Diese Werbung wurde schon bestätigt oder ist nicht mehr offen.",
      false,
    );
  }

  const currentPoints = (meta.punkte as number) ?? 0;
  const newPoints = currentPoints + REFERRAL_POINTS;
  const verlauf = ((meta.punkteVerlauf as unknown[]) ?? []).slice(-9);
  verlauf.push({
    datum: new Date().toISOString(),
    aktion: REFERRAL_ACTIVITY,
    punkte: REFERRAL_POINTS,
    saldo: newPoints,
  });

  await referrer.setClientReadOnlyMetadata({
    ...meta,
    punkte: newPoints,
    punkteVerlauf: verlauf,
    werbungen: ((meta.werbungen as number) ?? 0) + 1,
    [REFERRAL_PENDING_KEY]: pending.filter((item) => item.token !== token),
  });

  // Das geworbene Konto endgültig als geworben markieren (falls es noch existiert).
  const invitee = await hexclaveServerApp.getUser(entry.inviteeId);
  if (invitee) {
    const inviteeMeta = (invitee.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
    await invitee.setClientReadOnlyMetadata({ ...inviteeMeta, referralCredited: true });
  }

  return page(
    "Werbung bestätigt",
    `+${REFERRAL_POINTS} Punkte für <strong>${escapeHtml(
      referrer.primaryEmail ?? referrer.id,
    )}</strong> wurden gutgeschrieben.`,
    true,
  );
}
