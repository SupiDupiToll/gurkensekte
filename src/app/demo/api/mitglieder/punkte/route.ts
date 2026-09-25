import { getDemoProfile, mitDemoCookie } from "@/lib/demoStore";
import { adressePruefen } from "@/lib/bestellung";

const POINTS = {
  zitat: 5,
  chat: 5,
  daily: 20,
  einloesen: -1000,
} as const;

type Action = keyof typeof POINTS;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const res = new Response();
  const profile = getDemoProfile(req, res);
  const today = new Date().toISOString().split("T")[0];
  const quoteCountToday =
    profile.letzterZitatBonus === today ? Math.max(profile.zitatBonusCount, 1) : 0;

  return mitDemoCookie(
    Response.json({
      punkte: profile.punkte,
      punkteGesamt: profile.punkteGesamt,
      dailyAvailable: profile.letzterDailyBonus !== today,
      quoteAvailable: quoteCountToday < 3,
      quoteRemaining: Math.max(0, 3 - quoteCountToday),
      verlauf: profile.punkteVerlauf,
      gurkenAdresse: profile.gurkenAdresse ?? null,
    }),
    res,
  );
}

export async function POST(req: Request) {
  const res = new Response();
  const profile = getDemoProfile(req, res);
  const body = (await req.json()) as { action?: string; adresse?: unknown };
  const action = body.action as Action | undefined;

  if (!action || !(action in POINTS)) {
    return Response.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const quoteCountToday =
    profile.letzterZitatBonus === today ? Math.max(profile.zitatBonusCount, 1) : 0;

  if (action === "daily" && profile.letzterDailyBonus === today) {
    return Response.json({ error: "Heute schon abgeholt" }, { status: 400 });
  }

  if (action === "zitat" && quoteCountToday >= 3) {
    return Response.json({ error: "Heute schon 3 Zitate generiert" }, { status: 400 });
  }

  if (action === "einloesen" && profile.punkte < 1000) {
    return Response.json({ error: "Nicht genug Punkte" }, { status: 400 });
  }

  // Erst mit vollständiger Lieferadresse wird die Gurke bestellt.
  if (action === "einloesen") {
    const pruefung = adressePruefen(body.adresse);
    if (!pruefung.ok) {
      return Response.json({ error: pruefung.error }, { status: 400 });
    }
    profile.gurkenAdresse = pruefung.adresse;
  }

  const delta = POINTS[action];
  const newPoints = profile.punkte + delta;
  // XP steigen nur bei positivem Delta – Einlösen drückt das Guthaben, aber
  // nie die gesammelten Punkte (und damit nie den Rang in der Rangliste).
  const newTotal = delta > 0 ? profile.punkteGesamt + delta : profile.punkteGesamt;
  const verlauf = profile.punkteVerlauf.slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: action,
    punkte: delta,
    saldo: newPoints,
  });

  profile.punkteVerlauf = verlauf;
  profile.punkte = newPoints;
  profile.punkteGesamt = newTotal;
  if (action === "daily") {
    profile.letzterDailyBonus = today;
  }
  if (action === "zitat") {
    profile.letzterZitatBonus = today;
    profile.zitatBonusCount = quoteCountToday + 1;
  }
  if (action !== "zitat" && profile.letzterZitatBonus !== today) {
    profile.zitatBonusCount = 0;
  }

  const nextQuoteCountToday = action === "zitat" ? quoteCountToday + 1 : quoteCountToday;

  return mitDemoCookie(
    Response.json({
      punkte: newPoints,
      punkteGesamt: newTotal,
      delta,
      dailyAvailable: profile.letzterDailyBonus !== today,
      quoteAvailable: nextQuoteCountToday < 3,
      quoteRemaining: Math.max(0, 3 - nextQuoteCountToday),
    }),
    res,
  );
}
