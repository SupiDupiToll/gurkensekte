"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignIn } from "@hexclave/next";
import { WigglingCucumber } from "@/components/SpinningCucumber";

export default function LoginPage() {
  const user = useUser();
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
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-gurken-900/40 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-gurken-500/15 shadow-[0_0_40px_#22c55e0d]">
        <div className="text-center mb-6">
          <WigglingCucumber size="text-6xl" />
          <h1 className="text-2xl font-black text-gurken-300 mt-4 mb-2">
            Mitglieder-Login
          </h1>
          <p className="text-gurken-400">
            Melde dich an, um in den exklusiven Mitgliederbereich der Gurken
            Sekte zu gelangen.
          </p>
        </div>

        <SignIn
          automaticRedirect
          firstTab="password"
          extraInfo={
            <p className="text-gurken-500 text-xs text-center mt-4">
              Noch kein Mitglied?{" "}
              <a
                href="/mitglieder/signup"
                className="text-gurken-400 hover:text-gurken-300 underline"
              >
                Jetzt registrieren
              </a>
            </p>
          }
        />
      </div>
    </div>
  );
}
