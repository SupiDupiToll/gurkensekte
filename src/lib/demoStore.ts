import { randomUUID } from "crypto";
import type { GurkenAdresse } from "@/lib/bestellung";

/**
 * In-Memory-Speicher der Demo-Sitzungen.
 *
 * Die Demo-Punkte-API und die Demo-Rangliste teilen sich diesen Store, damit
 * beide dieselben Punkte desselben Cookies sehen.
 */
export type DemoVerlaufEintrag = {
  datum: string;
  aktion: string;
  punkte: number;
  saldo: number;
};

export type DemoProfile = {
  punkte: number;
  /** Je gesammelte Punkte – sinkt nie, auch nicht beim Einlösen. */
  punkteGesamt: number;
  letzterDailyBonus: string | null;
  letzterZitatBonus: string | null;
  zitatBonusCount: number;
  punkteVerlauf: DemoVerlaufEintrag[];
  /** Lieferadresse der letzten Gurken-Bestellung – Adresse ist Pflicht. */
  gurkenAdresse?: GurkenAdresse;
};

export const DEMO_COOKIE_NAME = "gurken_demo";

const stores = new Map<string, DemoProfile>();

export function parseDemoCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(
      part.slice(idx + 1).trim(),
    );
  }
  return cookies;
}

export function getDemoProfile(req: Request, res: Response): DemoProfile {
  let id = parseDemoCookies(req)[DEMO_COOKIE_NAME];
  if (!id) {
    id = randomUUID();
    res.headers.set(
      "Set-Cookie",
      `${DEMO_COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    );
  }
  let profile = stores.get(id);
  if (!profile) {
    profile = {
      punkte: 0,
      punkteGesamt: 0,
      letzterDailyBonus: null,
      letzterZitatBonus: null,
      zitatBonusCount: 0,
      punkteVerlauf: [],
    };
    stores.set(id, profile);
    if (stores.size > 1000) {
      const oldest = stores.keys().next().value;
      if (oldest !== undefined) stores.delete(oldest);
    }
  }
  return profile;
}

/** Hängt einen gesetzten Demo-Cookie an eine fertige Antwort an. */
export function mitDemoCookie(json: Response, res: Response): Response {
  const cookie = res.headers.get("Set-Cookie");
  if (cookie) json.headers.set("Set-Cookie", cookie);
  return json;
}
