"use client";

import { useState, type ReactNode } from "react";
import { ArrowsInSimple, ArrowRight } from "@phosphor-icons/react";

export function CasinoSection({
  icon,
  titel,
  cta,
  children,
}: {
  icon: ReactNode;
  titel: string;
  teaser: string;
  cta: string;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState(false);

  if (!offen) {
    return (
      <div className="mb-5">
        <button
          onClick={() => setOffen(true)}
          className="shell group block w-full text-center transition-colors duration-200 active:scale-[0.99]"
        >
          <div className="core flex flex-col items-center gap-4 p-6 md:p-8">
            {icon}
            <h2 className="font-display text-2xl font-semibold text-[#faf8f1]">{titel}</h2>
            <span className="btn-cta btn-cta-primary !text-base">
              {cta}
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
    <div className="mb-5">
      <div className="mb-2 flex justify-end">
        <button
          onClick={() => setOffen(false)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-[13px] font-semibold text-[#a3ad9a] transition-colors hover:border-white/20 hover:text-[#ede8d6]"
        >
          <ArrowsInSimple size={16} />
          Schließen
        </button>
      </div>
      {children}
    </div>
  );
}
