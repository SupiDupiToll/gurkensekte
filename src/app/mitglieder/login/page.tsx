"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignIn } from "@hexclave/next";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import { GmailSpamHinweis } from "@/components/GmailSpamHinweis";

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
    <div className="mx-auto max-w-md px-4 py-12 md:py-20">
      <div className="auth-signin shell">
        <div className="core p-8 md:p-10">
          <div className="mb-6 text-center">
            <div className="flex justify-center">
              <SpinningCucumber size="text-6xl" />
            </div>
            <p className="eyebrow mt-4 justify-center">Willkommen zurück</p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-[#faf8f1]">
              Mitglieder-Login
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#a3ad9a]">
              Melde dich an, um in den exklusiven Mitgliederbereich zu gelangen.
            </p>
          </div>

          <GmailSpamHinweis>
            <SignIn automaticRedirect firstTab="password" />
          </GmailSpamHinweis>
        </div>
      </div>
    </div>
  );
}
