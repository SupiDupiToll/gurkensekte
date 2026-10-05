"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Sun } from "@phosphor-icons/react";
import { tageslosungFuer } from "@/lib/tageslosung";

/**
 * Losung des Tages: jeden Tag ein anderer Spruch, für alle sichtbar.
 * Client-Insel (frisches Datum pro Besuch – Landing ist statisch gerendert).
 * Leiser Rückholgrund für Außenstehende + Teaser auf den Mitgliederbereich.
 */
export function Tageslosung({ base = "" }: { base?: string }) {
  const { losung, datum } = useMemo(() => {
    const jetzt = new Date();
    return {
      losung: tageslosungFuer(jetzt),
      datum: jetzt.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    };
  }, []);

  if (!losung) return null;

  return (
    <section
      aria-label="Losung des Tages"
      className="mx-auto max-w-6xl px-4 pb-20 md:pb-32"
    >
      <div className="shell">
        <div className="core flex flex-col items-center gap-3 p-7 text-center md:p-9">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#8fa96d]/30 bg-[#8fa96d]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e2d9bf]">
            <Sun size={14} weight="fill" />
            Losung des Tages · {datum}
          </span>
          <blockquote className="font-serif mx-auto max-w-2xl text-xl italic leading-snug text-[#ede8d6] md:text-2xl">
            „{losung}“
          </blockquote>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6b7565]">
            Gürkchen · jeden Tag neu
          </p>
          <Link
            href={`${base}/mitglieder`}
            className="mt-1 inline-flex min-h-[40px] items-center rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            Täglich drei Zitate im Mitgliederbereich
          </Link>
        </div>
      </div>
    </section>
  );
}
