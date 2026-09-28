import { hexclaveServerApp } from "@/hexclave/server";
import {
  CASINO_MAX_VERLUST_FAKTOR,
  casinoDelta,
  casinoWurf,
  istGueltigerEinsatz,
} from "@/lib/casino";
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

/** Fangnetz gegen Dreh-Spam (Hexclave-Schreiblast) – Bots stoppt das Captcha. */
const CASINO_LIMIT = 120;
const CASINO_FENSTER_MS = 60 * 60 * 1000;

/**
 * Gurken Casino (echter Mitgliederbereich): Captcha prüfen, Einsatz prüfen,
 * serverseitig würfeln und die Punkte buchen. Höchster Gewinn 3×, größter
 * Verlust 3× – deshalb muss das 3-fache des Einsatzes als Puffer auf dem
 * Konto liegen, damit kein Dreh ins Minus führt.
 */
export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: { einsatz?: unknown; turnstileToken?: unknown } = {};
  try {
    body = (await req.json()) as { einsatz?: unknown; turnstileToken?: unknown };
  } catch {
    // leerer Body – unten abgefangen
  }

  // Bot-Schutz vor der Buchung: Jeder Dreh braucht ein frisch gelöstes
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

  if (!istGueltigerEinsatz(body.einsatz)) {
    return Response.json({ error: "Ungültiger Einsatz" }, { status: 400 });
  }
  const einsatz = body.einsatz;

  if (!(await rateLimit(`casino:${user.id}`, CASINO_LIMIT, CASINO_FENSTER_MS))) {
    return rateLimitAntwort(CASINO_FENSTER_MS);
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const currentPoints = lesePunkte(meta);

  // Bis zu 3× Verlust: Nur wer den 3-fachen Einsatz auf dem Konto hat, darf
  // drehen – so bleibt das Guthaben immer bei 0 oder darüber. Vorab-Check
  // (UX), verbindlich erneut im Lock.
  if (currentPoints < einsatz * CASINO_MAX_VERLUST_FAKTOR) {
    return Response.json(
      {
        error: `Für ${einsatz} Punkte Einsatz brauchst du mindestens ${einsatz * CASINO_MAX_VERLUST_FAKTOR} Punkte Puffer, weil bis zu 3× verloren gehen kann`,
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
        if (stand < einsatz * CASINO_MAX_VERLUST_FAKTOR) {
          throw new PunkteFehler(
            400,
            `Für ${einsatz} Punkte Einsatz brauchst du mindestens ${einsatz * CASINO_MAX_VERLUST_FAKTOR} Punkte Puffer, weil bis zu 3× verloren gehen kann`,
          );
        }

        // Wurf und Buchung gemeinsam im Lock: Zwei parallele Drehs sehen
        // sonst denselben Stand und buchen beide.
        const wurf = casinoWurf();
        const delta = casinoDelta(einsatz, wurf.faktor);
        const newPoints = stand + delta;

        // XP steigen nur bei positivem Delta – Verluste drücken das Guthaben,
        // aber nie den nie fallenden Gesamtbestand (und damit nie die XP-Anzeige).
        const currentTotal = lesePunkteGesamt(frischeMeta, stand);
        const newTotal = delta > 0 ? currentTotal + delta : currentTotal;
        const verlauf = leseVerlauf(frischeMeta).slice(-9);

        verlauf.push({
          datum: new Date().toISOString(),
          aktion: "casino",
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
          einsatz,
          faktor: wurf.faktor,
          delta,
          label: wurf.label,
          symbole: wurf.symbole,
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
        { error: "Bitte kurz warten und erneut drehen." },
        { status: 409 },
      );
    }
    throw error;
  }
}
