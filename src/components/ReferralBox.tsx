"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Check,
  Copy,
  Gift,
  ShareNetwork,
  UsersThree,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import { REFERRAL_POINTS, buildReferralLink, hasReferralCookie } from "@/lib/referral";

const noopSubscribe = () => () => {};

/** `false` beim Server-Rendering/Hydrieren, `true` im Browser. */
function useIsHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ReferralBox({
  code,
  isDemo = false,
}: {
  code?: string | null;
  isDemo?: boolean;
}) {
  const { geworben } = usePunkte();
  const [copied, setCopied] = useState(false);
  const hydrated = useIsHydrated();

  // Der Origin steht erst im Browser zur Verfügung – wie bei `HomeCta` bleibt
  // der Link vor der Hydration leer, damit Server- und Client-Markup passen.
  const link = hydrated && code ? buildReferralLink(window.location.origin, code) : "";

  // Offene Werbung einlösen: nur wenn ein Werbe-Cookie liegt und wir nicht in
  // der Demo sind. Der Server räumt das Cookie danach weg.
  useEffect(() => {
    if (isDemo || !code) return;
    if (!hasReferralCookie(document.cookie)) return;

    fetch("/api/mitglieder/referral", { method: "POST" }).catch(() => {
      // Netzwerkschluckauf – beim nächsten Besuch wird es erneut versucht.
    });
  }, [isDemo, code]);

  const copyLink = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage nicht verfügbar (z. B. unsicherer Kontext)
    }
  }, [link]);

  const shareText = `🥒 Tritt der Gurken Sekte bei! Nutze meinen Link und ich bekomme Gurken-Punkte: ${link}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const shareHref = `mailto:?subject=${encodeURIComponent(
    "🥒 Einladung in die Gurken Sekte",
  )}&body=${encodeURIComponent(shareText)}`;

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <Gift size={24} weight="fill" className="text-yellow-400" />
        <h2 className="text-xl font-heading font-bold text-gurken-200">
          🥒 Freunde werben Freunde 🥒
        </h2>
      </div>

      <p className="text-gurken-300/80 text-sm leading-relaxed mb-4">
        Teile deinen heiligen Werbe-Link. Für jede Person, die sich darüber
        registriert, segnet Gürkchen dich mit{" "}
        <strong className="text-yellow-300">+{REFERRAL_POINTS} Punkten</strong>.
        Der Segen gilt für jedes neue Mitglied – du kannst{" "}
        <strong className="text-gurken-200">unbegrenzt viele Freunde</strong>{" "}
        einladen, es gibt keine Obergrenze. 🥒
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Dein Werbe-Link"
          className="flex-1 min-w-0 rounded-xl border border-gurken-500/20 bg-gurken-800/50 px-3 py-2.5 text-sm text-gurken-100 outline-none focus:border-gurken-400"
        />
        <button
          onClick={copyLink}
          disabled={!link}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gurken-500 hover:bg-gurken-400 text-gurken-950 font-bold text-sm transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] disabled:opacity-50 touch-manipulation min-h-[44px] flex-shrink-0"
        >
          {copied ? <Check size={18} weight="bold" /> : <Copy size={18} weight="bold" />}
          {copied ? "Kopiert" : "Link kopieren"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-sm transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] touch-manipulation min-h-[44px]"
        >
          <WhatsappLogo size={18} weight="fill" />
          Per WhatsApp teilen
        </a>
        <a
          href={shareHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gurken-500/30 text-gurken-300 hover:text-gurken-100 hover:border-gurken-400 hover:bg-gurken-800/40 font-bold text-sm transition-all duration-200 touch-manipulation min-h-[44px]"
        >
          <ShareNetwork size={18} weight="fill" />
          Per E-Mail
        </a>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-gurken-500/10 bg-gurken-800/30 px-4 py-3">
          <UsersThree size={22} weight="fill" className="text-gurken-300 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-gurken-400">Erfolgreich geworben: </span>
            <span className="text-gurken-100 font-bold">{geworben}</span>
            <span className="text-gurken-400">
              {" "}
              {geworben === 1 ? "Mitglied" : "Mitglieder"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gurken-500/10 bg-gurken-800/30 px-4 py-3">
          <Gift size={22} weight="fill" className="text-yellow-400 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-gurken-400">Punkte durch Werbung: </span>
            <span className="text-yellow-300 font-bold">
              +{geworben * REFERRAL_POINTS}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
