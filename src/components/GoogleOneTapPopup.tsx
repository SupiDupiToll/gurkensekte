"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@hexclave/next";
import { X } from "@phosphor-icons/react";
import { hexclaveClientApp } from "@/hexclave/client";

const DISMISS_KEY = "gurken-google-nudge-dismissed";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 1200;

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(false);
    try {
      await hexclaveClientApp.signInWithOAuth("google", {
        returnTo: "/mitglieder",
      });
    } catch {
      setError(true);
      setLoading(false);
      router.push("/mitglieder/signup");
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Mit Google anmelden"
      aria-live="polite"
      className={`fixed bottom-4 left-4 right-4 z-50 mx-auto w-full max-w-sm transition-all duration-300 sm:left-auto sm:right-6 sm:bottom-6 ${
        leaving ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="rounded-2xl border border-white/10 bg-[#101b14]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede8d6] text-2xl">
            🥒
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#faf8f1]">
              In 1 Klick zur Erleuchtung
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#a3ad9a]">
              Mit Google anmelden und direkt in den Mitgliederbereich.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Popup schließen"
            className="rounded-lg p-1.5 text-[#6b7565] transition-colors hover:bg-white/[0.06] hover:text-[#ede8d6]"
          >
            <X size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#faf8f1] px-4 py-2.5 text-sm font-semibold text-[#0b120d] transition-all hover:bg-white disabled:cursor-wait disabled:opacity-70"
        >
          <GoogleGLogo />
          {loading ? "Weiter zu Google …" : "Mit Google anmelden"}
        </button>
        {error && (
          <p className="mt-2 text-center text-xs text-[#c9a86a]">
            Direkt-Login fehlgeschlagen – du wirst zur Anmeldung weitergeleitet …
          </p>
        )}
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
