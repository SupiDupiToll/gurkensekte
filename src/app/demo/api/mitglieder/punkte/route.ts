import { randomUUID } from "crypto";

const POINTS = {
  zitat: 5,
  chat: 3,
  daily: 20,
  einloesen: -300,
} as const;

type Action = keyof typeof POINTS;

type VerlaufEintrag = {
  datum: string;
  aktion: string;
  punkte: number;
  saldo: number;
};

type DemoProfile = {
  punkte: number;
  letzterDailyBonus: string | null;
  punkteVerlauf: VerlaufEintrag[];
};

const COOKIE_NAME = "gurken_demo";
const stores = new Map<string, DemoProfile>();

function parseCookies(req: Request): Record<string, string> {
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

function getProfile(req: Request, res: Response): DemoProfile {
  let id = parseCookies(req)[COOKIE_NAME];
  if (!id) {
    id = randomUUID();
    res.headers.set(
      "Set-Cookie",
      `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    );
  }
  let profile = stores.get(id);
  if (!profile) {
    profile = { punkte: 0, letzterDailyBonus: null, punkteVerlauf: [] };
    stores.set(id, profile);
    if (stores.size > 1000) {
      const oldest = stores.keys().next().value;
      if (oldest !== undefined) stores.delete(oldest);
    }
  }
  return profile;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const res = new Response();
  const profile = getProfile(req, res);
  const today = new Date().toISOString().split("T")[0];

  const json = Response.json({
    punkte: profile.punkte,
    dailyAvailable: profile.letzterDailyBonus !== today,
    verlauf: profile.punkteVerlauf,
  });
  const cookie = res.headers.get("Set-Cookie");
  if (cookie) {
    json.headers.set("Set-Cookie", cookie);
  }
  return json;
}

export async function POST(req: Request) {
  const res = new Response();
  const profile = getProfile(req, res);

  const body = (await req.json()) as { action?: string };
  const action = body.action as Action | undefined;

  if (!action || !(action in POINTS)) {
    return Response.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];

  if (action === "daily" && profile.letzterDailyBonus === today) {
    return Response.json({ error: "Heute schon abgeholt" }, { status: 400 });
  }

  if (action === "einloesen" && profile.punkte < 300) {
    return Response.json({ error: "Nicht genug Punkte" }, { status: 400 });
  }

  const delta = POINTS[action];
  const newPoints = profile.punkte + delta;

  profile.punkteVerlauf.push({
    datum: new Date().toISOString(),
    aktion: action,
    punkte: delta,
    saldo: newPoints,
  });
  profile.punkteVerlauf = profile.punkteVerlauf.slice(-9);

  profile.punkte = newPoints;
  if (action === "daily") {
    profile.letzterDailyBonus = today;
  }

  const json = Response.json({
    punkte: newPoints,
    delta,
    dailyAvailable: action !== "daily",
  });
  const cookie = res.headers.get("Set-Cookie");
  if (cookie) {
    json.headers.set("Set-Cookie", cookie);
  }
  return json;
}
