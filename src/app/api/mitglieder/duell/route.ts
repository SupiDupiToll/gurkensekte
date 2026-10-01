/**
 * Gurken Duell – P2P-API (echte Mitglieder).
 *
 * Wartezimmer-Prinzip: Wer die Duell-Seite öffnet, nimmt mit Gurken-Avatar
 * und Namen im Wartezimmer Platz (Heartbeat-Präsenz via `raum`). Per Klick
 * auf eine andere Gurke schickt man eine Herausforderung (`herausfordern`)
 * mit festem Einsatz – der Einsatz wird dabei sofort vom eigenen Konto
 * abgezogen. Die andere Seite sieht die Anfrage und nimmt an (`antwort`):
 * Dabei zieht sie ihren Einsatz per eigenem Request ab und das Spiel
 * startet sofort. Wer gewinnt, holt den Pot (2× Einsatz) per Claim,
 * bei Unentschieden gibt es Refunds. Abgelehnte/abgelaufene/stornierte
 * Challenges erstattet der Herausforderer per `challenge-claim`.
 *
 * Geldfluss-Prinzip: Der Server bucht nie auf fremde Konten. Jeder zahlt
 * nur per eigenem Request (Herausforderung senden, Anfrage annehmen,
 * Gewinn/Refund abholen).
 *
 * Aktionen (POST, `{ aktion, ... }`):
 * - raum { name, avatar, stake } – Heartbeat + Gäste + eigene Challenges
 * - herausfordern { zielUserId, stake, name, avatar } – Captcha, Einsatz abziehen
 * - antwort { challengeId, annehmen, name, avatar } – ggf. Einsatz abziehen + Spiel starten
 * - stornieren { challengeId } – eigene offene Anfrage zurückziehen
 * - challenge-claim { challengeId } – Einsatz bei Ablehnung/Ablauf zurückholen
 * - move { sessionId, index } – Zug setzen (rate-limitiert, ohne Captcha)
 * - claim { sessionId } – Pot oder Refund aufs eigene Konto buchen
 * - forfeit { sessionId } – aufgeben, Gegner gewinnt (holt Pot per Claim)
 * - timeout { sessionId } – Sieg abholen, wenn der Gegner zu lange inaktiv ist
 *
 * GET `?id=` liefert die Session-Ansicht, `?challenge=` eine Challenge.
 */

import { hexclaveServerApp } from "@/hexclave/server";
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
import {
  challengeAnspruch,
  claimAnspruch,
  generiereDuellId,
  istBrettVoll,
  istGueltigerDuellEinsatz,
  istZugTimeout,
  leeresBrett,
  oeffentlicheChallenge,
  oeffentlichesDuell,
  pruefeTicTacToe,
  saubererDuellAvatar,
  saubererDuellName,
  wendeChallengeAblaufAn,
  type DuellAvatar,
  type DuellChallenge,
  type DuellSession,
  type OeffentlicheChallenge,
  type OeffentlicherGast,
} from "@/lib/duell";
import { duellStore, mitChallengeSperre, mitDuellSperre } from "@/lib/duellStore";
import { leseBenutzername } from "@/lib/benutzername";

export const runtime = "nodejs";

const STORE_PREFIX = "gurken:duell";
const store = duellStore(STORE_PREFIX);

const RAUM_LIMIT = 1000;
const CHALLENGE_LIMIT = 30;
const MOVE_LIMIT = 600;
const AKTION_LIMIT = 120;
const FENSTER_MS = 60 * 60 * 1000;

type RouteUser = {
  id: string;
  displayName?: string | null;
  clientReadOnlyMetadata?: Record<string, unknown>;
};

async function holeUser(req: Request): Promise<RouteUser | Response> {
  const user = await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  return user as RouteUser;
}

/**
 * Anzeigename im Duell: bevorzugt der eindeutige Benutzername (falls schon
 * vergeben), sonst der frei wählbare Profilname mit DisplayName-Fallback.
 * Der Server ist maßgeblich – der Client kann keinen fremden Namen setzen.
 */
