import { getDemoProfile, mitDemoCookie } from "@/lib/demoStore";
import {
  casinoDelta,
  casinoWurf,
  istGueltigerEinsatz,
} from "@/lib/casino";

export const runtime = "nodejs";

/** Demo-Variante des Casino-Automaten: gleicher Wurf, In-Memory-Speicher. */
export async function POST(req: Request) {
  const res = new Response();
  const profile = getDemoProfile(req, res);

  let body: { einsatz?: unknown } = {};
  try {
    body = (await req.json()) as { einsatz?: unknown };
  } catch {
    // leerer Body – unten abgefangen
  }

  if (!istGueltigerEinsatz(body.einsatz)) {
    return mitDemoCookie(
      Response.json({ error: "Ungültiger Einsatz" }, { status: 400 }),
      res,
    );
  }
  const einsatz = body.einsatz;

  if (profile.punkte < einsatz) {
    return mitDemoCookie(
      Response.json(
        { error: "Nicht genug Punkte für diesen Einsatz" },
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
