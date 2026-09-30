"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppKachelProps = {
  icon: ReactNode;
  titel: string;
  /** Einzeiliger Hinweis unter dem Titel (z. B. Live-Stand). */
  hinweis?: string;
  /** Position im Raster für gestaffelten Einstieg (0–7). */
  index?: number;
  onOpen?: () => void;
  href?: string;
};

/**
 * App-Kachel für den Mitgliederbereich: große Icons mit Text, zwei pro
 * Zeile wie auf einem Handy-Homescreen. Geschlossene Sektionen rendern als
 * Kachel, geöffnete Inhalte spannen per `col-span-2` die volle Breite.
 */
export function AppKachel({
  icon,
  titel,
  hinweis,
  index = 0,
  onOpen,
  href,
}: AppKachelProps) {
  const klasse =
    "app-eintrag group flex min-h-[148px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center transition-[transform,border-color,background-color] duration-200 ease-out hover:border-white/25 hover:bg-white/[0.05] active:scale-[0.97]";
  const inhalt = (
    <>
      {icon}
      <span className="font-display text-lg font-semibold leading-tight text-[#faf8f1]">
        {titel}
      </span>
      {hinweis && (
        <span className="tabular text-xs leading-snug text-[#6b7565]">
          {hinweis}
        </span>
      )}
    </>
  );

  // Gestaffelter Einstieg, gedeckelt damit es nicht träge wirkt.
  const stil = { animationDelay: `${Math.min(index, 7) * 60}ms` };

  if (href) {
    return (
      <Link href={href} className={klasse} style={stil} aria-label={titel}>
        {inhalt}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={klasse}
      style={stil}
      aria-label={`${titel} öffnen`}
    >
      {inhalt}
    </button>
  );
}