function duellAnzeigename(user: RouteUser, wunsch: unknown): string {
  const benutzername = leseBenutzername(
    (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>,
  );
  if (benutzername) return benutzername;
  return saubererDuellName(wunsch, user.displayName ?? "Gurkenfreund");
}

/** Zieht den Einsatz vom eigenen Konto ab (TOCTOU-sicher im Lock). */
async function zieheEinsatzAb(
  req: Request,
  userId: string,
  stake: number,
): Promise<void> {
  await mitFrischemBenutzer(req, userId, async (frisch, meta) => {
    const stand = lesePunkte(meta);
    if (stand < stake) {
      throw new PunkteFehler(
        400,
        `Nicht genug Punkte – für dieses Duell brauchst du ${stake} Punkte.`,
      );
    }
    const newPoints = stand - stake;
    const verlauf = leseVerlauf(meta).slice(-9);
    verlauf.push({
      datum: new Date().toISOString(),
      aktion: "duell-einsatz",
      punkte: -stake,
      saldo: newPoints,
    });
    await frisch.setClientReadOnlyMetadata({
      ...meta,
      punkte: newPoints,
      punkteVerlauf: verlauf,
    });
  });
}

/**
 * Bucht Pot oder Refund aufs eigene Konto. Refunds stellen nur den alten
 * Stand wieder her (keine XP), Pot-Gewinne sind Transfers zwischen Spielern
 * (ebenfalls keine XP – siehe handleClaim).
 */
async function schreibeGutschrift(
  req: Request,
  userId: string,
  betrag: number,
  aktion: "duell-gewinn" | "duell-refund",
  xpDazu: number,
): Promise<void> {
  await mitFrischemBenutzer(req, userId, async (frisch, meta) => {
    const stand = lesePunkte(meta);
    const newPoints = stand + betrag;
    const newTotal = lesePunkteGesamt(meta, stand) + xpDazu;
    const verlauf = leseVerlauf(meta).slice(-9);
    verlauf.push({
      datum: new Date().toISOString(),
      aktion,
      punkte: betrag,
      saldo: newPoints,
    });
    await frisch.setClientReadOnlyMetadata({
      ...meta,
      punkte: newPoints,
      punkteGesamt: newTotal,
      punkteVerlauf: verlauf,
    });
  });
}

function punkteFehlerAntwort(error: unknown): Response | null {
  if (istPunkteFehler(error)) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (istSperreBelegtFehler(error)) {
    return Response.json(
      { error: "Bitte kurz warten und erneut versuchen." },
      { status: 409 },
    );
  }
  return null;
}

/** Polling: Session- oder Challenge-Ansicht (mit lazy Ablauf-Prüfung). */
export async function GET(req: Request) {
  const userOderAntwort = await holeUser(req);
  if (userOderAntwort instanceof Response) return userOderAntwort;
  const user = userOderAntwort;

  const params = new URL(req.url).searchParams;

  const challengeId = params.get("challenge")?.trim();
  if (challengeId) {
    try {
      const challenge = await mitChallengeSperre(
        STORE_PREFIX,
        challengeId,
        async () => {
          const gefunden = await store.challengeLesen(challengeId);
          if (!gefunden) return null;
          if (
            gefunden.von.userId !== user.id &&
            gefunden.an.userId !== user.id
          ) {
            return "fremd" as const;
          }
          if (wendeChallengeAblaufAn(gefunden)) {
            await store.challengeSpeichern(gefunden);
          }
          return gefunden;
        },
      );
      if (!challenge) {
        return Response.json(
          { error: "Anfrage nicht gefunden" },
          { status: 404 },
        );
      }
      if (challenge === "fremd") {
        return Response.json({ error: "Geht dich nichts an." }, { status: 403 });
      }
      return Response.json({
        challenge: oeffentlicheChallenge(challenge, user.id),
      });
    } catch (error) {
      const bekannt = punkteFehlerAntwort(error);
      if (bekannt) return bekannt;
      throw error;
    }
  }

  const id = params.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "Session fehlt" }, { status: 400 });
  }

  try {
    const session = await mitDuellSperre(STORE_PREFIX, id, async () => {
      const gefunden = await store.lesen(id);
      if (!gefunden) return null;
      return gefunden;
    });
    if (!session) {
      return Response.json({ error: "Duell nicht gefunden" }, { status: 404 });
    }
    return Response.json({ session: oeffentlichesDuell(session, user.id) });
  } catch (error) {
    const bekannt = punkteFehlerAntwort(error);
    if (bekannt) return bekannt;
    throw error;
  }
}

