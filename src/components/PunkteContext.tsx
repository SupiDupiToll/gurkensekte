"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type VerlaufEintrag = {
  datum: string;
  aktion: string;
  punkte: number;
  saldo: number;
};

type PunkteContextType = {
  punkte: number;
  loading: boolean;
  dailyAvailable: boolean;
  verlauf: VerlaufEintrag[];
  refresh: () => Promise<void>;
};

const PunkteContext = createContext<PunkteContextType>({
  punkte: 0,
  loading: true,
  dailyAvailable: true,
  verlauf: [],
  refresh: async () => {},
});

export function PunkteProvider({ children }: { children: ReactNode }) {
  const [punkte, setPunkte] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dailyAvailable, setDailyAvailable] = useState(true);
  const [verlauf, setVerlauf] = useState<VerlaufEintrag[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/mitglieder/punkte");
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
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PunkteContext.Provider value={{ punkte, loading, dailyAvailable, verlauf, refresh }}>
      {children}
    </PunkteContext.Provider>
  );
}

export function usePunkte() {
  return useContext(PunkteContext);
}

export async function claimPunkte(action: string): Promise<{ punkte: number; delta: number } | null> {
  try {
    const res = await fetch("/api/mitglieder/punkte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
