"use client";

import { buildTippieLink } from "@/lib/tippie";
import { ArrowSquareOut } from "@phosphor-icons/react";

interface DonationButtonProps {
  amountEur: number;
  label: string;
  icon?: React.ReactNode;
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
      className="flex items-center justify-center gap-2.5 w-full px-6 py-3.5 rounded-xl bg-gurken-600 hover:bg-gurken-500 active:bg-gurken-700 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
    >
      {icon}
      <span>{label}</span>
      <ArrowSquareOut size={16} weight="bold" className="opacity-60 flex-shrink-0" />
    </a>
  );
}
