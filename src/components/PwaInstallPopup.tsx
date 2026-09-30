"use client";

import { useEffect, useRef, useState } from "react";

type PromptEvent = Event & {
  prompt: () => void;
  userChoice?: Promise<{ outcome: string }>;
};

function istIOSGerät(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function läuftStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function hinweisSchonGesehen(): boolean {
  try {
    return localStorage.getItem("gurkenmail-pwa-hinweis") !== null;
  } catch {
    return true;
  }
}

/**
 * Install-Popup für GurkenMail als PWA-Shortcut.
 * Erklärt explizit: kein Speicherverbrauch, nur verlinkte Website.
 */
export function PwaInstallPopup({ ziel = "/mitglieder/gurkenmail" }: { ziel?: string }) {
  const [sichtbar, setSichtbar] = useState(false);
  const [kannInstallieren, setKannInstallieren] = useState(false);
  const promptRef = useRef<PromptEvent | null>(null);

  const istIOS = istIOSGerät();

  useEffect(() => {
    if (läuftStandalone() || hinweisSchonGesehen()) return;
    const t = setTimeout(() => setSichtbar(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as PromptEvent;
      setKannInstallieren(true);
    };
    const onInstalled = () => {
      setSichtbar(false);
      try {
        localStorage.setItem("gurkenmail-pwa-hinweis", "installiert");
      } catch {
        // ignore
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!sichtbar || läuftStandalone()) return null;

  async function installieren() {
    const ev = promptRef.current;
    if (!ev) return;
    ev.prompt();
    try {
      await ev.userChoice;
    } catch {
      // ignore
    }
    promptRef.current = null;
    setKannInstallieren(false);
  }

  function schliessen() {
    setSichtbar(false);
    try {
      localStorage.setItem("gurkenmail-pwa-hinweis", "geschlossen");
    } catch {
      // ignore
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GurkenMail installieren"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-[#8fa96d]/30 bg-[#101b14] p-5 shadow-2xl"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8fa96d]">
        🥒 GurkenMail aufs Handy
      </p>
      <h2 className="font-display mt-1 text-xl font-semibold text-[#faf8f1]">
        Direkt zu GurkenMail – in einer Sekunde
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#a3ad9a]">
        Installiere GurkenMail als App-Symbol, das direkt{" "}
        <strong className="text-[#ede8d6]">{ziel}</strong> öffnet. Das{" "}
        <strong className="text-[#ede8d6]">verbraucht keinen Speicher</strong>, da es nur die
        Website verlinkt – es wird nichts heruntergeladen, nur ein Symbol angelegt.
      </p>
      {kannInstallieren ? (
        <button
          onClick={installieren}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#ede8d6] px-5 py-3 text-sm font-semibold text-[#0b120d] active:scale-[0.99]"
        >
          📲 GurkenMail installieren
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13px] text-[#cfc8b0]">
          {istIOS ? (
            <>iPhone: Teilen-Button → „Zum Home-Bildschirm“ → Hinzufügen.</>
          ) : (
            <>Browser-Menü (⋮) → „Installieren“ / „Zum Startbildschirm hinzufügen“.</>
          )}
        </div>
      )}
      <button
        onClick={schliessen}
        className="mt-2 min-h-[40px] w-full rounded-lg px-4 py-2 text-[13px] font-semibold text-[#6b7565] hover:text-[#a3ad9a]"
      >
        Später
      </button>
    </div>
  );
}
