"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_POINTS,
  encodeReferralCookie,
  hasReferralCookie,
} from "@/lib/referral";

const noopSubscribe = () => () => {};

/** `false` beim Server-Rendering/Hydrieren, `true` im Browser. */
function useIsHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Fängt einen Werbe-Link (`?ref=<userId>`) ab, hinterlegt den Code als Cookie
 * und zeigt dem Eingeladenen einen dezenten Hinweis.
 */
export function ReferralCapture() {
  const [dismissed, setDismissed] = useState(false);
  const hydrated = useIsHydrated();
  const pathname = usePathname();

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref) return;
    if (hasReferralCookie(document.cookie)) return;

    document.cookie = `${REFERRAL_COOKIE}=${encodeReferralCookie(
      ref,
    )}; Path=/; SameSite=Lax; Max-Age=${REFERRAL_COOKIE_MAX_AGE}`;
  }, []);

  // Der Suchparameter steht erst im Browser zur Verfügung; vor der Hydration
  // bleibt der Hinweis unsichtbar, damit Server- und Client-Markup passen.
  const ref = hydrated
    ? new URLSearchParams(window.location.search).get("ref")
    : null;

  // Im Demo-Modus und im Mitgliederbereich wäre der Hinweis fehl am Platz.
  const hiddenHere = pathname.startsWith("/demo") || pathname === "/mitglieder";

  if (!ref || dismissed || hiddenHere) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-lg glass-strong rounded-2xl glow-green p-4 flex items-start gap-3">
      <SpinningCucumber size="text-3xl" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="text-gurken-100 font-heading font-bold mb-0.5">
          🥒 Du wurdest zu einem Gurken-Guru geführt!
        </p>
        <p className="text-gurken-300/80 leading-relaxed mb-3">
          Registriere dich, dann erhält dein Werber {REFERRAL_POINTS}{" "}
          Gurken-Punkte.
        </p>
        <Link
          href="/mitglieder/signup"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gurken-500 hover:bg-gurken-400 text-gurken-950 font-bold transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] touch-manipulation min-h-[44px]"
        >
          Jetzt der Sekte beitreten
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Hinweis schließen"
        className="text-gurken-400 hover:text-gurken-100 transition-colors p-1 flex-shrink-0"
      >
        <X size={18} weight="bold" />
      </button>
    </div>
  );
}
