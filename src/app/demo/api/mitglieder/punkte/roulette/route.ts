import { getDemoProfile, mitDemoCookie } from "@/lib/demoStore";
import {
  rouletteAuszahlung,
  rouletteGewinnzahlGezinkt,
  validiereRouletteEinsaetze,
} from "@/lib/roulette";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";

export const runtime = "nodejs";

/** Demo-Variante des Roulettes: gleiche gezinkte Ziehung, In-Memory-Speicher. */
export async function POST(req: Request) {
  const res = new Response();
  const profile = getDemoProfile(req, res);

  let body: { einsaetze?: unknown; turnstileToken?: unknown } = {};
  try {
    body = (await req.json()) as {
      einsaetze?: unknown;
      turnstileToken?: unknown;
    };
  } catch {
    // leerer Body – unten abgefangen
  }

  // Gleicher Bot-Schutz wie im echten Mitgliederbereich.
  const captcha = await pruefeTurnstile(req, { token: body.turnstileToken });
  if (!captcha.ok) {
    return mitDemoCookie(
      Response.json(turnstileFehltFehler(captcha.grund), { status: 403 }),
      res,
    );
  }

  const check = validiereRouletteEinsaetze(body.einsaetze);
  if (!check.ok) {
    return mitDemoCookie(
      Response.json({ error: check.error }, { status: 400 }),
      res,
    );
  }

  if (profile.punkte < check.gesamt) {
    return mitDemoCookie(
      Response.json(
        {
          error: `Für ${check.gesamt} Punkte Gesamteinsatz hast du zu wenig Punkte auf dem Konto`,
        },
        { status: 400 },
      ),
      res,
    );
  }

  const gewinnzahl = rouletteGewinnzahlGezinkt(check.einsaetze);
  const auszahlung = rouletteAuszahlung(gewinnzahl, check.einsaetze);
  const delta = auszahlung - check.gesamt;
  const newPoints = profile.punkte + delta;
  // XP steigen nur bei positivem Delta – Verluste bleiben beim Guthaben.
  const newTotal =
    delta > 0 ? profile.punkteGesamt + delta : profile.punkteGesamt;
  const verlauf = profile.punkteVerlauf.slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: "roulette",
    punkte: delta,
    saldo: newPoints,
  });

  profile.punkteVerlauf = verlauf;
  profile.punkte = newPoints;
  profile.punkteGesamt = newTotal;

  return mitDemoCookie(
    Response.json({
      gewinnzahl,
      auszahlung,
      einsatzGesamt: check.gesamt,
      delta,
      punkte: newPoints,
      punkteGesamt: newTotal,
    }),
    res,
  );
}
