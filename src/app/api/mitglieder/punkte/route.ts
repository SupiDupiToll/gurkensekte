import { hexclaveServerApp } from "@/hexclave/server";
import { getPendingReferrals } from "@/lib/referral";
import {
  istSperreBelegtFehler,
  rateLimit,
  rateLimitAntwort,
} from "@/lib/ratelimit";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
import {
  WOCHENBONUS_PUNKTE,
  berechneComebackBonus,
  berechneStreakUpdate,
  heuteISO,
  istPunkteFehler,
  lesePunkte,
  lesePunkteGesamt,
  leseVerlauf,
  leseZitatSammlung,
  mitFrischemBenutzer,
  streakVorschau,
  wochenSchluessel,
  wochenStand,
  wochentagIndex,
  zitatZaehlerHeute,
  PunkteFehler,
  type WochenStand,
} from "@/lib/punkte";
import {
  BESTELLUNG_EMAIL,
  type GurkenAdresse,
  adresseLesen,
  adressePruefen,
} from "@/lib/bestellung";
import { erhoeheLose } from "@/lib/verlosungStore";

const POINTS = {
  zitat: 5,
  chat: 5,
  daily: 20,
  einloesen: -1000,
  // Einmaliger Startbonus für neue Konten (ohne Captcha – einmalig pro
  // Konto, wie der Referral-Bonus; Missbrauch limitiert den Schaden auf
  // Kleinstbeträge ohne Geldwert).
  starter: 50,
} as const;

type Action = keyof typeof POINTS;

export const runtime = "nodejs";

/** Schutz vor HTML-Injection in der Bestell-Mail. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Höchstens so viele Gurken-Bestellungen pro Konto und Stunde (Mail-Spam-Schutz). */
const EINLOESEN_LIMIT = 10;
const EINLOESEN_FENSTER_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const today = heuteISO();
  const quoteCountToday = zitatZaehlerHeute(meta, today);

  const punkte = lesePunkte(meta);
  const werbungen = meta.werbungen;
  const geworben =
    typeof werbungen === "number" && Number.isFinite(werbungen)
      ? werbungen
      : 0;

  return Response.json({
    punkte,
    // Fehlt das Feld noch (altes Konto), gelten die bisherigen Punkte als
    // gesamter Stand – danach steigen die XP nur noch nach oben.
    punkteGesamt: lesePunkteGesamt(meta, punkte),
    dailyAvailable: meta.letzterDailyBonus !== today,
    quoteAvailable: quoteCountToday < 3,
    quoteRemaining: Math.max(0, 3 - quoteCountToday),
    verlauf: leseVerlauf(meta),
    geworben,
    werbungenOffen: getPendingReferrals(meta).length,
    // Lieferadresse der (letzten) Gurken-Bestellung – für die Wiederverwendung.
    gurkenAdresse: adresseLesen(meta.gurkenAdresse),
    // Streak-Vorschau: aktuelle Serie, Rekord und Bonus bei Claim heute.
    ...streakVorschau(meta, today),
    // Sammelalbum ("Mein Glas") + kumulierte Werbungspunkte (null = Fallback).
    sammlung: leseZitatSammlung(meta),
    // Wochen-Streak (Mo–So) für die Anzeige oben.
    woche: wochenStand(meta, today),
    werbungPunkte:
      typeof meta.werbungPunkte === "number" &&
      Number.isFinite(meta.werbungPunkte) &&
      meta.werbungPunkte >= 0
        ? Math.floor(meta.werbungPunkte)
        : null,
  });
}