export async function POST(req: Request) {
  const userOderAntwort = await holeUser(req);
  if (userOderAntwort instanceof Response) return userOderAntwort;
  const user = userOderAntwort;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const aktion = body.aktion as string | undefined;

  try {
    switch (aktion) {
      case "raum":
        return await handleRaum(req, user, body);
      case "herausfordern":
        return await handleHerausfordern(req, user, body);
      case "antwort":
        return await handleAntwort(req, user, body);
      case "stornieren":
        return await handleStornieren(req, user, body);
      case "challenge-claim":
        return await handleChallengeClaim(req, user, body);
      case "move":
        return await handleMove(req, user, body);
      case "claim":
        return await handleClaim(req, user, body);
      case "forfeit":
        return await handleForfeit(req, user, body);
      case "timeout":
        return await handleTimeout(req, user, body);
      default:
        return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    const bekannt = punkteFehlerAntwort(error);
    if (bekannt) return bekannt;
    throw error;
  }
}

async function captchaPruefen(
  req: Request,
  userId: string,
  token: unknown,
): Promise<Response | null> {
  const captcha = await pruefeTurnstile(req, { token, userId });
  if (!captcha.ok) {
    return Response.json(turnstileFehltFehler(captcha.grund), { status: 403 });
  }
  return null;
}

type RaumAntwort = {
  gaeste: OeffentlicherGast[];
  eingehende: OeffentlicheChallenge[];
  ausgehende: OeffentlicheChallenge | null;
};

async function raumAnsicht(userId: string): Promise<RaumAntwort> {
  const gaesteRoh = await store.raumLesen();
  // Stabile Reihenfolge: eigene Gurke zuerst, Rest nach Name.
  const sortiert = [...gaesteRoh].sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );
  const gaeste: OeffentlicherGast[] = sortiert.map((g) => ({
    userId: g.userId,
    name: g.name,
    avatar: g.avatar,
    stake: g.stake,
    ich: g.userId === userId,
  }));
  // Eigene Gurke immer vorne.
  gaeste.sort((a, b) => Number(b.ich) - Number(a.ich));

  const beteiligt = await store.challengesFuer(userId);
  const eingehende: OeffentlicheChallenge[] = [];
  let ausgehende: OeffentlicheChallenge | null = null;
  let ausgehendAktualisiert = 0;
  for (const c of beteiligt) {
    if (c.an.userId === userId && c.status === "offen") {
      if (wendeChallengeAblaufAn(c)) {
        await store.challengeSpeichern(c);
        continue;
      }
      eingehende.push(oeffentlicheChallenge(c, userId));
    } else if (c.von.userId === userId) {
      if (c.status === "offen" && wendeChallengeAblaufAn(c)) {
        await store.challengeSpeichern(c);
      }
      // Neueste ausgehende Anfrage des Nutzers (für Status + Refund).
      if (c.aktualisiertAm >= ausgehendAktualisiert) {
        ausgehendAktualisiert = c.aktualisiertAm;
        ausgehende = oeffentlicheChallenge(c, userId);
      }
    }
  }
  eingehende.sort((a, b) => a.erstelltAm - b.erstelltAm);
  return { gaeste, eingehende, ausgehende };
}

/**
 * Heartbeat: meldet die eigene Gurke im Wartezimmer anwesend und liefert
 * Gäste, eingehende Anfragen und die eigene ausgehende Anfrage zurück.
 */
