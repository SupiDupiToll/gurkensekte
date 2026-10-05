"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { GurkenAdresse } from "@/lib/bestellung";

type VerlaufEintrag = {
  datum: string;
  aktion: string;
  punkte: number;
  saldo: number;
};

type ClaimResult = {
  punkte: number;
  delta: number;
  punkteGesamt?: number;
  dailyAvailable?: boolean;
  quoteAvailable?: boolean;
  quoteRemaining?: number;
};

/** Ergebnis einer Punkte-Buchung – inkl. Captcha-Fehler vom Server. */
export type ClaimOutcome =
  | ({ ok: true } & ClaimResult)
  | { ok: false; error: string; requiresTurnstile?: boolean };

type PunkteContextType = {
  punkte: number;
  /** Je gesammelte Punkte (XP) – fällt nie, auch nicht beim Einlösen. */
  punkteGesamt: number;
  loading: boolean;
  dailyAvailable: boolean;
  quoteAvailable: boolean;
  quoteRemaining: number;
  geworben: number;
  werbungenOffen: number;
  verlauf: VerlaufEintrag[];
  /** Aufeinanderfolgende Daily-Tage (Streak) + Rekord + Bonus bei Claim heute. */
  streakAktuell: number;
  streakBest: number;
  bonusHeute: number;
  /** Comeback möglich (Pause lang) / Freeze frei / Extra des heutigen Claims. */
  comebackMoeglich: boolean;
  freezeVerfuegbar: boolean;
  letzterExtra: "comeback" | "freeze" | "wochenbonus" | null;
  /** Wochen-Streak (Mo–So): abgeholte Tage + Bonus-Status. */
  wochenTage: boolean[];
  wochenBonusGeholt: boolean;
  /** Sammelalbum ("Mein Glas", neueste zuerst) + kumulierte Werbungspunkte. */
  sammlung: string[];
  werbungPunkte: number | null;
  /** Endpunkt der Gurken-Rangliste (gehört zur gewählten Punkte-API). */
  leaderboardApiBase: string;
  /** Lieferadresse der letzten Bestellung – beim Einlösen Pflicht. */
  gurkenAdresse: GurkenAdresse | null;
  refresh: () => Promise<void>;
  claim: (
    action: string,
    extra?: Record<string, unknown>,
  ) => Promise<ClaimOutcome | null>;
};

const PunkteContext = createContext<PunkteContextType>({
  punkte: 0,
  punkteGesamt: 0,
  loading: true,
  dailyAvailable: true,
  quoteAvailable: true,
  quoteRemaining: 3,
  geworben: 0,
  werbungenOffen: 0,
  verlauf: [],
  streakAktuell: 0,
  streakBest: 0,
  bonusHeute: 20,
  comebackMoeglich: false,
  freezeVerfuegbar: true,
  letzterExtra: null,
  wochenTage: [false, false, false, false, false, false, false],
  wochenBonusGeholt: false,
  sammlung: [],
  werbungPunkte: null,
  leaderboardApiBase: "/api/mitglieder/punkte/leaderboard",
  gurkenAdresse: null,
  refresh: async () => {},
  claim: async () => null,
});

export function PunkteProvider({
  children,
  apiBase = "/api/mitglieder/punkte",
}: {
  children: ReactNode;
  apiBase?: string;
}) {
  const [punkte, setPunkte] = useState(0);
  const [punkteGesamt, setPunkteGesamt] = useState(0);
  const [gurkenAdresse, setGurkenAdresse] = useState<GurkenAdresse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyAvailable, setDailyAvailable] = useState(true);
  const [quoteAvailable, setQuoteAvailable] = useState(true);
  const [quoteRemaining, setQuoteRemaining] = useState(3);
  const [geworben, setGeworben] = useState(0);
  const [werbungenOffen, setWerbungenOffen] = useState(0);
  const [verlauf, setVerlauf] = useState<VerlaufEintrag[]>([]);
  const [streakAktuell, setStreakAktuell] = useState(0);
  const [streakBest, setStreakBest] = useState(0);
  const [bonusHeute, setBonusHeute] = useState(20);
  const [comebackMoeglich, setComebackMoeglich] = useState(false);
  const [freezeVerfuegbar, setFreezeVerfuegbar] = useState(true);
  const [letzterExtra, setLetzterExtra] = useState<
    "comeback" | "freeze" | "wochenbonus" | null
  >(null);
  const [wochenTage, setWochenTage] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [wochenBonusGeholt, setWochenBonusGeholt] = useState(false);
  const [sammlung, setSammlung] = useState<string[]>([]);
  const [werbungPunkte, setWerbungPunkte] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return;
      const data = await res.json();
      setPunkte(data.punkte);
      setPunkteGesamt(data.punkteGesamt ?? data.punkte ?? 0);
      setGurkenAdresse(data.gurkenAdresse ?? null);
      setDailyAvailable(data.dailyAvailable);
      setQuoteAvailable(data.quoteAvailable ?? true);
      setQuoteRemaining(data.quoteRemaining ?? 3);
      setGeworben(data.geworben ?? 0);
      setWerbungenOffen(data.werbungenOffen ?? 0);
      setVerlauf(data.verlauf ?? []);
      setStreakAktuell(
        typeof data.streakAktuell === "number" ? data.streakAktuell : 0,
      );
      setStreakBest(typeof data.streakBest === "number" ? data.streakBest : 0);
      setBonusHeute(
        typeof data.bonusHeute === "number" ? data.bonusHeute : 20,
      );
      setComebackMoeglich(data.comebackMoeglich === true);
      setFreezeVerfuegbar(data.freezeVerfuegbar !== false);
      setLetzterExtra(
        data.letzterExtra === "comeback" ||
          data.letzterExtra === "freeze" ||
          data.letzterExtra === "wochenbonus"
          ? data.letzterExtra
          : null,
      );
      setWochenTage(
        Array.isArray(data.woche?.tage) && data.woche.tage.length === 7
          ? data.woche.tage.map((t: unknown) => t === true)
          : [false, false, false, false, false, false, false],
      );
      setWochenBonusGeholt(data.woche?.bonusGeholt === true);
      setSammlung(Array.isArray(data.sammlung) ? data.sammlung : []);
      setWerbungPunkte(
        typeof data.werbungPunkte === "number" ? data.werbungPunkte : null,
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const claim = useCallback(
    async (
      action: string,
      extra?: Record<string, unknown>,
    ): Promise<ClaimOutcome | null> => {
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...(extra ?? {}) }),
        });
        const data = (await res.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;
        if (!res.ok) {
          if (data && typeof data.error === "string") {
            return {
              ok: false,
              error: data.error,
              requiresTurnstile: data.requiresTurnstile === true,
            };
          }
          return null;
        }
        if (!data || typeof data.punkte !== "number") return null;
        return { ok: true, ...data } as ClaimOutcome;
      } catch {
        return null;
      }
    },
    [apiBase],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PunkteContext.Provider
      value={{
        punkte,
        punkteGesamt,
        loading,
        dailyAvailable,
        quoteAvailable,
        quoteRemaining,
        geworben,
        werbungenOffen,
        verlauf,
        streakAktuell,
        streakBest,
        bonusHeute,
        comebackMoeglich,
        freezeVerfuegbar,
        letzterExtra,
        wochenTage,
        wochenBonusGeholt,
        sammlung,
        werbungPunkte,
        leaderboardApiBase: `${apiBase}/leaderboard`,
        gurkenAdresse,
        refresh,
        claim,
      }}
    >
      {children}
    </PunkteContext.Provider>
  );
}

export function usePunkte() {
  return useContext(PunkteContext);
}