export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let body: { action?: string; adresse?: unknown; turnstileToken?: unknown };
  try {
    body = (await req.json()) as {
      action?: string;
      adresse?: unknown;
      turnstileToken?: unknown;
    };
  } catch {
    return Response.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const action = body.action as Action | undefined;

  if (!action || !(action in POINTS)) {
    return Response.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  // Bot-Schutz für alle Punkte-Aktionen: Chat und Zitat brauchen pro
  // Buchung ein frisch gelöstes Captcha (`frischesToken`) – sonst farmt ein
  // Skript mit einer einzigen Lösung 30 Minuten lang Punkte. Daily und
  // Einlösen haben eigene Quoten (Tag / Rate-Limit) und nutzen die Sitzung.
  // Der einmalige Starter-Bonus braucht kein Captcha (einmal pro Konto).
  // Geprüft wird vor allen Kontingent-Checks, damit Fehlversuche kein
  // Tageslimit verbrauchen.
  if (action !== "starter") {
    const captcha = await pruefeTurnstile(req, {
      token: body.turnstileToken,
      userId: user.id,
      frischesToken: action === "chat" || action === "zitat",
    });
    if (!captcha.ok) {
      return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
    }
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const today = heuteISO();
  const currentPoints = lesePunkte(meta);
  const quoteCountToday = zitatZaehlerHeute(meta, today);

  // Vorab-Checks auf ggf. veralteten Metadaten (schnelles UX-Feedback) –
  // verbindlich geprüft wird erneut im Lock mit frischem Stand.
  if (action === "daily" && meta.letzterDailyBonus === today) {
    return Response.json({ error: "Heute schon abgeholt" }, { status: 400 });
  }

  if (action === "starter" && meta.starterBonusGeholt === true) {
    return Response.json({ error: "Startbonus schon erhalten" }, { status: 400 });
  }

  if (action === "zitat" && quoteCountToday >= 3) {
    return Response.json({ error: "Heute schon 3 Zitate generiert" }, { status: 400 });
  }

  if (action === "einloesen" && currentPoints < 1000) {
    return Response.json({ error: "Nicht genug Punkte" }, { status: 400 });
  }

  // Erst mit vollständiger Lieferadresse wird die Gurke bestellt.
  if (action === "einloesen") {
    if (!(await rateLimit(`einloesen:${user.id}`, EINLOESEN_LIMIT, EINLOESEN_FENSTER_MS))) {
      return rateLimitAntwort(EINLOESEN_FENSTER_MS);
    }
    const pruefung = adressePruefen(body.adresse);
    if (!pruefung.ok) {
      return Response.json({ error: pruefung.error }, { status: 400 });
    }
  }

  try {
    return await mitFrischemBenutzer(req, user.id, async (frisch, frischeMeta) => {
      const stand = lesePunkte(frischeMeta);
      const zitatHeute = zitatZaehlerHeute(frischeMeta, today);

      // Verbindliche Re-Checks im Lock (TOCTOU-Schutz).
      if (action === "daily" && frischeMeta.letzterDailyBonus === today) {
        throw new PunkteFehler(400, "Heute schon abgeholt");
      }
      if (action === "starter" && frischeMeta.starterBonusGeholt === true) {
        throw new PunkteFehler(400, "Startbonus schon erhalten");
      }
      if (action === "zitat" && zitatHeute >= 3) {
        throw new PunkteFehler(400, "Heute schon 3 Zitate generiert");
      }
      if (action === "einloesen" && stand < 1000) {
        throw new PunkteFehler(400, "Nicht genug Punkte");
      }

      // Die Bestell-Mail mit der Lieferadresse geht per Hexclave raus, bevor
      // die Punkte gebucht werden: Schlägt der Versand fehl, wird nichts
      // abgezogen und die Bestellung kann einfach wiederholt werden. Läuft
      // mit im Lock, damit zwei parallele Bestellungen nicht zwei Mails bei
      // nur einer Abbuchung erzeugen.
      let lieferadresse: GurkenAdresse | null = null;
      if (action === "einloesen") {
        const pruefung = adressePruefen(body.adresse);
        if (!pruefung.ok) {
          throw new PunkteFehler(400, pruefung.error);
        }
        lieferadresse = pruefung.adresse;
        try {
          await hexclaveServerApp.sendEmail({
            emails: [BESTELLUNG_EMAIL],
            subject: "🥒 Neue Gurken-Bestellung",
            html: `
          <h2 style="font-family:sans-serif">Neue Gurken-Bestellung</h2>
          <p style="font-family:sans-serif">
            <strong>${escapeHtml(frisch.primaryEmail ?? frisch.id)}</strong> hat
            eine echte Gurke für
            <strong>${Math.abs(POINTS.einloesen)} Punkte</strong> bestellt.
          </p>
          <p style="font-family:sans-serif">
            <strong>Lieferadresse:</strong><br />
            ${escapeHtml(lieferadresse.name)}<br />
            ${escapeHtml(lieferadresse.strasse)}<br />
            ${escapeHtml(`${lieferadresse.plz} ${lieferadresse.ort}`)}<br />
            ${escapeHtml(lieferadresse.land)}
          </p>
          <p style="font-family:sans-serif;font-size:12px;color:#666">
            Bestellt am ${new Date().toLocaleString("de-DE", {
              timeZone: "Europe/Berlin",
            })} über die Gurken Sekte.
          </p>
        `,
          });
        } catch {
          throw new PunkteFehler(
            502,
            "Die Bestell-Mail konnte nicht verschickt werden – es wurden keine Punkte abgezogen. Bitte versuch es gleich nochmal.",
          );
        }
      }

      const streakFuerClaim =
        action === "daily" ? berechneStreakUpdate(frischeMeta, today) : null;
      const comebackFuerClaim =
        action === "daily" ? berechneComebackBonus(frischeMeta, today) : 0;
      // Wochen-Streak (Mo–So): Tag abhaken, bei 7/7 einmalig +100.
      let wochenBonus = 0;
      let wocheNeu: WochenStand | null = null;
      if (action === "daily") {
        wocheNeu = wochenStand(frischeMeta, today);
        const tagIndex = wochentagIndex(today);
        if (tagIndex >= 0) wocheNeu.tage[tagIndex] = true;
        if (wocheNeu.tage.every(Boolean) && !wocheNeu.bonusGeholt) {
          wochenBonus = WOCHENBONUS_PUNKTE;
          wocheNeu.bonusGeholt = true;
        }
      }
      const delta = streakFuerClaim
        ? streakFuerClaim.bonus + comebackFuerClaim + wochenBonus
        : POINTS[action];
      const newPoints = stand + delta;
      // Gesammelte Punkte (XP) fallen nie – erst beim allerersten Claim eines
      // Bestandskontos auf den aktuellen Stand initialisiert.
      const currentTotal = lesePunkteGesamt(frischeMeta, stand);
      const newTotal = delta > 0 ? currentTotal + delta : currentTotal;
      const verlauf = leseVerlauf(frischeMeta).slice(-9);

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

      if (action === "daily" && streakFuerClaim) {
        update.letzterDailyBonus = today;
        update.streakTage = streakFuerClaim.streakNeu;
        update.streakBest = streakFuerClaim.bestNeu;
        if (streakFuerClaim.freezeVerbraucht) {
          update.streakFreezeWoche = wochenSchluessel(today);
        }
        if (wocheNeu) update.streakWoche = wocheNeu;
        // Merker fürs Dashboard: was gab es extra (sonst null)?
        update.letzterDailyExtra =
          wochenBonus > 0
            ? "wochenbonus"
            : comebackFuerClaim > 0
              ? "comeback"
              : streakFuerClaim.freezeVerbraucht
                ? "freeze"
                : null;
      }
      if (action === "starter") {
        update.starterBonusGeholt = true;
      }
      if (action === "zitat") {
        update.letzterZitatBonus = today;
        update.zitatBonusCount = zitatHeute + 1;
      }

      await frisch.setClientReadOnlyMetadata({ ...frischeMeta, ...update });

      // Verlosungs-Los: exakter Monats-Zähler in Upstash (1× pro Daily-Tag).
      // Fail-open: Zählfehler kostet nie den Bonus – Rückfall ist der Verlauf.
      if (action === "daily") {
        try {
          await erhoeheLose(today.slice(0, 7), user.id);
        } catch {
          // Ignore – Verlauf springt bei der Ziehung ein.
        }
      }

      const nextDailyBonusDate =
        action === "daily"
          ? today
          : ((frischeMeta.letzterDailyBonus as string | undefined) ?? null);
      const nextQuoteCountToday =
        action === "zitat" ? zitatHeute + 1 : zitatHeute;

      return Response.json({
        punkte: newPoints,
        punkteGesamt: newTotal,
        delta,
        dailyAvailable: nextDailyBonusDate !== today,
        quoteAvailable: nextQuoteCountToday < 3,
        quoteRemaining: Math.max(0, 3 - nextQuoteCountToday),
        ...(streakFuerClaim
          ? {
              streakAktuell: streakFuerClaim.streakNeu,
              streakBest: streakFuerClaim.bestNeu,
              comeback: comebackFuerClaim > 0,
              freezeVerbraucht: streakFuerClaim.freezeVerbraucht,
              wochenBonus: wochenBonus > 0,
            }
          : {}),
      });
    });
  } catch (error) {
    if (istPunkteFehler(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (istSperreBelegtFehler(error)) {
      return Response.json(
        { error: "Bitte kurz warten und erneut versuchen." },
        { status: 409 },
      );
    }
    throw error;
  }
}
