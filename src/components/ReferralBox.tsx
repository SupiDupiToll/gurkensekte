"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowsInSimple,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Gift,
  ShareNetwork,
  UsersThree,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import { ReferralQrCode } from "@/components/ReferralQrCode";
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
  const { geworben, werbungenOffen } = usePunkte();
  const [open, setOpen] = useState(false);
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

  const shareText = `Tritt der Gurken Sekte bei! Nutze meinen Link und ich bekomme Gurken-Punkte: ${link}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const shareHref = `mailto:?subject=${encodeURIComponent(
    "Einladung in die Gurken Sekte",
  )}&body=${encodeURIComponent(shareText)}`;

  if (!open) {
    return (
      <div className="mb-5">
        <button
          onClick={() => setOpen(true)}
          className="shell group block w-full text-center transition-colors duration-200 active:scale-[0.99]"
        >
          <div className="core flex flex-col items-center gap-4 p-6 md:p-8">
            <Gift size={40} weight="fill" className="text-[#c9a86a]" />
            <h2 className="font-display text-2xl font-semibold text-[#faf8f1] md:text-[1.7rem]">
              Freunde werben Freunde
            </h2>
            <span className="btn-cta btn-cta-primary !text-base">
              Werbe-Link anzeigen
              <span className="btn-dot">
                <ArrowRight size={17} weight="bold" />
              </span>
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-5 p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gift size={22} weight="fill" className="text-[#c9a86a]" />
          <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
            Freunde werben Freunde
          </h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#a3ad9a] transition-colors hover:border-white/20 hover:text-[#ede8d6]"
        >
          <ArrowsInSimple size={16} />
          Schließen
        </button>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[#a3ad9a]">
        Teile deinen heiligen Werbe-Link. Für jede Person, die sich darüber
        registriert, segnet Gürkchen dich mit{" "}
        <strong className="text-[#e2d9bf]">+{REFERRAL_POINTS} Punkten</strong>.
        Der Segen gilt für jedes neue Mitglied – du kannst{" "}
        <strong className="text-[#ede8d6]">unbegrenzt viele Freunde</strong>{" "}
        einladen, es gibt keine Obergrenze.
      </p>

      <p className="mb-4 text-xs leading-relaxed text-[#6b7565]">
        Jede Werbung wird von der Sekten-Leitung geprüft, bevor die Punkte
        gutgeschrieben werden.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Dein Werbe-Link"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#ede8d6] outline-none focus:border-[#8fa96d]"
        />
        <button
          onClick={copyLink}
          disabled={!link}
          className="flex min-h-[44px] flex-shrink-0 items-center gap-2 rounded-lg bg-[#ede8d6] px-4 py-2.5 text-sm font-semibold text-[#0b120d] transition-all duration-300 active:scale-[0.97] disabled:opacity-50"
        >
          {copied ? <Check size={18} weight="bold" /> : <Copy size={18} weight="bold" />}
          {copied ? "Kopiert" : "Kopieren"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-[#ede8d6] transition-colors hover:border-white/25"
        >
          <WhatsappLogo size={18} weight="fill" />
          Per WhatsApp teilen
        </a>
        <a
          href={shareHref}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
        >
          <ShareNetwork size={18} weight="fill" />
          Per E-Mail
        </a>
      </div>

      <div className="mb-5">
        <ReferralQrCode data={link} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <UsersThree size={22} weight="fill" className="flex-shrink-0 text-[#8fa96d]" />
          <div className="tabular text-sm">
            <span className="text-[#6b7565]">Bestätigt geworben: </span>
            <span className="font-semibold text-[#ede8d6]">{geworben}</span>
            <span className="text-[#6b7565]">
              {" "}
              {geworben === 1 ? "Mitglied" : "Mitglieder"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <Gift size={22} weight="fill" className="flex-shrink-0 text-[#c9a86a]" />
          <div className="tabular text-sm">
            <span className="text-[#6b7565]">Punkte durch Werbung: </span>
            <span className="font-semibold text-[#e2d9bf]">
              +{geworben * REFERRAL_POINTS}
            </span>
          </div>
        </div>
        {werbungenOffen > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-[#c9a86a]/20 bg-[#c9a86a]/[0.05] px-4 py-3 sm:col-span-2">
            <Clock size={22} weight="fill" className="flex-shrink-0 text-[#c9a86a]" />
            <div className="tabular text-sm">
              <span className="text-[#6b7565]">In Prüfung: </span>
              <span className="font-semibold text-[#ede8d6]">{werbungenOffen}</span>
              <span className="text-[#6b7565]">
                {" "}
                {werbungenOffen === 1 ? "Werbung" : "Werbungen"} – warten auf
                Bestätigung durch die Sekten-Leitung.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
