"use client";

import { useState } from "react";
import type { ReactNode } from "react";

function istGmailAdresse(wert: string): boolean {
  const mail = wert.trim().toLowerCase();
  if (!mail.includes("@")) return false;
  const domain = mail.split("@").pop() ?? "";
  return domain === "gmail.com" || domain === "googlemail.com";
}

/** Mail-Felder im Container finden (gezielt per Typ/Name, sonst per Wert-Fallback). */
function findeMailFelder(root: ParentNode): HTMLInputElement[] {
  const gezielt = root.querySelectorAll<HTMLInputElement>(
    'input[type="email"], input[inputmode="email"], input[autocomplete="email"], input[name*="mail"], input[name*="email"]',
  );
  if (gezielt.length > 0) return [...gezielt];
  return [...root.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')].filter(
    (el) => el.value.includes("@"),
  );
}

/**
 * Wrapper um Login-/Signup-Formulare: Sobald eine Gmail-Adresse eingetippt ist,
 * erscheint der Spam-Hinweis (Gmail sortiert unsere Login-Mails gern aus).
 */
export function GmailSpamHinweis({ children }: { children: ReactNode }) {
  const [gmail, setGmail] = useState(false);

  return (
    <div
      onInput={(e) => {
        const felder = findeMailFelder(e.currentTarget);
        setGmail(felder.some((f) => istGmailAdresse(f.value)));
      }}
    >
      {children}
      {gmail && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-[#8fa96d]/25 bg-[#8fa96d]/[0.06] px-3 py-2 text-xs leading-relaxed text-[#a3ad9a]"
        >
          📬 <strong className="text-[#ede8d6]">Gmail-Adresse erkannt:</strong> Unsere
          Login-Mail landet bei Gmail gern im <strong className="text-[#ede8d6]">Spam-Ordner</strong>{" "}
          – schau dort nach, falls nichts ankommt.
        </p>
      )}
    </div>
  );
}
