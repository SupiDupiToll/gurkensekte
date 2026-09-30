"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";

/**
 * Geteiltes Popup für den Mitgliederbereich: abgedunkelter Hintergrund,
 * zentrierte Karte (mobil als Bottom-Sheet), Schließen per X, Escape oder
 * Klick auf den Hintergrund. Der Chat hat sein eigenes Vollbild-Overlay,
 * Casino/Duell/GurkenMail sind eigene Seiten – alles andere öffnet hier.
 */
export function Popup({
  titel,
  icon,
  onClose,
  children,
}: {
  titel: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", esc);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = vorher;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={titel}
    >
      <button
        type="button"
        aria-label="Popup schließen"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[2px]"
      />
      <div className="popup-eintritt relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101b14]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon}
            <h2 className="font-display truncate text-lg font-semibold text-[#faf8f1]">
              {titel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/10 text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 md:px-6 md:py-6">{children}</div>
      </div>
    </div>
  );
}
