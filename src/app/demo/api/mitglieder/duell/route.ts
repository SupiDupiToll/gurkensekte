/**
 * Gurken Duell – P2P-API (Demo-Modus).
 *
 * Gleiche Wartezimmer-Regeln wie der echte Mitgliederbereich, aber mit
 * Demo-Punkten aus dem Cookie-Speicher. Sessions, Präsenz und Challenges
 * liegen im Demo-Namensraum des Duell-Stores, damit Demo- und
 * Echtgeld-Töpfe nie vermischt werden.
 */

import { randomUUID } from "crypto";
import {
  DEMO_COOKIE_NAME,
  getDemoProfile,
  mitDemoCookie,
  parseDemoCookies,
  type DemoProfile,
} from "@/lib/demoStore";
import { pruefeTurnstile, turnstileFehltFehler } from "@/lib/turnstile";
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
  type OeffentlichesDuell,
} from "@/lib/duell";
import { duellStore, mitChallengeSperre, mitDuellSperre } from "@/lib/duellStore";

export const runtime = "nodejs";

const STORE_PREFIX = "gurken:demo:duell";
const store = duellStore(STORE_PREFIX);

function demoName(req: Request, fallbackId: string): string {
  const id = parseDemoCookies(req)[DEMO_COOKIE_NAME] ?? fallbackId;
  return `Demo-${id.slice(0, 4).toUpperCase()}`;
}

/**
 * Stellt sicher, dass die Demo-Identität ab dem allerersten Request stabil
 * ist: `getDemoProfile` vergibt neue Cookie-IDs intern, ohne sie
 * zurückzugeben – deshalb wird eine fehlende ID hier vorab erzeugt, in den
 * Request eingehängt und per Set-Cookie bestätigt.
 */
