/**
 * Gurken Duell – P2P-API (echte Mitglieder).
 *
 * Tic Tac Toe um Punkte-Einsätze: Beide setzen gleich, der Sieger holt den
 * Pot (2× Einsatz), bei Unentschieden gibt es Refunds. Der Server ist
 * Autorität für Brett, Zugfolge und Sieg – der Client schickt nur Wünsche.
 *
 * Geldfluss-Prinzip: Der Server bucht nie auf fremde Konten. Jeder zieht
 * seinen Einsatz per eigenem Request ab (create/join) und holt Gewinn oder
 * Refund per eigenem Claim-Request ab. Deshalb braucht ein beendetes Duell
 * immer einen Claim des Berechtigten.
 *
 * Aktionen (POST, `{ aktion, ... }`):
 * - create { stake, name } – Captcha, Einsatz abziehen, Code erzeugen
 * - join-code { code, name } – Captcha, Einsatz abziehen, Spiel starten
 * - join-random { stake, name } – Captcha, offenes Duell suchen + beitreten
 * - move { sessionId, index } – Zug setzen (rate-limitiert, ohne Captcha)
 * - claim { sessionId } – Pot oder Refund aufs eigene Konto buchen
 * - cancel { sessionId } – Ersteller storniert ein wartendes Duell
 * - forfeit { sessionId } – aufgeben, Gegner gewinnt (holt Pot per Claim)
 * - timeout { sessionId } – Sieg abholen, wenn der Gegner zu lange inaktiv ist
 *
 * GET `?id=` liefert die öffentliche Session-Ansicht (für Polling).
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
  claimAnspruch,
  generiereDuellCode,
  generiereDuellId,
  istBrettVoll,
  istGueltigerDuellEinsatz,
  istZugTimeout,
  leeresBrett,
  normalisiereDuellCode,
  oeffentlichesDuell,
  pruefeTicTacToe,
  saubererDuellName,
  wendeDuellAblaufAn,
  type DuellSession,
} from "@/lib/duell";
import { duellStore, mitDuellSperre } from "@/lib/duellStore";

export const runtime = "nodejs";

const STORE_PREFIX = "gurken:duell";
const store = duellStore(STORE_PREFIX);

const CREATE_LIMIT = 20;
const JOIN_LIMIT = 40;
const MOVE_LIMIT = 600;
const AKTION_LIMIT = 120;
const FENSTER_MS = 60 * 60 * 1000;

type RouteUser = {
  id: string;
  displayName?: string | null;
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

/** Polling: öffentliche Ansicht einer Session (mit lazy Ablauf-Prüfung). */
export async function GET(req: Request) {
  const userOderAntwort = await holeUser(req);
  if (userOderAntwort instanceof Response) return userOderAntwort;
  const user = userOderAntwort;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "Session fehlt" }, { status: 400 });
  }

  try {
    const session = await mitDuellSperre(STORE_PREFIX, id, async () => {
      const gefunden = await store.lesen(id);
      if (!gefunden) return null;
      if (wendeDuellAblaufAn(gefunden)) await store.speichern(gefunden);
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
      case "create":
        return await handleCreate(req, user, body);
      case "join-code":
        return await handleJoinCode(req, user, body);
      case "join-random":
        return await handleJoinRandom(req, user, body);
      case "move":
        return await handleMove(req, user, body);
      case "claim":
        return await handleClaim(req, user, body);
      case "cancel":
        return await handleCancel(req, user, body);
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

async function handleCreate(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const captchaFehler = await captchaPruefen(req, user.id, body.turnstileToken);
  if (captchaFehler) return captchaFehler;

  if (!istGueltigerDuellEinsatz(body.stake)) {
    return Response.json({ error: "Ungültiger Einsatz" }, { status: 400 });
  }
  const stake = body.stake;
  const name = saubererDuellName(
    body.name,
    user.displayName ?? "Gurkenfreund",
  );

  if (!(await rateLimit(`duell:create:${user.id}`, CREATE_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  await zieheEinsatzAb(req, user.id, stake);

  // Code-Kollision praktisch ausschließen (erneut würfeln bei Treffer).
  let code = generiereDuellCode();
  for (let i = 0; i < 3; i++) {
    if (!(await store.lesenNachCode(code))) break;
    code = generiereDuellCode();
  }

  const jetzt = Date.now();
  const session: DuellSession = {
    id: generiereDuellId(),
    code,
    stake,
    pot: stake * 2,
    status: "waiting",
    spieler: [{ userId: user.id, name, symbol: "X" }],
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
  return Response.json({ session: oeffentlichesDuell(session, user.id) });
}

/** Fügt den Aufrufer als O-Spieler hinzu. Nur mit frisch (im Lock) gelesener
 *  Session aufrufen – eine veraltete Kopie würde parallele Beitritte
 *  durchlassen und den ersten Beitretenden überschreiben. */
async function treteSessionBei(
  req: Request,
  userId: string,
  name: string,
  session: DuellSession,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (wendeDuellAblaufAn(session)) {
    await store.speichern(session);
    return { ok: false, error: "Dieses Duell ist abgelaufen.", status: 400 };
  }
  if (session.status !== "waiting") {
    return {
      ok: false,
      error: "Dieses Duell läuft schon oder ist vorbei.",
      status: 400,
    };
  }
  if (session.spieler.some((s) => s.userId === userId)) {
    return {
      ok: false,
      error: "Du kannst nicht gegen dich selbst spielen.",
      status: 400,
    };
  }
  // Erst nach bestandener Prüfung abziehen (im selben Lock): Eine
  // fehlgeschlagene Prüfung berührt nie Geld, ein Refund-Pfad entfällt.
  try {
    await zieheEinsatzAb(req, userId, session.stake);
  } catch (error) {
    if (istPunkteFehler(error)) {
      return { ok: false, error: error.message, status: error.status };
    }
    throw error;
  }
  session.spieler.push({ userId, name, symbol: "O" });
  session.status = "playing";
  session.aktualisiertAm = Date.now();
  await store.speichern(session);
  return { ok: true };
}

async function handleJoinCode(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const captchaFehler = await captchaPruefen(req, user.id, body.turnstileToken);
  if (captchaFehler) return captchaFehler;

  const code = normalisiereDuellCode(body.code);
  if (!code) {
    return Response.json(
      { error: "Dieser Code sieht nicht gültig aus (6 Zeichen)." },
      { status: 400 },
    );
  }
  const name = saubererDuellName(
    body.name,
    user.displayName ?? "Gurkenfreund",
  );

  if (!(await rateLimit(`duell:join:${user.id}`, JOIN_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const session = await store.lesenNachCode(code);
  if (!session) {
    return Response.json(
      { error: "Kein Duell mit diesem Code gefunden." },
      { status: 404 },
    );
  }
  if (session.spieler.some((s) => s.userId === user.id)) {
    return Response.json({
      session: oeffentlichesDuell(session, user.id),
    });
  }

  // Sperre pro Session-ID (der Code ändert sich nie, die ID ist stabil):
  // Drinnen wird frisch gelesen, damit parallele Beitritte serialisiert
  // werden – der zweite sieht dann `playing` statt der alten `waiting`-Kopie.
  const beigetreten = await mitDuellSperre(
    STORE_PREFIX,
    session.id,
    async () => {
      const live = (await store.lesen(session.id)) ?? session;
      return treteSessionBei(req, user.id, name, live);
    },
  );
  if (!beigetreten.ok) {
    return Response.json(
      { error: beigetreten.error },
      { status: beigetreten.status },
    );
  }

  const aktuell = (await store.lesen(session.id)) ?? session;
  return Response.json({ session: oeffentlichesDuell(aktuell, user.id) });
}

async function handleJoinRandom(
  req: Request,
  user: RouteUser,
  body: Record<string, unknown>,
) {
  const captchaFehler = await captchaPruefen(req, user.id, body.turnstileToken);
  if (captchaFehler) return captchaFehler;

  if (!istGueltigerDuellEinsatz(body.stake)) {
    return Response.json({ error: "Ungültiger Einsatz" }, { status: 400 });
  }
  const stake = body.stake;
  const name = saubererDuellName(
    body.name,
    user.displayName ?? "Gurkenfreund",
  );

  if (!(await rateLimit(`duell:join:${user.id}`, JOIN_LIMIT, FENSTER_MS))) {
    return rateLimitAntwort(FENSTER_MS);
  }

  const kandidaten = await store.wartendeFinden(stake, user.id);
  if (kandidaten.length === 0) {
    return Response.json(
      {
        error:
          "Gerade kein offenes Duell mit diesem Einsatz – erstelle selbst einen Code und teile ihn.",
        code: "KEIN_GEGNER",
      },
      { status: 404 },
    );
  }

  // Kein Abzug vor dem Lock: Erst wenn ein Kandidat wirklich passt, wird im
  // selben Lock geprüft + abgebucht + beigetreten. Scheitern alle, wurde nie
  // Geld berührt – ein Refund-Pfad entfällt komplett.
  let letzterFehler: string | null = null;
  for (const kandidat of kandidaten) {
    const frisch = await mitDuellSperre(
      STORE_PREFIX,
      kandidat.id,
      async () => {
        const live = (await store.lesen(kandidat.id)) ?? kandidat;
        return {
          ergebnis: await treteSessionBei(req, user.id, name, live),
          live,
        };
      },
    );
    if (frisch.ergebnis.ok) {
      return Response.json({
        session: oeffentlichesDuell(frisch.live, user.id),
      });
    }
    letzterFehler = frisch.ergebnis.error;
  }

  return Response.json(
    {
      error:
        letzterFehler ??
        "Die offenen Duelle wurden gerade vergeben – versuch es gleich nochmal oder erstelle selbst eins.",
      code: "KEIN_GEGNER",
    },
    { status: 404 },
  );
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
    wendeDuellAblaufAn(live);
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
    wendeDuellAblaufAn(live);
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

async function handleCancel(
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
    wendeDuellAblaufAn(live);
    const ersteller = live.spieler[0];
    if (!ersteller || ersteller.userId !== user.id) {
      throw new PunkteFehler(403, "Nur der Ersteller kann stornieren.");
    }
    if (live.status !== "waiting" && live.status !== "expired") {
      throw new PunkteFehler(
        400,
        "Das Duell läuft schon – du kannst nur noch aufgeben.",
      );
    }
    live.status = "cancelled";
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
