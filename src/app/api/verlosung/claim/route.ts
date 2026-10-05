import { hexclaveServerApp } from "@/hexclave/server";
import {
  istSperreBelegtFehler,
  mitBenutzerSperre,
  rateLimit,
  rateLimitAntwort,
} from "@/lib/ratelimit";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import {
  lesePunkte,
  lesePunkteGesamt,
  leseVerlauf,
  mitFrischemBenutzer,
} from "@/lib/punkte";
import {
  BESTELLUNG_EMAIL,
  adressePruefen,
  type GurkenAdresse,
} from "@/lib/bestellung";
import {
  VERLOSUNG_MONATE_RUECKBLICK,
  VERLOSUNG_PUNKTE_ALTERNATIVE,
  verlosungsMonate,
  type VerlosungArt,
} from "@/lib/verlosung";
import {
  leseVerlosung,
  schreibeVerlosung,
} from "@/lib/verlosungStore";

export const runtime = "nodejs";

const CLAIM_LIMIT = 10;
const CLAIM_FENSTER_MS = 60 * 60 * 1000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: { art?: string; adresse?: unknown; turnstileToken?: unknown };
  try {
    body = (await req.json()) as {
      art?: string;
      adresse?: unknown;
      turnstileToken?: unknown;
    };
  } catch {
    return Response.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const art = body.art as VerlosungArt | undefined;
  if (art !== "gurke" && art !== "punkte") {
    return Response.json({ error: "Ungültige Wahl" }, { status: 400 });
  }

  if (
    !(await rateLimit(`verlosung-claim:${user.id}`, CLAIM_LIMIT, CLAIM_FENSTER_MS))
  ) {
    return rateLimitAntwort(CLAIM_FENSTER_MS);
  }

  // Bot-Schutz für die Gratis-Gurke (Mail-Versand): wie beim Einlösen reicht
  // die Sitzung – die Einmaligkeit sichert der Topf-Datensatz.
  if (art === "gurke") {
    const captcha = await pruefeTurnstile(req, {
      token: body.turnstileToken,
      userId: user.id,
    });
    if (!captcha.ok) {
      return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
    }
    const pruefung = adressePruefen(body.adresse);
    if (!pruefung.ok) {
      return Response.json({ error: pruefung.error }, { status: 400 });
    }
  }

  // Eigenen offenen Gewinn suchen (kein Ziehen hier – das macht GET).
  const monate = verlosungsMonate(VERLOSUNG_MONATE_RUECKBLICK);
  let monat: string | null = null;
  for (const m of monate) {
    const record = await leseVerlosung(m);
    if (record && record.gewinnerId === user.id && record.status === "offen") {
      monat = m;
      break;
    }
  }
  if (!monat) {
    return Response.json(
      { error: "Kein offener Gewinn gefunden." },
      { status: 400 },
    );
  }

  try {
    return await mitBenutzerSperre(`verlosung-claim:${monat}`, async () => {
      const record = await leseVerlosung(monat!);
      if (
        !record ||
        record.gewinnerId !== user.id ||
        record.status !== "offen"
      ) {
        return Response.json(
          { error: "Kein offener Gewinn gefunden." },
          { status: 400 },
        );
      }

      if (art === "punkte") {
        // +1.000 statt Gurke: Gutschrift unter Konto-Sperre (wie alle Buchungen).
        await mitFrischemBenutzer(req, user.id, async (frisch, meta) => {
          const stand = lesePunkte(meta);
          const newPoints = stand + VERLOSUNG_PUNKTE_ALTERNATIVE;
          const newTotal =
            lesePunkteGesamt(meta, stand) + VERLOSUNG_PUNKTE_ALTERNATIVE;
          const verlauf = leseVerlauf(meta).slice(-9);
          verlauf.push({
            datum: new Date().toISOString(),
            aktion: "verlosung",
            punkte: VERLOSUNG_PUNKTE_ALTERNATIVE,
            saldo: newPoints,
          });
          await frisch.setClientReadOnlyMetadata({
            ...meta,
            punkte: newPoints,
            punkteGesamt: newTotal,
            punkteVerlauf: verlauf,
          });
        });
      } else {
        // Gratis-Gurke: Adress-Flow wie beim Einlösen – aber ohne Abzug.
        const pruefung = adressePruefen(body.adresse);
        if (!pruefung.ok) {
          return Response.json({ error: pruefung.error }, { status: 400 });
        }
        const lieferadresse: GurkenAdresse = pruefung.adresse;
        try {
          await hexclaveServerApp.sendEmail({
            emails: [BESTELLUNG_EMAIL],
            subject: "🥒 Verlosungs-Gurke für ein Gurkenkind",
            html: `
          <h2 style="font-family:sans-serif">Verlosungs-Gewinn (${escapeHtml(record.monat)})</h2>
          <p style="font-family:sans-serif">
            <strong>${escapeHtml(user.primaryEmail ?? user.id)}</strong> hat die
            Monats-Verlosung gewonnen und löst eine <strong>gratis Gurke</strong> ein
            (keine Punkte abgezogen).
          </p>
          <p style="font-family:sans-serif">
            <strong>Lieferadresse:</strong><br />
            ${escapeHtml(lieferadresse.name)}<br />
            ${escapeHtml(lieferadresse.strasse)}<br />
            ${escapeHtml(`${lieferadresse.plz} ${lieferadresse.ort}`)}<br />
            ${escapeHtml(lieferadresse.land)}
          </p>
          <p style="font-family:sans-serif;font-size:12px;color:#666">
            Eingelöst am ${new Date().toLocaleString("de-DE", {
              timeZone: "Europe/Berlin",
            })} über die Gurken Sekte.
          </p>
        `,
          });
        } catch {
          return Response.json(
            {
              error:
                "Die Bestell-Mail konnte nicht verschickt werden – versuch es gleich nochmal.",
            },
            { status: 502 },
          );
        }
      }

      await schreibeVerlosung(monat!, {
        ...record,
        status: "eingeloest",
        art,
        eingeloestAm: new Date().toISOString(),
      });
      return Response.json({ ok: true, art, monat });
    });
  } catch (error) {
    if (istSperreBelegtFehler(error)) {
      return Response.json(
        { error: "Bitte kurz warten und erneut versuchen." },
        { status: 409 },
      );
    }
    throw error;
  }
}
