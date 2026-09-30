"use client";

import { useEffect, useRef } from "react";
import { useIdlenAd } from "@idlen/chat-sdk/react";

const API_KEY = process.env.NEXT_PUBLIC_IDLEN_API_KEY;

/**
 * Kontextuelle Werbung unter Gürkchen-Antworten (Idlen Chat SDK).
 * Rendert nichts, solange kein API-Key konfiguriert ist.
 * Kennzeichnung "Anzeige" ist Pflicht (deutsches Werberecht).
 */
export function GuerkchenAd({
  slotId,
  sessionId,
  contextText,
}: {
  slotId: string;
  sessionId: string;
  contextText: string;
}) {
  const fertig = useRef<string | null>(null);

  // Hook nur mit Key initialisieren – ohne Key kein Fetch, keine Kosten.
  const { ad, fetchAd, trackClick } = useIdlenAd({
    apiKey: API_KEY ?? "idl_pk_unconfigured",
  });

  useEffect(() => {
    if (!API_KEY || fertig.current === slotId || contextText.trim().length < 20) return;
    fertig.current = slotId;
    fetchAd({
      sessionId,
      rawText: contextText.slice(0, 2000),
      format: "chat_cta_card",
      maxAds: 1,
    }).catch(() => {
      // Werbung darf den Chat nie kaputtmachen – still ignorieren.
    });
    // Genau ein Fetch pro Slot (Attribution: keine Doppel-Impressions).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId]);

  if (!API_KEY || !ad) return null;

  return (
    <div className="flex justify-start">
      <aside
        aria-label="Anzeige"
        className="max-w-[88%] rounded-2xl rounded-bl-md border border-[#c9a86a]/25 bg-[#c9a86a]/[0.05] px-4 py-3 md:max-w-[75%]"
      >
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7565]">
          Anzeige{ad.advertiserName ? ` · ${ad.advertiserName}` : ""}
        </p>
        <div className="flex items-start gap-3">
          {ad.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.imageUrl}
              alt=""
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#ede8d6]">{ad.title}</p>
            {ad.body && (
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-[#a3ad9a]">
                {ad.body}
              </p>
            )}
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              onClick={() => trackClick()}
              className="mt-2 inline-flex min-h-[40px] items-center rounded-lg bg-[#ede8d6] px-4 py-1.5 text-[13px] font-semibold text-[#0b120d] transition-transform active:scale-[0.98]"
            >
              {ad.ctaText || "Ansehen"}
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
