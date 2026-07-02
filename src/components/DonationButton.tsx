"use client";

import { buildTippieLink } from "@/lib/tippie";

interface DonationButtonProps {
  amountEur: number;
  label: string;
  icon?: string;
  reference?: string;
}

export function DonationButton({
  amountEur,
  label,
  icon,
  reference = "GurkenSpende - GurkenSekte",
}: DonationButtonProps) {
  const href = buildTippieLink({ amountEur, reference });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 active:bg-gurken-700 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:scale-105 active:scale-95"
    >
      {icon && <span className="text-lg">{icon}</span>}
      {label}
    </a>
  );
}
