"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { GurkenAdresse } from "@/lib/bestellung";

type VerlaufEintrag = {
  datum: string;
  aktion: string;
  punkte: number;
  saldo: number;
};

type ClaimResult = { punkte: number; delta: number };

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
  /** Endpunkt der Gurken-Rangliste (gehört zur gewählten Punkte-API). */
  leaderboardApiBase: string;
  /** Lieferadresse der letzten Bestellung – beim Einlösen Pflicht. */
  gurkenAdresse: GurkenAdresse | null;
  refresh: () => Promise<void>;
  claim: (
    action: string,
    extra?: Record<string, unknown>,
  ) => Promise<ClaimResult | null>;
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
    ): Promise<ClaimResult | null> => {
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...(extra ?? {}) }),
        });
        if (!res.ok) return null;
        return await res.json();
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
