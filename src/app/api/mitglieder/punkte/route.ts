import { hexclaveServerApp } from "@/hexclave/server";

const POINTS = {
  zitat: 5,
  chat: 3,
  daily: 20,
  einloesen: -300,
} as const;

type Action = keyof typeof POINTS;

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().split("T")[0];

  return Response.json({
    punkte: (meta.punkte as number) ?? 0,
    dailyAvailable: meta.letzterDailyBonus !== today,
    verlauf: (meta.punkteVerlauf as unknown[]) ?? [],
  });
}

export async function POST(req: Request) {
  const user = await hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" });
  if (!user) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = (await req.json()) as { action?: string };
  const action = body.action as Action | undefined;

  if (!action || !(action in POINTS)) {
    return Response.json({ error: "Ungültige Aktion" }, { status: 400 });
  }

  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().split("T")[0];
  const currentPoints = (meta.punkte as number) ?? 0;

  if (action === "daily" && meta.letzterDailyBonus === today) {
    return Response.json({ error: "Heute schon abgeholt" }, { status: 400 });
  }

  if (action === "einloesen" && currentPoints < 300) {
    return Response.json({ error: "Nicht genug Punkte" }, { status: 400 });
  }

  const delta = POINTS[action];
  const newPoints = currentPoints + delta;
  const verlauf = ((meta.punkteVerlauf as unknown[]) ?? []).slice(-9);

  verlauf.push({
    datum: new Date().toISOString(),
    aktion: action,
    punkte: delta,
    saldo: newPoints,
  });

  const update: Record<string, unknown> = {
    punkte: newPoints,
    punkteVerlauf: verlauf,
  };

  if (action === "daily") {
    update.letzterDailyBonus = today;
  }

  await user.setClientReadOnlyMetadata({ ...meta, ...update });

  if (action === "einloesen") {
    fetch("https://ntfy.sh/jdjdixoqknslxloeoiibsbpgoka", {
      method: "POST",
      body: `Neue Gurken-Bestellung von ${user.primaryEmail}`,
    }).catch(() => {});
  }

  return Response.json({
    punkte: newPoints,
    delta,
    dailyAvailable: action !== "daily",
  });
}
