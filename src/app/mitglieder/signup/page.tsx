"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignUp } from "@hexclave/next";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import { GmailSpamHinweis } from "@/components/GmailSpamHinweis";

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
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <div className="auth-signup shell">
        <div className="core p-8 md:p-10">
          <div className="mb-6 text-center">
            <div className="flex justify-center">
              <SpinningCucumber size="text-6xl" />
            </div>
            <p className="eyebrow mt-4 justify-center">Einlegeglas Nr. 7</p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-[#faf8f1]">
              Der Sekte beitreten
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#a3ad9a]">
              Registriere dich und werde ein erleuchtetes Mitglied der Gurken Sekte.
            </p>
          </div>

          <GmailSpamHinweis>
            <SignUp
              automaticRedirect
              firstTab="password"
              extraInfo={
                <p className="mt-4 text-center text-xs text-[#6b7565]">
                  Bereits Mitglied?{" "}
                  <a
                    href="/mitglieder/login"
                    className="text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
                  >
                    Jetzt anmelden
                  </a>
                </p>
              }
            />
          </GmailSpamHinweis>
        </div>
      </div>
    </div>
  );
}
