"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpinningCucumber, FloatingCucumber } from "./SpinningCucumber";

const navLinks = [
  { href: "/", label: "Startseite" },
  { href: "/spenden", label: "Spenden" },
  { href: "/mitglieder", label: "Mitglieder" },
];

export function CultHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-gurken-900/90 backdrop-blur-sm border-b border-gurken-500/30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <SpinningCucumber size="text-3xl" />
          <div>
            <h1 className="text-lg md:text-xl font-black text-gurken-300 tracking-wide animate-pulse-glow">
              Gurken Sekte
            </h1>
            <p className="text-[10px] md:text-xs text-gurken-500 -mt-0.5">
              Offizielle Kult-Website
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 md:gap-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 md:px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-gurken-600 text-white shadow-[0_0_12px_#22c55e]"
                    : "text-gurken-200 hover:bg-gurken-800 hover:text-gurken-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <FloatingCucumber size="text-xl md:text-2xl" />
        </nav>
      </div>
    </header>
  );
}
