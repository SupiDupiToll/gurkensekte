import { getDemoProfile, mitDemoCookie } from "@/lib/demoStore";
import {
  CASINO_MAX_VERLUST_FAKTOR,
  casinoDelta,
  casinoWurf,
  istGueltigerEinsatz,
} from "@/lib/casino";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";

export const runtime = "nodejs";

/** Demo-Variante des Casino-Automaten: gleicher Wurf, In-Memory-Speicher. */
export async function POST(req: Request) {
  const res = new Response();
  const profile = getDemoProfile(req, res);

  let body: { einsatz?: unknown; turnstileToken?: unknown } = {};
  try {
    body = (await req.json()) as { einsatz?: unknown; turnstileToken?: unknown };
  } catch {
    // leerer Body – unten abgefangen
  }

  // Gleicher Bot-Schutz wie im echten Mitgliederbereich: jeder Dreh
  // braucht ein frisch gelöstes Captcha.
  const captcha = await pruefeTurnstile(req, {
    token: body.turnstileToken,
    frischesToken: true,
  });
  if (!captcha.ok) {
    return mitDemoCookie(
      Response.json(turnstileFehltFehler(captcha.grund), { status: 403 }),
      res,
    );
  }

  if (!istGueltigerEinsatz(body.einsatz)) {
    return mitDemoCookie(
      Response.json({ error: "Ungültiger Einsatz" }, { status: 400 }),
      res,
    );
  }
  const einsatz = body.einsatz;

  // Bis zu 3× Verlust: Nur mit 3-fachem Puffer darf gedreht werden.
  if (profile.punkte < einsatz * CASINO_MAX_VERLUST_FAKTOR) {
    return mitDemoCookie(
      Response.json(
        {
          error: `Für ${einsatz} Punkte Einsatz brauchst du mindestens ${einsatz * CASINO_MAX_VERLUST_FAKTOR} Punkte Puffer, weil bis zu 3× verloren gehen kann`,
        },
        { status: 400 },
      ),
      res,
    );
  }

  const wurf = casinoWurf();
  const delta = casinoDelta(einsatz, wurf.faktor);
  const newPoints = profile.punkte + delta;
  // XP steigen nur bei positivem Delta – Verluste bleiben beim Guthaben.
  const newTotal = delta > 0 ? profile.punkteGesamt + delta : profile.punkteGesamt;
  const verlauf = profile.punkteVerlauf.slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: "casino",
    punkte: delta,
    saldo: newPoints,
  });

  profile.punkteVerlauf = verlauf;
  profile.punkte = newPoints;
  profile.punkteGesamt = newTotal;

  return mitDemoCookie(
    Response.json({
      einsatz,
      faktor: wurf.faktor,
      delta,
      label: wurf.label,
      symbole: wurf.symbole,
      punkte: newPoints,
      punkteGesamt: newTotal,
    }),
    res,
  );
}
