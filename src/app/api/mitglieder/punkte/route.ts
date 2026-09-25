import { hexclaveServerApp } from "@/hexclave/server";
import { getPendingReferrals } from "@/lib/referral";
import {
  type GurkenAdresse,
  adresseFormatieren,
  adresseLesen,
  adressePruefen,
} from "@/lib/bestellung";

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

  const punkte = (meta.punkte as number) ?? 0;

  return Response.json({
    punkte,
    // Fehlt das Feld noch (altes Konto), gelten die bisherigen Punkte als
    // gesamter Stand – danach steigen die XP nur noch nach oben.
    punkteGesamt:
      typeof meta.punkteGesamt === "number" ? meta.punkteGesamt : punkte,
    dailyAvailable: meta.letzterDailyBonus !== today,
    quoteAvailable: quoteCountToday < 3,
    quoteRemaining: Math.max(0, 3 - quoteCountToday),
    verlauf: (meta.punkteVerlauf as unknown[]) ?? [],
    geworben: (meta.werbungen as number) ?? 0,
    werbungenOffen: getPendingReferrals(meta).length,
    // Lieferadresse der (letzten) Gurken-Bestellung – für die Wiederverwendung.
    gurkenAdresse: adresseLesen(meta.gurkenAdresse),
  });
}

export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = (await req.json()) as { action?: string; adresse?: unknown };
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

  // Erst mit vollständiger Lieferadresse wird die Gurke bestellt.
  let lieferadresse: GurkenAdresse | null = null;
  if (action === "einloesen") {
    const pruefung = adressePruefen(body.adresse);
    if (!pruefung.ok) {
      return Response.json({ error: pruefung.error }, { status: 400 });
    }
    lieferadresse = pruefung.adresse;
  }

  if (action === "einloesen" && lieferadresse) {
    await fetch("https://ntfy.sh/jdjdixoqknslxloeoiibsbpgoka", {
      method: "POST",
      body: `Neue Gurken-Bestellung von ${user.primaryEmail}\nLieferadresse: ${adresseFormatieren(lieferadresse)}`,
    }).catch(() => {});
  }

  const delta = POINTS[action];
  const newPoints = currentPoints + delta;
  // Gesammelte Punkte (XP) fallen nie – erst beim allerersten Claim eines
  // Bestandskontos auf den aktuellen Stand initialisiert.
  const currentTotal =
    typeof meta.punkteGesamt === "number" ? meta.punkteGesamt : currentPoints;
  const newTotal = delta > 0 ? currentTotal + delta : currentTotal;
  const verlauf = ((meta.punkteVerlauf as unknown[]) ?? []).slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: action,
    punkte: delta,
    saldo: newPoints,
  });

  const update: Record<string, unknown> = {
    punkte: newPoints,
    punkteGesamt: newTotal,
    punkteVerlauf: verlauf,
  };

  if (lieferadresse) {
    // Für die nächste Bestellung parat halten.
    update.gurkenAdresse = lieferadresse;
  }

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
    punkteGesamt: newTotal,
    delta,
    dailyAvailable: nextDailyBonusDate !== today,
    quoteAvailable: nextQuoteCountToday < 3,
    quoteRemaining: Math.max(0, 3 - nextQuoteCountToday),
  });
}
