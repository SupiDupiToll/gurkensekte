import { getDemoProfile, mitDemoCookie } from "@/lib/demoStore";
import {
  type LeaderboardEintrag,
  vergleicheEintraege,
} from "@/lib/leaderboard";

export const runtime = "nodejs";

/** Ein paar feste Sektengrößen, damit die Demo-Rangliste voll wirkt. */
const FIKTIONE: LeaderboardEintrag[] = [
  {
    id: "demo-bot-1",
    name: "Gurken-Papst Gregor VII.",
    punkte: 1180,
    seit: Date.UTC(2023, 10, 3),
  },
  {
    id: "demo-bot-2",
    name: "Erleuchtete Greta vom Glas",
    punkte: 640,
    seit: Date.UTC(2023, 11, 17),
  },
  {
    id: "demo-bot-3",
    name: "Bruder Gurkenherz",
    punkte: 990,
    seit: Date.UTC(2024, 1, 8),
  },
  {
    id: "demo-bot-4",
    name: "Sekten-Schreiberin Lina",
    punkte: 410,
    seit: Date.UTC(2024, 2, 21),
  },
  {
    id: "demo-bot-5",
    name: "Eingemachte Emma",
    punkte: 1020,
    seit: Date.UTC(2024, 4, 2),
  },
  {
    id: "demo-bot-6",
    name: "Novize Nils von der Schneide",
    punkte: 260,
    seit: Date.UTC(2024, 5, 14),
  },
  {
    id: "demo-bot-7",
    name: "Gurken-Guru Hagen",
    punkte: 130,
    seit: Date.UTC(2024, 7, 30),
  },
  {
    id: "demo-bot-8",
    name: "Taufe-Tag Traudel",
    punkte: 90,
    seit: Date.UTC(2024, 9, 12),
  },
];

const TOP_LIMIT = 10;

export async function GET(req: Request) {
  const res = new Response();
  const profile = getDemoProfile(req, res);

  const meinEintrag: LeaderboardEintrag = {
    id: "demo",
    name: "Demo-Mitglied",
    punkte: profile.punkte,
    seit: Date.UTC(2024, 5, 1),
  };

  const eintraege = [...FIKTIONE, meinEintrag].sort(vergleicheEintraege);
  const rang = eintraege.findIndex((e) => e.id === meinEintrag.id) + 1;

  return mitDemoCookie(
    Response.json({
      eintraege: eintraege.slice(0, TOP_LIMIT),
      gesamt: eintraege.length,
      du: { rang, eintrag: meinEintrag },
    }),
    res,
  );
}