function mitDemoSitzung(
  req: Request,
  res: Response,
): { userId: string; profile: DemoProfile; req: Request } {
  let userId = parseDemoCookies(req)[DEMO_COOKIE_NAME];
  let effReq = req;
  if (!userId) {
    userId = randomUUID();
    const headers = new Headers(req.headers);
    const bisher = headers.get("cookie");
    headers.set(
      "cookie",
      bisher
        ? `${bisher}; ${DEMO_COOKIE_NAME}=${userId}`
        : `${DEMO_COOKIE_NAME}=${userId}`,
    );
    effReq = new Request(req, { headers });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.headers.set(
      "Set-Cookie",
      `${DEMO_COOKIE_NAME}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
    );
  }
  const profile = getDemoProfile(effReq, res);
  return { userId, profile, req: effReq };
}

type RaumAntwort = {
  gaeste: OeffentlicherGast[];
  eingehende: OeffentlicheChallenge[];
  ausgehende: OeffentlicheChallenge | null;
};

type SessionAntwort =
  | { session: OeffentlichesDuell }
  | { error: string; code?: string };

type ChallengeAntwort =
  | { challenge: OeffentlicheChallenge; session?: OeffentlichesDuell }
  | { error: string };

function antwort(
  res: Response,
  data: SessionAntwort | ChallengeAntwort | RaumAntwort | { error: string },
  status = 200,
): Response {
  return mitDemoCookie(Response.json(data, { status }), res);
}

export async function GET(req: Request) {
  const res = new Response();
  const { userId } = mitDemoSitzung(req, res);

  const params = new URL(req.url).searchParams;

  const challengeId = params.get("challenge")?.trim();
  if (challengeId) {
    const challenge = await mitChallengeSperre(
      STORE_PREFIX,
      challengeId,
      async () => {
        const gefunden = await store.challengeLesen(challengeId);
        if (!gefunden) return null;
        if (
          gefunden.von.userId !== userId &&
          gefunden.an.userId !== userId
        ) {
          return "fremd" as const;
        }
        if (wendeChallengeAblaufAn(gefunden)) {
          await store.challengeSpeichern(gefunden);
        }
        return gefunden;
      },
    );
    if (!challenge) return antwort(res, { error: "Anfrage nicht gefunden" }, 404);
    if (challenge === "fremd") {
      return antwort(res, { error: "Geht dich nichts an." }, 403);
    }
    return antwort(res, {
      challenge: oeffentlicheChallenge(challenge, userId),
    });
  }

  const id = params.get("id")?.trim();
  if (!id) return antwort(res, { error: "Session fehlt" }, 400);

  const session = await store.lesen(id);
  if (!session) return antwort(res, { error: "Duell nicht gefunden" }, 404);
  return antwort(res, { session: oeffentlichesDuell(session, userId) });
}

export async function POST(req: Request) {
  const res = new Response();
  const sitzung = mitDemoSitzung(req, res);
  const profile = sitzung.profile;
  const userId = sitzung.userId;
  req = sitzung.req;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return antwort(res, { error: "Ungültige Anfrage" }, 400);
  }
  const aktion = body.aktion as string | undefined;

  function abziehen(stake: number): { error: string } | null {
    if (profile.punkte < stake) {
      return {
        error: `Nicht genug Punkte – für dieses Duell brauchst du ${stake} Punkte.`,
      };
    }
    profile.punkte -= stake;
    profile.punkteVerlauf = profile.punkteVerlauf.slice(-9);
    profile.punkteVerlauf.push({
      datum: new Date().toISOString(),
      aktion: "duell-einsatz",
      punkte: -stake,
      saldo: profile.punkte,
    });
    return null;
  }

  function gutschrift(
    betrag: number,
    aktionstext: "duell-gewinn" | "duell-refund",
    xpDazu: number,
  ): void {
    profile.punkte += betrag;
    profile.punkteGesamt += xpDazu;
    profile.punkteVerlauf = profile.punkteVerlauf.slice(-9);
    profile.punkteVerlauf.push({
      datum: new Date().toISOString(),
      aktion: aktionstext,
      punkte: betrag,
      saldo: profile.punkte,
    });
  }

  async function captcha(): Promise<Response | null> {
    const pruefung = await pruefeTurnstile(req, {
      token: body.turnstileToken,
    });
    if (!pruefung.ok) {
      return antwort(res, turnstileFehltFehler(pruefung.grund), 403);
    }
    return null;
  }

  async function raumAnsicht(): Promise<RaumAntwort> {
    const gaesteRoh = await store.raumLesen();
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
        if (c.aktualisiertAm >= ausgehendAktualisiert) {
          ausgehendAktualisiert = c.aktualisiertAm;
          ausgehende = oeffentlicheChallenge(c, userId);
        }
      }
    }
    eingehende.sort((a, b) => a.erstelltAm - b.erstelltAm);
    return { gaeste, eingehende, ausgehende };
  }

  // --- raum (Heartbeat) ---
  if (aktion === "raum") {
    const name = saubererDuellName(body.name, demoName(req, userId));
    const avatar: DuellAvatar = saubererDuellAvatar(body.avatar);
    const stake =
      typeof body.stake === "number" && istGueltigerDuellEinsatz(body.stake)
        ? body.stake
        : 10;
    await store.praesenzMelden({
      userId,
      name,
      avatar,
      stake,
      aktualisiertAm: Date.now(),
    });
    return antwort(res, await raumAnsicht());
  }

  // --- herausfordern ---
  if (aktion === "herausfordern") {
    const captchaFehler = await captcha();
    if (captchaFehler) return captchaFehler;

    const zielUserId =
      typeof body.zielUserId === "string" ? body.zielUserId.trim() : "";
    if (!zielUserId) {
      return antwort(res, { error: "Wen willst du herausfordern?" }, 400);
    }
    if (zielUserId === userId) {
      return antwort(
        res,
        { error: "Du kannst dich nicht selbst herausfordern." },
        400,
      );
    }
    if (!istGueltigerDuellEinsatz(body.stake)) {
      return antwort(res, { error: "Ungültiger Einsatz" }, 400);
    }
    const stake = body.stake;
    const name = saubererDuellName(body.name, demoName(req, userId));
    const avatar: DuellAvatar = saubererDuellAvatar(body.avatar);

    const gaeste = await store.raumLesen();
    const ziel = gaeste.find((g) => g.userId === zielUserId);
    if (!ziel) {
      return antwort(
        res,
        { error: "Diese Gurke hat das Wartezimmer verlassen." },
        404,
      );
    }

    const beteiligt = await store.challengesFuer(userId);
    const offeneEigene = beteiligt.find(
      (c) => c.von.userId === userId && c.status === "offen",
    );
    if (offeneEigene) {
      if (wendeChallengeAblaufAn(offeneEigene)) {
        await store.challengeSpeichern(offeneEigene);
      } else {
        return antwort(
          res,
          {
            error:
              "Du hast schon eine offene Anfrage – warte auf Antwort oder storniere sie.",
          },
          400,
        );
      }
    }

    const fehler = abziehen(stake);
    if (fehler) return antwort(res, fehler, 400);

    const jetzt = Date.now();
    const challenge: DuellChallenge = {
      id: generiereDuellId(),
      von: { userId, name, avatar },
      an: { userId: ziel.userId, name: ziel.name },
      stake,
      status: "offen",
      sessionId: null,
      erstelltAm: jetzt,
      aktualisiertAm: jetzt,
      erstattetAn: [],
    };
    await store.challengeSpeichern(challenge);
    return antwort(res, {
      challenge: oeffentlicheChallenge(challenge, userId),
    });
  }

  // --- antwort / stornieren / challenge-claim (im Challenge-Lock) ---
  if (
    aktion === "antwort" ||
    aktion === "stornieren" ||
    aktion === "challenge-claim"
  ) {
    const challengeId =
      typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    if (!challengeId) return antwort(res, { error: "Anfrage fehlt" }, 400);

    if (aktion === "antwort") {
      const captchaFehler = await captcha();
      if (captchaFehler) return captchaFehler;
    }

    return mitChallengeSperre(STORE_PREFIX, challengeId, async () => {
      const live = await store.challengeLesen(challengeId);
      if (!live) return antwort(res, { error: "Anfrage nicht gefunden." }, 404);
      if (wendeChallengeAblaufAn(live)) {
        await store.challengeSpeichern(live);
      }

      if (aktion === "stornieren") {
        if (live.von.userId !== userId) {
          return antwort(res, { error: "Das ist nicht deine Anfrage." }, 403);
        }
        if (live.status !== "offen") {
          return antwort(
            res,
            { error: "Diese Anfrage ist schon entschieden." },
            400,
          );
        }
        live.status = "storniert";
        live.aktualisiertAm = Date.now();
        await store.challengeSpeichern(live);
        return antwort(res, {
          challenge: oeffentlicheChallenge(live, userId),
        });
      }

      if (aktion === "challenge-claim") {
        const anspruch = challengeAnspruch(live, userId);
        if (!anspruch) {
          return antwort(
            res,
            { error: "Für dich gibt es hier nichts abzuholen." },
            400,
          );
        }
        gutschrift(anspruch.betrag, "duell-refund", 0);
        live.erstattetAn.push(userId);
        live.aktualisiertAm = Date.now();
        await store.challengeSpeichern(live);
        return antwort(res, {
          challenge: oeffentlicheChallenge(live, userId),
        });
      }

      // antwort
      if (live.an.userId !== userId) {
        return antwort(res, { error: "Diese Anfrage gilt nicht dir." }, 403);
      }
      if (live.status !== "offen") {
        return antwort(
          res,
          { error: "Diese Anfrage ist schon entschieden." },
          400,
        );
      }
      if (body.annehmen !== true) {
        live.status = "abgelehnt";
        live.aktualisiertAm = Date.now();
        await store.challengeSpeichern(live);
        return antwort(res, {
          challenge: oeffentlicheChallenge(live, userId),
        });
      }
      const name = saubererDuellName(body.name, demoName(req, userId));
      const avatar: DuellAvatar = saubererDuellAvatar(body.avatar);
      const fehler = abziehen(live.stake);
      if (fehler) return antwort(res, fehler, 400);
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
          { userId, name, symbol: "O", avatar },
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
      return antwort(res, {
        challenge: oeffentlicheChallenge(live, userId),
        session: oeffentlichesDuell(session, userId),
      });
    });
  }

  // --- Session-Aktionen mit ID (alle im Session-Lock, frisch gelesen) ---
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) return antwort(res, { error: "Session fehlt" }, 400);
  return mitDuellSperre(STORE_PREFIX, sessionId, async () => {
    const session = await store.lesen(sessionId);
    if (!session) return antwort(res, { error: "Duell nicht gefunden" }, 404);

    if (aktion === "move") {
      const index = body.index;
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index > 8
      ) {
        return antwort(res, { error: "Ungültiges Feld" }, 400);
      }
      if (session.status !== "playing") {
        return antwort(res, { error: "Dieses Duell läuft gerade nicht." }, 400);
      }
      const ich = session.spieler.find((s) => s.userId === userId);
      if (!ich) {
        return antwort(
          res,
          { error: "Du spielst in diesem Duell nicht mit." },
          403,
        );
      }
      if (ich.symbol !== session.amZug) {
        return antwort(res, { error: "Dein Gegner ist am Zug." }, 400);
      }
      if (session.board[index] !== null) {
        return antwort(res, { error: "Dieses Feld ist schon belegt." }, 400);
      }
      session.board[index] = ich.symbol;
      session.letzterZug = index;
      const treffer = pruefeTicTacToe(session.board);
      if (treffer) {
        session.status = "finished";
        session.gewinner = treffer.gewinner;
        session.gewinnLinie = treffer.linie;
      } else if (istBrettVoll(session.board)) {
        session.status = "finished";
        session.gewinner = "draw";
      } else {
        session.amZug = session.amZug === "X" ? "O" : "X";
      }
      session.aktualisiertAm = Date.now();
      await store.speichern(session);
      return antwort(res, { session: oeffentlichesDuell(session, userId) });
    }

    if (aktion === "claim") {
      const anspruch = claimAnspruch(session, userId);
      if (!anspruch) {
        return antwort(
          res,
          { error: "Für dich gibt es hier nichts abzuholen." },
          400,
        );
      }
      if (anspruch.art === "pot") {
        // Wie im echten Bereich: Transfers zwischen Spielern geben Punkte,
        // aber keine XP (sonst XP-Farming per Selbstspiel).
        gutschrift(anspruch.betrag, "duell-gewinn", 0);
        session.ausgezahltAn = userId;
      } else {
        gutschrift(anspruch.betrag, "duell-refund", 0);
        session.erstattetAn.push(userId);
      }
      session.aktualisiertAm = Date.now();
      await store.speichern(session);
      return antwort(res, { session: oeffentlichesDuell(session, userId) });
    }

    if (aktion === "forfeit") {
      if (session.status !== "playing") {
        return antwort(res, { error: "Dieses Duell läuft gerade nicht." }, 400);
      }
      const ich = session.spieler.find((s) => s.userId === userId);
      if (!ich) {
        return antwort(
          res,
          { error: "Du spielst in diesem Duell nicht mit." },
          403,
        );
      }
      session.status = "finished";
      session.gewinner = ich.symbol === "X" ? "O" : "X";
      session.aktualisiertAm = Date.now();
      await store.speichern(session);
      return antwort(res, { session: oeffentlichesDuell(session, userId) });
    }

    if (aktion === "timeout") {
      if (session.status !== "playing") {
        return antwort(res, { error: "Dieses Duell läuft gerade nicht." }, 400);
      }
      const ich = session.spieler.find((s) => s.userId === userId);
      if (!ich) {
        return antwort(
          res,
          { error: "Du spielst in diesem Duell nicht mit." },
          403,
        );
      }
      if (ich.symbol === session.amZug) {
        return antwort(
          res,
          { error: "Du bist selbst am Zug – setze einfach." },
          400,
        );
      }
      if (!istZugTimeout(session)) {
        return antwort(
          res,
          { error: "Dein Gegner hat noch Bedenkzeit – warte kurz." },
          400,
        );
      }
      session.status = "finished";
      session.gewinner = ich.symbol;
      session.aktualisiertAm = Date.now();
      await store.speichern(session);
      return antwort(res, { session: oeffentlichesDuell(session, userId) });
    }

    return antwort(res, { error: "Unbekannte Aktion" }, 400);
  });
}
