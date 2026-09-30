"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, HandCoins, UsersThree, Flask } from "@phosphor-icons/react";
import { SpinningCucumber } from "./SpinningCucumber";
import { demoPath } from "@/lib/demo";

const navLinks = [
  { href: "/", label: "Startseite", icon: House },
  { href: "/spenden", label: "Spenden", icon: HandCoins },
  { href: "/mitglieder", label: "Mitglieder", icon: UsersThree },
];

export function CultHeader() {
  const pathname = usePathname();
  const isDemo = pathname.startsWith("/demo");
  const homeHref = isDemo ? demoPath("/") : "/";

  return (
    <header className="glass-strong sticky top-0 z-40 border-b border-white/[0.07]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href={homeHref} className="flex items-center gap-2.5" aria-label="Zur Startseite">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ede8d6] text-xl">
            <SpinningCucumber size="text-xl" />
          </span>
          <span className="leading-none">
            <span className="font-display block text-[17px] font-semibold text-[#ede8d6]">
              Gurken Sekte
            </span>
            <span className="block text-[11px] font-medium text-[#6b7565]">
              {isDemo ? "Demo" : "Satire · seit 2026"}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
          {isDemo && (
            <Link
              href="/"
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#c9a86a]/25 px-3 text-xs font-semibold text-[#e2d9bf] transition-colors hover:bg-[#c9a86a]/10"
              aria-label="Zur echten Gurken Sekte"
            >
              <Flask size={15} />
              <span className="hidden sm:inline">Echt</span>
            </Link>
          )}
          {navLinks.map((link) => {
            const href = isDemo ? demoPath(link.href) : link.href;
            const isActive = pathname === href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors md:px-3.5 ${
                  isActive
                    ? "bg-white/[0.07] text-[#faf8f1]"
                    : "text-[#a3ad9a] hover:bg-white/[0.04] hover:text-[#ede8d6]"
                }`}
              >
                <Icon size={17} weight={isActive ? "fill" : "regular"} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
