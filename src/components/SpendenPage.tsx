"use client";

import { useState } from "react";
import {
  SpinningCucumber,
  FloatingCucumber,
  WigglingCucumber,
  BouncingCucumber,
} from "@/components/SpinningCucumber";
import { DonationButton } from "@/components/DonationButton";
import {
  CreditCard,
  PaypalLogo,
  AppleLogo,
  ShoppingBag,
  Minus,
  Plus,
  CoinVertical,
} from "@phosphor-icons/react";

const paymentMethods = [
  {
    label: "PayPal",
    icon: <PaypalLogo size={22} weight="fill" />,
    id: "paypal",
  },
  {
    label: "Karte (Visa/Mastercard)",
    icon: <CreditCard size={22} />,
    id: "card",
  },
  {
    label: "Apple Pay",
    icon: <AppleLogo size={22} weight="fill" />,
    id: "apple",
  },
  {
    label: "Klarna",
    icon: <ShoppingBag size={22} weight="fill" />,
    id: "klarna",
  },
];

export function SpendenPage() {
  const [amountEur, setAmountEur] = useState(1);

  return (
    <div className="max-w-lg mx-auto px-4 py-12 md:py-24 relative pb-safe">
      {/* Decorative cucumbers */}
      <div className="hidden md:flex flex-col gap-6 fixed left-4 bottom-1/4 opacity-25 pointer-events-none">
        <FloatingCucumber size="text-3xl" />
        <WigglingCucumber size="text-2xl" />
      </div>
      <div className="hidden md:flex flex-col gap-6 fixed right-4 bottom-1/4 opacity-25 pointer-events-none">
        <SpinningCucumber size="text-2xl" />
        <BouncingCucumber size="text-3xl" />
      </div>

      <div className="text-center mb-10">
        <SpinningCucumber size="text-5xl" />
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-gurken-300 mt-4">
          🥒 Spende für die 10€ Gurken 🥒
        </h1>
        <p className="text-gurken-400 mt-2">
          Nur{" "}
          <span className="text-gurken-300 font-bold text-lg">
            {amountEur} &euro;
          </span>{" "}
          für eine Spende für die heiligen Gurken! 🥒
        </p>
      </div>

      {/* Amount Selector */}
      <div className="card p-6 md:p-8 mb-8">
        <label className="block text-gurken-300 font-bold text-base mb-5 text-center font-heading">
          <CoinVertical size={20} className="inline-block -mt-0.5 mr-1" />
          🥒 Wähle deinen Spendenbetrag 🥒
        </label>

        {/* Quick amounts - scrollable on mobile */}
        <div className="flex justify-center gap-2 mb-5 overflow-x-auto pb-2 px-2 -mx-2">
          {[1, 5, 10, 25, 50].map((val) => (
            <button
              key={val}
              onClick={() => setAmountEur(val)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap touch-manipulation ${
                amountEur === val
                  ? "bg-gurken-500 text-white shadow-[0_0_12px_#22c55e]"
                  : "bg-gurken-800/50 text-gurken-400 hover:bg-gurken-700 hover:text-gurken-300"
              }`}
            >
              {val} &euro;
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setAmountEur(Math.max(0.5, amountEur - 0.5))}
            className="w-12 h-12 rounded-full bg-gurken-700 hover:bg-gurken-600 text-white font-bold transition-all flex items-center justify-center active:scale-90 touch-manipulation"
            aria-label="Betrag verringern"
          >
            <Minus size={18} />
          </button>
          <div className="relative">
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={amountEur}
              onChange={(e) =>
                setAmountEur(Math.max(0.5, parseFloat(e.target.value) || 0.5))
              }
              className="w-28 text-center text-2xl font-bold bg-gurken-800/60 border-2 border-gurken-500/50 rounded-xl px-4 py-3 text-gurken-200 focus:outline-none focus:border-gurken-400 focus:shadow-[0_0_15px_#22c55e] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gurken-400 font-bold text-lg pointer-events-none">
              &euro;
            </span>
          </div>
          <button
            onClick={() => setAmountEur(amountEur + 0.5)}
            className="w-12 h-12 rounded-full bg-gurken-700 hover:bg-gurken-600 text-white font-bold transition-all flex items-center justify-center active:scale-90 touch-manipulation"
            aria-label="Betrag erhöhen"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Payment Buttons */}
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <DonationButton
            key={method.id}
            amountEur={amountEur}
            label={method.label}
            icon={method.icon}
          />
        ))}
      </div>

      <p className="text-center text-gurken-600 text-xs mt-6 max-w-sm mx-auto leading-relaxed px-2">
        🥒 Alle Zahlungen werden über Tippie abgewickelt. Deine Spende ist
        nicht steuerlich absetzbar. Oder doch? Frag deinen Gurkenberater. 🥒
      </p>

      <div className="flex justify-center mt-8 gap-3 opacity-40">
        <FloatingCucumber size="text-3xl" />
        <SpinningCucumber size="text-2xl" />
        <WigglingCucumber size="text-3xl" />
      </div>
    </div>
  );
}
