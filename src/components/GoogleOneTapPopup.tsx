"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@hexclave/next";
import { X } from "@phosphor-icons/react";
import { hexclaveClientApp } from "@/hexclave/client";

const DISMISS_KEY = "gurken-google-nudge-dismissed";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 1200;

type Provider = "google" | "discord";

function GoogleGLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1c.95-2.84 3.6-4.95 6.73-4.95Z"
      />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128c-.598.35-1.22.644-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function InnerPopup() {
  const user = useUser();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState<Provider | null>(null);

  useEffect(() => {
    if (user || wasRecentlyDismissed()) return;
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [user]);

  if (user || !visible) return null;

  const dismiss = () => {
    setLeaving(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setTimeout(() => setVisible(false), 250);
  };

  const handleLogin = async (provider: Provider) => {
    setLoading(provider);
    try {
      await hexclaveClientApp.signInWithOAuth(provider, {
        returnTo: "/mitglieder",
      });
    } catch {
      setLoading(null);
      router.push("/mitglieder/signup");
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Gurken Sekte beitreten"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-300 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-sm ${
        leaving ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="rounded-t-2xl border border-b-0 border-white/10 bg-[#101b14]/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl shadow-black/50 backdrop-blur-md sm:rounded-2xl sm:border-b sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold text-[#faf8f1]">
            Jetzt Gurken Sekte beitreten
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Popup schließen"
            className="rounded-lg p-1.5 text-[#6b7565] transition-colors hover:bg-white/[0.06] hover:text-[#ede8d6]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleLogin("google")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#faf8f1] px-4 py-3 text-sm font-semibold text-[#0b120d] transition-all hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            <GoogleGLogo />
            {loading === "google" ? "Weiter zu Google …" : "Mit Google anmelden"}
          </button>
          <button
            type="button"
            onClick={() => handleLogin("discord")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#4752c4] disabled:cursor-wait disabled:opacity-70"
          >
            <DiscordLogo />
            {loading === "discord" ? "Weiter zu Discord …" : "Mit Discord anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};

export function GoogleOneTapPopup() {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!hydrated) return null;
  return (
    <Suspense fallback={null}>
      <InnerPopup />
    </Suspense>
  );
}
