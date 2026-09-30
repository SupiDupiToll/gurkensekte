/**
 * Gurken Duell – P2P-API (Demo-Modus).
 *
 * Gleiche Regeln wie der echte Mitgliederbereich, aber mit Demo-Punkten aus
 * dem Cookie-Speicher. Sessions liegen im Demo-Namensraum des Duell-Stores,
 * damit Demo- und Echtgeld-Töpfe nie vermischt werden.
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
  type OeffentlichesDuell,
} from "@/lib/duell";
import { duellStore, mitDuellSperre } from "@/lib/duellStore";

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

function antwort(
  res: Response,
  data: { session: OeffentlichesDuell } | { error: string; code?: string },
  status = 200,
): Response {
  return mitDemoCookie(Response.json(data, { status }), res);
}

export async function GET(req: Request) {
  const res = new Response();
  const { userId } = mitDemoSitzung(req, res);

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return antwort(res, { error: "Session fehlt" }, 400);

  const session = await store.lesen(id);
  if (!session) return antwort(res, { error: "Duell nicht gefunden" }, 404);
  if (wendeDuellAblaufAn(session)) await store.speichern(session);
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

  function abziehen(stake: number): Response | null {
    if (profile.punkte < stake) {
      return antwort(
        res,
        {
          error: `Nicht genug Punkte – für dieses Duell brauchst du ${stake} Punkte.`,
        },
        400,
      );
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

  // --- create ---
  if (aktion === "create") {
    const captchaFehler = await captcha();
    if (captchaFehler) return captchaFehler;
    if (!istGueltigerDuellEinsatz(body.stake)) {
      return antwort(res, { error: "Ungültiger Einsatz" }, 400);
    }
    const stake = body.stake;
    const fehler = abziehen(stake);
    if (fehler) return fehler;

    let code = generiereDuellCode();
    for (let i = 0; i < 3; i++) {
      if (!(await store.lesenNachCode(code))) break;
      code = generiereDuellCode();
    }
    const jetzt = Date.now();
    const name = saubererDuellName(body.name, demoName(req, userId));
    const session: DuellSession = {
      id: generiereDuellId(),
      code,
      stake,
      pot: stake * 2,
      status: "waiting",
      spieler: [{ userId, name, symbol: "X" }],
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
    return antwort(res, { session: oeffentlichesDuell(session, userId) });
  }

  // --- join-code / join-random ---
  // Ablauf pro Kandidat im Session-Lock: frisch lesen, prüfen, erst dann
  // abbuchen und beitreten. So kann kein paralleler Beitritt den anderen
  // überschreiben und keine Prüfung berührt je Geld.
  if (aktion === "join-code" || aktion === "join-random") {
    const captchaFehler = await captcha();
    if (captchaFehler) return captchaFehler;
    const name = saubererDuellName(body.name, demoName(req, userId));

    let ids: string[] = [];
    if (aktion === "join-code") {
      const code = normalisiereDuellCode(body.code);
      if (!code) {
        return antwort(
          res,
          { error: "Dieser Code sieht nicht gültig aus (6 Zeichen)." },
          400,
        );
      }
      const gefunden = await store.lesenNachCode(code);
      if (!gefunden) {
        return antwort(
          res,
          { error: "Kein Duell mit diesem Code gefunden." },
          404,
        );
      }
      if (gefunden.spieler.some((s) => s.userId === userId)) {
        return antwort(res, {
          session: oeffentlichesDuell(gefunden, userId),
        });
      }
      ids = [gefunden.id];
    } else {
      if (!istGueltigerDuellEinsatz(body.stake)) {
        return antwort(res, { error: "Ungültiger Einsatz" }, 400);
      }
      const kandidaten = await store.wartendeFinden(body.stake, userId);
      if (kandidaten.length === 0) {
        return antwort(
          res,
          {
            error:
              "Gerade kein offenes Duell mit diesem Einsatz – erstelle selbst einen Code und teile ihn.",
            code: "KEIN_GEGNER",
          },
          404,
        );
      }
      ids = kandidaten.map((k) => k.id);
    }

    let letzterFehler: string | null = null;
    for (const id of ids) {
      const versuch = await mitDuellSperre(STORE_PREFIX, id, async () => {
        const live = await store.lesen(id);
        if (!live) return { ok: false as const, error: "Duell nicht gefunden." };
        if (wendeDuellAblaufAn(live)) {
          await store.speichern(live);
          return { ok: false as const, error: "Dieses Duell ist abgelaufen." };
        }
        if (live.status !== "waiting") {
          return {
            ok: false as const,
            error: "Dieses Duell läuft schon oder ist vorbei.",
          };
        }
        if (live.spieler.some((s) => s.userId === userId)) {
          return {
            ok: false as const,
            error: "Du kannst nicht gegen dich selbst spielen.",
          };
        }
        const fehler = abziehen(live.stake);
        if (fehler) return { ok: false as const, fehler };
        live.spieler.push({ userId, name, symbol: "O" });
        live.status = "playing";
        live.aktualisiertAm = Date.now();
        await store.speichern(live);
        return { ok: true as const, live };
      });
      if (!versuch.ok) {
        if ("fehler" in versuch && versuch.fehler) return versuch.fehler;
        letzterFehler = versuch.error;
        continue;
      }
      return antwort(res, { session: oeffentlichesDuell(versuch.live, userId) });
    }
    return antwort(
      res,
      {
        error:
          letzterFehler ??
          "Die offenen Duelle wurden gerade vergeben – versuch es gleich nochmal oder erstelle selbst eins.",
        code: aktion === "join-random" ? "KEIN_GEGNER" : undefined,
      },
      404,
    );
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
      wendeDuellAblaufAn(session);
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
      wendeDuellAblaufAn(session);
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

    if (aktion === "cancel") {
      wendeDuellAblaufAn(session);
      const ersteller = session.spieler[0];
      if (!ersteller || ersteller.userId !== userId) {
        return antwort(res, { error: "Nur der Ersteller kann stornieren." }, 403);
      }
      if (session.status !== "waiting" && session.status !== "expired") {
        return antwort(
          res,
          { error: "Das Duell läuft schon – du kannst nur noch aufgeben." },
          400,
        );
      }
      session.status = "cancelled";
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
