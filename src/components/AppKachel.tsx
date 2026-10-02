"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppKachelProps = {
  icon: ReactNode;
  titel: string;
  /** Einzeiliger Hinweis unter dem Titel (z. B. Live-Stand). */
  hinweis?: string;
  /** Ungelesene-Anzahl als Badge oben rechts (z. B. neue GurkenMails). */
  badge?: number;
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
  badge = 0,
  index = 0,
  onOpen,
  href,
}: AppKachelProps) {
  const klasse =
    "app-eintrag group relative flex min-h-[148px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center transition-[transform,border-color,background-color] duration-200 ease-out hover:border-white/25 hover:bg-white/[0.05] active:scale-[0.97]";
  const inhalt = (
    <>
      {badge > 0 && (
        <span
          aria-label={`${badge} ungelesene Nachrichten`}
          className="tabular absolute right-3 top-3 flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-[#8fa96d] px-1.5 text-xs font-bold text-[#0b120d]"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
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
