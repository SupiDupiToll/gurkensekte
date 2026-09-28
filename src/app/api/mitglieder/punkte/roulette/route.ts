import { hexclaveServerApp } from "@/hexclave/server";
import {
  rouletteAuszahlung,
  rouletteGewinnzahlGezinkt,
  validiereRouletteEinsaetze,
} from "@/lib/roulette";
import {
  istSperreBelegtFehler,
  rateLimit,
  rateLimitAntwort,
} from "@/lib/ratelimit";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import {
  istPunkteFehler,
  lesePunkte,
  lesePunkteGesamt,
  leseVerlauf,
  mitFrischemBenutzer,
  PunkteFehler,
} from "@/lib/punkte";

export const runtime = "nodejs";

/** Fangnetz gegen Kugel-Spam (Hexclave-Schreiblast) – Bots stoppt das Captcha. */
const ROULETTE_LIMIT = 120;
const ROULETTE_FENSTER_MS = 60 * 60 * 1000;

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

  // Bot-Schutz vor der Buchung: Jede Kugel braucht ein frisch gelöstes
  // Captcha – eine 30-Minuten-Sitzung würde unbegrenzte Drehs pro Lösung
  // erlauben (Farming + Schreiblast).
  const captcha = await pruefeTurnstile(req, {
    token: body.turnstileToken,
    userId: user.id,
    frischesToken: true,
  });
  if (!captcha.ok) {
    return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
  }

  const check = validiereRouletteEinsaetze(body.einsaetze);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  if (!(await rateLimit(`roulette:${user.id}`, ROULETTE_LIMIT, ROULETTE_FENSTER_MS))) {
    return rateLimitAntwort(ROULETTE_FENSTER_MS);
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const currentPoints = lesePunkte(meta);

  if (currentPoints < check.gesamt) {
    return Response.json(
      {
        error: `Für ${check.gesamt} Punkte Gesamteinsatz hast du zu wenig Punkte auf dem Konto`,
      },
      { status: 400 },
    );
  }

  try {
    return await mitFrischemBenutzer(
      req,
      user.id,
      async (frisch, frischeMeta) => {
        const stand = lesePunkte(frischeMeta);
        if (stand < check.gesamt) {
          throw new PunkteFehler(
            400,
            `Für ${check.gesamt} Punkte Gesamteinsatz hast du zu wenig Punkte auf dem Konto`,
          );
        }

        // Ziehung und Buchung gemeinsam im Lock (TOCTOU-Schutz).
        const gewinnzahl = rouletteGewinnzahlGezinkt(check.einsaetze);
        const auszahlung = rouletteAuszahlung(gewinnzahl, check.einsaetze);
        const delta = auszahlung - check.gesamt;
        const newPoints = stand + delta;

        // XP steigen nur bei positivem Delta – Verluste drücken das Guthaben,
        // aber nie den nie fallenden Gesamtbestand.
        const currentTotal = lesePunkteGesamt(frischeMeta, stand);
        const newTotal = delta > 0 ? currentTotal + delta : currentTotal;
        const verlauf = leseVerlauf(frischeMeta).slice(-9);

        verlauf.push({
          datum: new Date().toISOString(),
          aktion: "roulette",
          punkte: delta,
          saldo: newPoints,
        });

        await frisch.setClientReadOnlyMetadata({
          ...frischeMeta,
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
      },
    );
  } catch (error) {
    if (istPunkteFehler(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (istSperreBelegtFehler(error)) {
      return Response.json(
        { error: "Bitte kurz warten und erneut setzen." },
        { status: 409 },
      );
    }
    throw error;
  }
}
