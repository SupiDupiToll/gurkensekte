import { hexclaveServerApp } from "@/hexclave/server";
import { getPendingReferrals } from "@/lib/referral";

const POINTS = {
  zitat: 5,
  chat: 5,
  daily: 20,
  einloesen: -1000,
} as const;

type Action = keyof typeof POINTS;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().split("T")[0];
  const quoteBonusDate = meta.letzterZitatBonus as string | undefined;
  const storedQuoteCount = (meta.zitatBonusCount as number) ?? 0;
  const quoteCountToday =
    quoteBonusDate === today ? Math.max(storedQuoteCount, quoteBonusDate ? 1 : 0) : 0;

  return Response.json({
    punkte: (meta.punkte as number) ?? 0,
    dailyAvailable: meta.letzterDailyBonus !== today,
    quoteAvailable: quoteCountToday < 3,
    quoteRemaining: Math.max(0, 3 - quoteCountToday),
    verlauf: (meta.punkteVerlauf as unknown[]) ?? [],
    geworben: (meta.werbungen as number) ?? 0,
    werbungenOffen: getPendingReferrals(meta).length,
  });
}

export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = (await req.json()) as { action?: string };
  const action = body.action as Action | undefined;

  if (!action || !(action in POINTS)) {
    return Response.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().split("T")[0];
  const currentPoints = (meta.punkte as number) ?? 0;
  const quoteBonusDate = meta.letzterZitatBonus as string | undefined;
  const storedQuoteCount = (meta.zitatBonusCount as number) ?? 0;
  const quoteCountToday =
    quoteBonusDate === today ? Math.max(storedQuoteCount, quoteBonusDate ? 1 : 0) : 0;

  if (action === "daily" && meta.letzterDailyBonus === today) {
    return Response.json({ error: "Heute schon abgeholt" }, { status: 400 });
  }

  if (action === "zitat" && quoteCountToday >= 3) {
    return Response.json({ error: "Heute schon 3 Zitate generiert" }, { status: 400 });
  }

  if (action === "einloesen" && currentPoints < 1000) {
    return Response.json({ error: "Nicht genug Punkte" }, { status: 400 });
  }

  if (action === "einloesen") {
    await fetch("https://ntfy.sh/jdjdixoqknslxloeoiibsbpgoka", {
      method: "POST",
      body: `Neue Gurken-Bestellung von ${user.primaryEmail}`,
    }).catch(() => {});
  }

  const delta = POINTS[action];
  const newPoints = currentPoints + delta;
  const verlauf = ((meta.punkteVerlauf as unknown[]) ?? []).slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: action,
    punkte: delta,
    saldo: newPoints,
  });

  const update: Record<string, unknown> = {
    punkte: newPoints,
    punkteVerlauf: verlauf,
  };

  if (action === "daily") {
    update.letzterDailyBonus = today;
  }
  if (action === "zitat") {
    update.letzterZitatBonus = today;
    update.zitatBonusCount = quoteCountToday + 1;
  }

  await user.setClientReadOnlyMetadata({ ...meta, ...update });

  const nextDailyBonusDate =
    action === "daily" ? today : ((meta.letzterDailyBonus as string | undefined) ?? null);
  const nextQuoteCountToday = action === "zitat" ? quoteCountToday + 1 : quoteCountToday;

  return Response.json({
    punkte: newPoints,
    delta,
    dailyAvailable: nextDailyBonusDate !== today,
    quoteAvailable: nextQuoteCountToday < 3,
    quoteRemaining: Math.max(0, 3 - nextQuoteCountToday),
  });
}
