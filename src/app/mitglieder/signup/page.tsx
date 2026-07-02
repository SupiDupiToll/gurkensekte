"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignUp } from "@hexclave/next";
import { SpinningCucumber } from "@/components/SpinningCucumber";

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
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="bg-gurken-900/40 rounded-2xl p-8 border border-gurken-500/20">
        <div className="text-center mb-6">
          <SpinningCucumber size="text-6xl" />
          <h1 className="text-2xl font-black text-gurken-300 mt-4 mb-2">
            Der Sekte beitreten
          </h1>
          <p className="text-gurken-400">
            Registriere dich und werde ein erleuchtetes Mitglied der Gurken
            Sekte.
          </p>
        </div>

        <SignUp
          automaticRedirect
          extraInfo={
            <p className="text-gurken-500 text-xs text-center mt-4">
              Bereits Mitglied?{" "}
              <a
                href="/mitglieder/login"
                className="text-gurken-400 hover:text-gurken-300 underline"
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
