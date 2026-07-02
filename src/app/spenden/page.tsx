"use client";

import { useState } from "react";
import {
  SpinningCucumber,
  FloatingCucumber,
} from "@/components/SpinningCucumber";
import { DonationButton } from "@/components/DonationButton";

const paymentMethods = [
  { label: "PayPal", icon: "💳", id: "paypal" },
  { label: "Karte (Visa/Mastercard)", icon: "💳", id: "card" },
  { label: "Apple Pay", icon: "🍎", id: "apple" },
  { label: "Klarna", icon: "🛍️", id: "klarna" },
];

export default function SpendenPage() {
  const [amountEur, setAmountEur] = useState(1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
      <div className="text-center mb-10">
        <SpinningCucumber size="text-5xl" />
        <h1 className="text-3xl md:text-4xl font-black text-gurken-300 mt-4 animate-pulse-glow">
          Spende für die 10€ Gurken von Amazon!
        </h1>
        <p className="text-gurken-400 mt-2">
          Nur{" "}
          <span className="text-gurken-300 font-bold text-lg">
            {amountEur} &euro;
          </span>{" "}
          f&uuml;r eine Spende für die Gurken von Amazon!
        </p>
      </div>

      {/* Amount Selector */}
      <div className="bg-gurken-900/40 rounded-2xl p-6 md:p-8 border border-gurken-500/20 mb-8">
        <label className="block text-gurken-300 font-bold text-lg mb-4 text-center">
          W&auml;hle deinen Spendenbetrag:
        </label>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setAmountEur(Math.max(0.5, amountEur - 0.5))}
            className="w-10 h-10 rounded-full bg-gurken-700 hover:bg-gurken-600 text-white font-bold text-lg transition-all"
          >
            &minus;
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
              className="w-28 text-center text-2xl font-black bg-gurken-800/60 border-2 border-gurken-500 rounded-xl px-4 py-3 text-gurken-200 focus:outline-none focus:border-gurken-400 focus:shadow-[0_0_15px_#22c55e] transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gurken-400 font-bold text-lg pointer-events-none">
              &euro;
            </span>
          </div>
          <button
            onClick={() => setAmountEur(amountEur + 0.5)}
            className="w-10 h-10 rounded-full bg-gurken-700 hover:bg-gurken-600 text-white font-bold text-lg transition-all"
          >
            +
          </button>
        </div>

        {/* Quick amounts */}
        <div className="flex justify-center gap-2 mt-4">
          {[1, 5, 10, 25, 50].map((val) => (
            <button
              key={val}
              onClick={() => setAmountEur(val)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                amountEur === val
                  ? "bg-gurken-500 text-white shadow-[0_0_10px_#22c55e]"
                  : "bg-gurken-800/60 text-gurken-400 hover:bg-gurken-700 hover:text-gurken-300"
              }`}
            >
              {val} &euro;
            </button>
          ))}
        </div>
      </div>

      {/* Payment Buttons */}
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <DonationButton
            key={method.id}
            amountEur={amountEur}
            label={`${method.icon} ${method.label}`}
          />
        ))}
      </div>

      <p className="text-center text-gurken-600 text-xs mt-6">
        Alle Zahlungen werden &uuml;ber Tippie abgewickelt. Deine Spende ist
        nicht steuerlich absetzbar. Oder doch? Frag deinen Gurkenberater.
      </p>

      <div className="flex justify-center mt-8 opacity-50">
        <FloatingCucumber size="text-3xl" />
      </div>
    </div>
  );
}
