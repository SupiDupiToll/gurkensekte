"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignUp } from "@hexclave/next";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import { GmailSpamHinweis } from "@/components/GmailSpamHinweis";

const CONSENT_KEY = "gurken-einwilligung";
const AGB_VERSION = "2026-10";

function leseEinwilligung(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { version?: string; acceptedAt?: string };
    return data.version === AGB_VERSION && Boolean(data.acceptedAt);
  } catch {
    return false;
  }
}

export default function SignUpPage() {
  const user = useUser();
  const router = useRouter();
  const [zugestimmt, setZugestimmt] = useState<boolean>(leseEinwilligung);

  useEffect(() => {
    if (user) {
      router.replace("/mitglieder");
    }
  }, [user, router]);

  function handleConsentChange(checked: boolean) {
    setZugestimmt(checked);
    try {
      if (checked) {
        localStorage.setItem(
          CONSENT_KEY,
          JSON.stringify({
            version: AGB_VERSION,
            acceptedAt: new Date().toISOString(),
          }),
        );
      } else {
        localStorage.removeItem(CONSENT_KEY);
      }
    } catch {
      /* Speicher nicht verfügbar – Zustimmung gilt nur für diese Sitzung */
    }
  }

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

          <label
            htmlFor="agb-einwilligung"
            className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-[#abc189]/40"
          >
            <input
              id="agb-einwilligung"
              type="checkbox"
              checked={zugestimmt}
              onChange={(e) => handleConsentChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#8fa96d]"
            />
            <span className="text-[13px] leading-relaxed text-[#a3ad9a]">
              Ich habe die{" "}
              <a
                href="/agb"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
                onClick={(e) => e.stopPropagation()}
              >
                AGB
              </a>{" "}
              und die{" "}
              <a
                href="/datenschutz"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
                onClick={(e) => e.stopPropagation()}
              >
                Datenschutzrichtlinie
              </a>{" "}
              gelesen und akzeptiert und erlaube der Gurken Sekte, mir E-Mails
              zu schicken.
            </span>
          </label>

          {zugestimmt ? (
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
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
              <p className="text-sm leading-relaxed text-[#6b7565]">
                Bitte setze oben das Häkchen, um mit der Registrierung
                fortzufahren. 🥒
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
