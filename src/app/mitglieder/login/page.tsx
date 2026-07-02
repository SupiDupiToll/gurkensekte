"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignIn } from "@hexclave/next";
import {
  WigglingCucumber,
  SpinningCucumber,
  FloatingCucumber,
} from "@/components/SpinningCucumber";

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
    <div className="max-w-md mx-auto px-4 py-12 md:py-20 relative pb-safe">
      {/* Decorative */}
      <div className="hidden md:block absolute -left-8 top-20 opacity-20 pointer-events-none">
        <FloatingCucumber size="text-5xl" />
      </div>
      <div className="hidden md:block absolute -right-8 bottom-20 opacity-20 pointer-events-none">
        <SpinningCucumber size="text-5xl" />
      </div>

      <div className="glass rounded-3xl p-8 md:p-10 glow-green">
        <div className="text-center mb-6">
          <WigglingCucumber size="text-6xl" />
          <h1 className="text-2xl font-heading font-bold text-gurken-300 mt-4 mb-2">
            🥒 Mitglieder-Login 🥒
          </h1>
          <p className="text-gurken-400">
            Melde dich an, um in den exklusiven Mitgliederbereich zu gelangen.
          </p>
        </div>

        <SignIn
          automaticRedirect
          firstTab="password"
          extraInfo={
            <p className="text-gurken-500 text-xs text-center mt-4">
              Noch kein Mitglied? 🥒{" "}
              <a
                href="/mitglieder/signup"
                className="text-gurken-400 hover:text-gurken-300 underline underline-offset-2"
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
