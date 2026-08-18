"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type VerlaufEintrag = {
  datum: string;
  aktion: string;
  punkte: number;
  saldo: number;
};

type ClaimResult = { punkte: number; delta: number };

type PunkteContextType = {
  punkte: number;
  loading: boolean;
  dailyAvailable: boolean;
  verlauf: VerlaufEintrag[];
  refresh: () => Promise<void>;
  claim: (action: string) => Promise<ClaimResult | null>;
};

const PunkteContext = createContext<PunkteContextType>({
  punkte: 0,
  loading: true,
  dailyAvailable: true,
  verlauf: [],
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
  const [loading, setLoading] = useState(true);
  const [dailyAvailable, setDailyAvailable] = useState(true);
  const [verlauf, setVerlauf] = useState<VerlaufEintrag[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return;
      const data = await res.json();
      setPunkte(data.punkte);
      setDailyAvailable(data.dailyAvailable);
      setVerlauf(data.verlauf ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const claim = useCallback(
    async (action: string): Promise<ClaimResult | null> => {
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
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
    <PunkteContext.Provider value={{ punkte, loading, dailyAvailable, verlauf, refresh, claim }}>
      {children}
    </PunkteContext.Provider>
  );
}

export function usePunkte() {
  return useContext(PunkteContext);
}
