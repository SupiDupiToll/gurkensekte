"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react";
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
    <section aria-label="Losung des Tages" className="g-losung" data-sc-in>
      <p className="g-kicker">
        Losung des Tages
        <span aria-hidden="true"> · </span>
        {datum}
      </p>
      <blockquote className="g-losung__zitat">„{losung}“</blockquote>
      <Link href={`${base}/mitglieder`} className="g-link">
        Täglich drei Zitate im Mitgliederbereich
        <ArrowUpRight size={15} weight="bold" aria-hidden="true" />
      </Link>
    </section>
  );
}
