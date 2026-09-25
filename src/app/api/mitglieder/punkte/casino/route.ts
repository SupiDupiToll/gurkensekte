import { hexclaveServerApp } from "@/hexclave/server";
import {
  casinoDelta,
  casinoWurf,
  istGueltigerEinsatz,
} from "@/lib/casino";

export const runtime = "nodejs";

/**
 * Gurken Casino (echter Mitgliederbereich): Einsatz prüfen, serverseitig
 * würfeln und die Punkte buchen. Höchster Gewinn 3×, größter Verlust 1×;
 * das Guthaben darf dabei nie unter die Einsatzgrenze geraten, da mehr als
 * der Einsatz nie verloren geht.
 */
export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: { einsatz?: unknown } = {};
  try {
    body = (await req.json()) as { einsatz?: unknown };
  } catch {
    // leerer Body – unten abgefangen
  }

  if (!istGueltigerEinsatz(body.einsatz)) {
    return Response.json({ error: "Ungültiger Einsatz" }, { status: 400 });
  }
  const einsatz = body.einsatz;

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const currentPoints = (meta.punkte as number) ?? 0;

  if (currentPoints < einsatz) {
    return Response.json(
      { error: "Nicht genug Punkte für diesen Einsatz" },
      { status: 400 },
    );
  }

  const wurf = casinoWurf();
  const delta = casinoDelta(einsatz, wurf.faktor);
  const newPoints = currentPoints + delta;

  // XP steigen nur bei positivem Delta – Verluste drücken das Guthaben,
  // aber nie den nie fallenden Gesamtbestand (und damit nie die XP-Anzeige).
  const currentTotal =
    typeof meta.punkteGesamt === "number" ? meta.punkteGesamt : currentPoints;
  const newTotal = delta > 0 ? currentTotal + delta : currentTotal;
  const verlauf = ((meta.punkteVerlauf as unknown[]) ?? []).slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: "casino",
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
    einsatz,
    faktor: wurf.faktor,
    delta,
    label: wurf.label,
    symbole: wurf.symbole,
    punkte: newPoints,
    punkteGesamt: newTotal,
  });
}
