import { hexclaveServerApp } from "@/hexclave/server";
import {
  rouletteAuszahlung,
  rouletteGewinnzahlGezinkt,
  validiereRouletteEinsaetze,
} from "@/lib/roulette";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";

export const runtime = "nodejs";

/**
 * Gurken Roulette (echter Mitgliederbereich): Captcha prüfen, Einsätze
 * prüfen, serverseitig gezinkt ziehen (Slot-Niveau) und die Punkte buchen.
 * Die Gewinnzahl steht vor der Animation fest – der Kessel zeigt sie nur an.
 */
export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: { einsaetze?: unknown; turnstileToken?: unknown } = {};
  try {
    body = (await req.json()) as {
      einsaetze?: unknown;
      turnstileToken?: unknown;
    };
  } catch {
    // leerer Body – unten abgefangen
  }

  // Bot-Schutz vor der Buchung: Ohne Captcha rollt die Kugel nicht.
  const captcha = await pruefeTurnstile(req, {
    token: body.turnstileToken,
    userId: user.id,
  });
  if (!captcha.ok) {
    return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
  }

  const check = validiereRouletteEinsaetze(body.einsaetze);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const currentPoints = (meta.punkte as number) ?? 0;

  if (currentPoints < check.gesamt) {
    return Response.json(
      {
        error: `Für ${check.gesamt} Punkte Gesamteinsatz hast du zu wenig Punkte auf dem Konto`,
      },
      { status: 400 },
    );
  }

  const gewinnzahl = rouletteGewinnzahlGezinkt(check.einsaetze);
  const auszahlung = rouletteAuszahlung(gewinnzahl, check.einsaetze);
  const delta = auszahlung - check.gesamt;
  const newPoints = currentPoints + delta;

  // XP steigen nur bei positivem Delta – Verluste drücken das Guthaben,
  // aber nie den nie fallenden Gesamtbestand.
  const currentTotal =
    typeof meta.punkteGesamt === "number" ? meta.punkteGesamt : currentPoints;
  const newTotal = delta > 0 ? currentTotal + delta : currentTotal;
  const verlauf = ((meta.punkteVerlauf as unknown[]) ?? []).slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: "roulette",
    punkte: delta,
    saldo: newPoints,
  });

  await user.setClientReadOnlyMetadata({
    ...meta,
    punkte: newPoints,
    punkteGesamt: newTotal,
    punkteVerlauf: verlauf,
  });

  return Response.json({
    gewinnzahl,
    auszahlung,
    einsatzGesamt: check.gesamt,
    delta,
    punkte: newPoints,
    punkteGesamt: newTotal,
  });
}
