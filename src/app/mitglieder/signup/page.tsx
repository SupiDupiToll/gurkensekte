"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignUp } from "@hexclave/next";
import {
  SpinningCucumber,
  WigglingCucumber,
  FloatingCucumber,
} from "@/components/SpinningCucumber";

export default function SignUpPage() {
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
      <div className="hidden md:block absolute -right-8 top-20 opacity-20 pointer-events-none">
        <FloatingCucumber size="text-5xl" />
      </div>
      <div className="hidden md:block absolute -left-8 bottom-20 opacity-20 pointer-events-none">
        <SpinningCucumber size="text-5xl" />
      </div>

      <div className="glass rounded-3xl p-8 md:p-10 glow-green">
        <div className="text-center mb-6">
          <SpinningCucumber size="text-6xl" />
          <h1 className="text-2xl font-heading font-bold text-gurken-300 mt-4 mb-2">
            🥒 Der Sekte beitreten 🥒
          </h1>
          <p className="text-gurken-400">
            Registriere dich und werde ein erleuchtetes Mitglied der Gurken
            Sekte.
          </p>
        </div>

        <SignUp
          automaticRedirect
          firstTab="password"
          extraInfo={
            <p className="text-gurken-500 text-xs text-center mt-4">
              Bereits Mitglied? 🥒{" "}
              <a
                href="/mitglieder/login"
                className="text-gurken-400 hover:text-gurken-300 underline underline-offset-2"
              >
                Jetzt anmelden
              </a>
            </p>
          }
        />
      </div>
    </div>
  );
}