async function handleRaum(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const name = duellAnzeigename(user, body.name);
  const avatar: DuellAvatar = saubererDuellAvatar(body.avatar);
  const stake =
    typeof body.stake === "number" && istGueltigerDuellEinsatz(body.stake)
      ? body.stake
      : 10;

  if (!(await rateLimit(`duell:raum:${user.id}`, RAUM_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  await store.praesenzMelden({
    userId: user.id,
    name,
    avatar,
    stake,
    aktualisiertAm: Date.now(),
  });
  return Response.json(await raumAnsicht(user.id));
}

/**
 * Herausforderung senden: Captcha, Ziel prüfen (anwesend, nicht man selbst,
 * keine offene eigene Anfrage), eigenen Einsatz abziehen, Challenge anlegen.
 */
async function handleHerausfordern(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const captchaFehler = await captchaPruefen(req, user.id, body.turnstileToken);
  if (captchaFehler) return captchaFehler;

  const zielUserId =
    typeof body.zielUserId === "string" ? body.zielUserId.trim() : "";
  if (!zielUserId) {
    return Response.json({ error: "Wen willst du herausfordern?" }, { status: 400 });
  }
  if (zielUserId === user.id) {
    return Response.json(
      { error: "Du kannst dich nicht selbst herausfordern." },
      { status: 400 },
    );
  }
  if (!istGueltigerDuellEinsatz(body.stake)) {
    return Response.json({ error: "Ungültiger Einsatz" }, { status: 400 });
  }
  const stake = body.stake;
  const name = duellAnzeigename(user, body.name);
  const avatar: DuellAvatar = saubererDuellAvatar(body.avatar);

  if (
    !(await rateLimit(`duell:challenge:${user.id}`, CHALLENGE_LIMIT, FENSTER_MS))
  ) {
    return rateLimitAntwort(FENSTER_MS);
  }

  // Ziel muss gerade wirklich im Wartezimmer sitzen.
  const gaeste = await store.raumLesen();
  const ziel = gaeste.find((g) => g.userId === zielUserId);
  if (!ziel) {
    return Response.json(
      { error: "Diese Gurke hat das Wartezimmer verlassen." },
      { status: 404 },
    );
  }

  // Eine offene eigene Anfrage genügt – erst beantworten lassen oder stornieren.
  const beteiligt = await store.challengesFuer(user.id);
  const offeneEigene = beteiligt.find(
    (c) => c.von.userId === user.id && c.status === "offen",
  );
  if (offeneEigene) {
    if (wendeChallengeAblaufAn(offeneEigene)) {
      await store.challengeSpeichern(offeneEigene);
    } else {
      return Response.json(
        { error: "Du hast schon eine offene Anfrage – warte auf Antwort oder storniere sie." },
        { status: 400 },
      );
    }
  }

  // Erst nach bestandener Prüfung abziehen: Eine fehlgeschlagene Prüfung
  // berührt nie Geld, ein Refund-Pfad entfällt.
  try {
    await zieheEinsatzAb(req, user.id, stake);
  } catch (error) {
    if (istPunkteFehler(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const jetzt = Date.now();
  const challenge: DuellChallenge = {
    id: generiereDuellId(),
    von: { userId: user.id, name, avatar },
    an: { userId: ziel.userId, name: ziel.name },
    stake,
    status: "offen",
    sessionId: null,
    erstelltAm: jetzt,
    aktualisiertAm: jetzt,
    erstattetAn: [],
  };
  await store.challengeSpeichern(challenge);
  return Response.json({
    challenge: oeffentlicheChallenge(challenge, user.id),
  });
}

type AntwortErgebnis =
  | { ok: true; challenge: OeffentlicheChallenge; session?: never }
  | {
      ok: true;
      challenge: OeffentlicheChallenge;
      session: ReturnType<typeof oeffentlichesDuell>;
    }
  | { ok: false; error: string; status: number };

/**
 * Anfrage beantworten: Ablehnen kostet nichts, Annehmen zieht den eigenen
 * Einsatz ab (eigener Request) und startet das Spiel sofort – im selben
 * Challenge-Lock, damit keine Doppel-Annahme möglich ist.
 */
async function handleAntwort(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const captchaFehler = await captchaPruefen(req, user.id, body.turnstileToken);
  if (captchaFehler) return captchaFehler;

  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId.trim() : "";
  if (!challengeId) {
    return Response.json({ error: "Anfrage fehlt" }, { status: 400 });
  }
  const annehmen = body.annehmen === true;
  const name = duellAnzeigename(user, body.name);
  const avatar: DuellAvatar = saubererDuellAvatar(body.avatar);

  if (!(await rateLimit(`duell:aktion:${user.id}`, AKTION_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const ergebnis: AntwortErgebnis = await mitChallengeSperre(
    STORE_PREFIX,
    challengeId,
    async (): Promise<AntwortErgebnis> => {
      const live = await store.challengeLesen(challengeId);
      if (!live) {
        return { ok: false, error: "Anfrage nicht gefunden.", status: 404 };
      }
      if (wendeChallengeAblaufAn(live)) {
        await store.challengeSpeichern(live);
        return { ok: false, error: "Diese Anfrage ist abgelaufen.", status: 400 };
      }
      if (live.an.userId !== user.id) {
        return { ok: false, error: "Diese Anfrage gilt nicht dir.", status: 403 };
      }
      if (live.status !== "offen") {
        return { ok: false, error: "Diese Anfrage ist schon entschieden.", status: 400 };
      }
      if (!annehmen) {
        live.status = "abgelehnt";
        live.aktualisiertAm = Date.now();
        await store.challengeSpeichern(live);
        return {
          ok: true,
          challenge: oeffentlicheChallenge(live, user.id),
        };
      }
      // Annehmen: erst abziehen (eigener Request, frischer Lock), dann Spiel anlegen.
      try {
        await zieheEinsatzAb(req, user.id, live.stake);
      } catch (error) {
        if (istPunkteFehler(error)) {
          return { ok: false, error: error.message, status: error.status };
        }
        throw error;
      }
      const jetzt = Date.now();
      const session: DuellSession = {
        id: generiereDuellId(),
        stake: live.stake,
        pot: live.stake * 2,
        status: "playing",
        spieler: [
          {
            userId: live.von.userId,
            name: live.von.name,
            symbol: "X",
            avatar: live.von.avatar,
          },
          { userId: user.id, name, symbol: "O", avatar },
        ],
        board: leeresBrett(),
        amZug: "X",
        gewinner: null,
        gewinnLinie: null,
        letzterZug: null,
        erstelltAm: jetzt,
        aktualisiertAm: jetzt,
        ausgezahltAn: null,
        erstattetAn: [],
      };
      await store.speichern(session);
      live.status = "angenommen";
      live.sessionId = session.id;
      live.aktualisiertAm = jetzt;
      await store.challengeSpeichern(live);
      return {
        ok: true,
        challenge: oeffentlicheChallenge(live, user.id),
        session: oeffentlichesDuell(session, user.id),
      };
    },
  );

  if (!ergebnis.ok) {
    return Response.json({ error: ergebnis.error }, { status: ergebnis.status });
  }
  return Response.json(ergebnis);
}

/** Eigene offene Anfrage zurückziehen (Refund per challenge-claim). */
async function handleStornieren(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId.trim() : "";
  if (!challengeId) {
    return Response.json({ error: "Anfrage fehlt" }, { status: 400 });
  }

  if (!(await rateLimit(`duell:aktion:${user.id}`, AKTION_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const challenge = await mitChallengeSperre(
    STORE_PREFIX,
    challengeId,
    async () => {
      const live = await store.challengeLesen(challengeId);
      if (!live) throw new PunkteFehler(404, "Anfrage nicht gefunden");
      if (live.von.userId !== user.id) {
        throw new PunkteFehler(403, "Das ist nicht deine Anfrage.");
      }
      wendeChallengeAblaufAn(live);
      if (live.status !== "offen") {
        throw new PunkteFehler(400, "Diese Anfrage ist schon entschieden.");
      }
      live.status = "storniert";
      live.aktualisiertAm = Date.now();
      await store.challengeSpeichern(live);
      return live;
    },
  );

  return Response.json({
    challenge: oeffentlicheChallenge(challenge, user.id),
  });
}

/**
 * Challenge-Refund für den Herausforderer bei Ablehnung, Ablauf oder
 * Storno – idempotent per erstattetAn, immer im Challenge-Lock.
 */
async function handleChallengeClaim(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId.trim() : "";
  if (!challengeId) {
    return Response.json({ error: "Anfrage fehlt" }, { status: 400 });
  }

  if (!(await rateLimit(`duell:aktion:${user.id}`, AKTION_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const challenge = await mitChallengeSperre(
    STORE_PREFIX,
    challengeId,
    async () => {
      const live = await store.challengeLesen(challengeId);
      if (!live) throw new PunkteFehler(404, "Anfrage nicht gefunden");
      wendeChallengeAblaufAn(live);
      const anspruch = challengeAnspruch(live, user.id);
      if (!anspruch) {
        throw new PunkteFehler(400, "Für dich gibt es hier nichts abzuholen.");
      }
      await schreibeGutschrift(req, user.id, anspruch.betrag, "duell-refund", 0);
      live.erstattetAn.push(user.id);
      live.aktualisiertAm = Date.now();
      await store.challengeSpeichern(live);
      return live;
    },
  );

  return Response.json({
    challenge: oeffentlicheChallenge(challenge, user.id),
  });
}

async function handleMove(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : null;
  const index = body.index;
  if (!sessionId) {
    return Response.json({ error: "Session fehlt" }, { status: 400 });
  }
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8
  ) {
    return Response.json({ error: "Ungültiges Feld" }, { status: 400 });
  }

  if (!(await rateLimit(`duell:move:${user.id}`, MOVE_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const session = await mitDuellSperre(STORE_PREFIX, sessionId, async () => {
    const live = await store.lesen(sessionId);
    if (!live) throw new PunkteFehler(404, "Duell nicht gefunden");
    if (live.status !== "playing") {
      throw new PunkteFehler(400, "Dieses Duell läuft gerade nicht.");
    }
    const ich = live.spieler.find((s) => s.userId === user.id);
    if (!ich) throw new PunkteFehler(403, "Du spielst in diesem Duell nicht mit.");
    if (ich.symbol !== live.amZug) {
      throw new PunkteFehler(400, "Dein Gegner ist am Zug.");
    }
    if (live.board[index] !== null) {
      throw new PunkteFehler(400, "Dieses Feld ist schon belegt.");
    }
    live.board[index] = ich.symbol;
    live.letzterZug = index;
    const treffer = pruefeTicTacToe(live.board);
    if (treffer) {
      live.status = "finished";
      live.gewinner = treffer.gewinner;
      live.gewinnLinie = treffer.linie;
    } else if (istBrettVoll(live.board)) {
      live.status = "finished";
      live.gewinner = "draw";
    } else {
      live.amZug = live.amZug === "X" ? "O" : "X";
    }
    live.aktualisiertAm = Date.now();
    await store.speichern(live);
    return live;
  });

  return Response.json({ session: oeffentlichesDuell(session, user.id) });
}

async function handleClaim(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) {
    return Response.json({ error: "Session fehlt" }, { status: 400 });
  }

  if (!(await rateLimit(`duell:aktion:${user.id}`, AKTION_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const session = await mitDuellSperre(STORE_PREFIX, sessionId, async () => {
    const live = await store.lesen(sessionId);
    if (!live) throw new PunkteFehler(404, "Duell nicht gefunden");
    const anspruch = claimAnspruch(live, user.id);
    if (!anspruch) {
      throw new PunkteFehler(400, "Für dich gibt es hier nichts abzuholen.");
    }
    if (anspruch.art === "pot") {
      // Reiner Transfer zwischen Spielern: Der Pot wandert von einem Glas
      // ins andere, deshalb gibt es Punkte, aber keine XP. Sonst könnte man
      // mit zwei Konten risikolos XP farmen (Nullsummenspiel + XP wäre eine
      // Gelddruckmaschine für die Rangliste).
      await schreibeGutschrift(
        req,
        user.id,
        anspruch.betrag,
        "duell-gewinn",
        0,
      );
      live.ausgezahltAn = user.id;
    } else {
      await schreibeGutschrift(req, user.id, anspruch.betrag, "duell-refund", 0);
      live.erstattetAn.push(user.id);
    }
    live.aktualisiertAm = Date.now();
    await store.speichern(live);
    return live;
  });

  return Response.json({ session: oeffentlichesDuell(session, user.id) });
}

async function handleForfeit(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) {
    return Response.json({ error: "Session fehlt" }, { status: 400 });
  }

  if (!(await rateLimit(`duell:aktion:${user.id}`, AKTION_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const session = await mitDuellSperre(STORE_PREFIX, sessionId, async () => {
    const live = await store.lesen(sessionId);
    if (!live) throw new PunkteFehler(404, "Duell nicht gefunden");
    if (live.status !== "playing") {
      throw new PunkteFehler(400, "Dieses Duell läuft gerade nicht.");
    }
    const ich = live.spieler.find((s) => s.userId === user.id);
    if (!ich) throw new PunkteFehler(403, "Du spielst in diesem Duell nicht mit.");
    live.status = "finished";
    live.gewinner = ich.symbol === "X" ? "O" : "X";
    live.aktualisiertAm = Date.now();
    await store.speichern(live);
    return live;
  });

  return Response.json({ session: oeffentlichesDuell(session, user.id) });
}

async function handleTimeout(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) {
    return Response.json({ error: "Session fehlt" }, { status: 400 });
  }

  if (!(await rateLimit(`duell:aktion:${user.id}`, AKTION_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const session = await mitDuellSperre(STORE_PREFIX, sessionId, async () => {
    const live = await store.lesen(sessionId);
    if (!live) throw new PunkteFehler(404, "Duell nicht gefunden");
    if (live.status !== "playing") {
      throw new PunkteFehler(400, "Dieses Duell läuft gerade nicht.");
    }
    const ich = live.spieler.find((s) => s.userId === user.id);
    if (!ich) throw new PunkteFehler(403, "Du spielst in diesem Duell nicht mit.");
    if (ich.symbol === live.amZug) {
      throw new PunkteFehler(400, "Du bist selbst am Zug – setze einfach.");
    }
    if (!istZugTimeout(live)) {
      throw new PunkteFehler(
        400,
        "Dein Gegner hat noch Bedenkzeit – warte kurz.",
      );
    }
    live.status = "finished";
    live.gewinner = ich.symbol;
    live.aktualisiertAm = Date.now();
    await store.speichern(live);
    return live;
  });

  return Response.json({ session: oeffentlichesDuell(session, user.id) });
}
