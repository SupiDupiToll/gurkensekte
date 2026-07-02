"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useHexclaveApp } from "@hexclave/next";
import { WigglingCucumber } from "@/components/SpinningCucumber";

export default function LoginPage() {
  const user = useUser();
  const app = useHexclaveApp();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/mitglieder");
    }
  }, [user, router]);

  if (user) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="bg-gurken-900/40 rounded-2xl p-8 border border-gurken-500/20">
        <WigglingCucumber size="text-6xl" />
        <h1 className="text-2xl font-black text-gurken-300 mt-4 mb-2">
          Mitglieder-Login
        </h1>
        <p className="text-gurken-400 mb-8">
          Melde dich an, um in den exklusiven Mitgliederbereich der Gurken
          Sekte zu gelangen.
        </p>

        <button
          onClick={() => app.redirectToSignIn()}
          className="w-full px-6 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:scale-105 active:scale-95"
        >
          Jetzt anmelden 🥒
        </button>

        <p className="text-gurken-600 text-xs mt-4">
          Du wirst zu unserem sicheren Anmeldedienst weitergeleitet.
        </p>
      </div>
    </div>
  );
}
