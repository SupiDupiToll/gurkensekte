"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpinningCucumber } from "./SpinningCucumber";
import { House, HandCoins, Users } from "@phosphor-icons/react";

const navLinks = [
  { href: "/", label: "Startseite", icon: House },
  { href: "/spenden", label: "Spenden", icon: HandCoins },
  { href: "/mitglieder", label: "Mitglieder", icon: Users },
];

export function CultHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-gurken-500/20">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 md:gap-3 group min-h-[44px]"
          aria-label="Zur Startseite"
        >
          <SpinningCucumber size="text-2xl md:text-3xl" />
          <div>
            <h1 className="text-base md:text-xl font-heading font-bold text-gurken-300 tracking-wide leading-tight">
              Gurken Sekte
            </h1>
            <p className="text-[9px] md:text-xs text-gurken-500 -mt-0.5 leading-tight">
              Offizielle Kult-Website
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5 md:gap-2" aria-label="Hauptnavigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-center gap-1 md:gap-1.5 min-w-[44px] min-h-[44px] px-2 md:px-4 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-gurken-600/80 text-white shadow-[0_0_12px_#22c55e]"
                    : "text-gurken-200 hover:bg-gurken-800/60 hover:text-gurken-100"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
