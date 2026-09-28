"use client";

import { useEffect } from "react";
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  encodeReferralCookie,
  hasReferralCookie,
} from "@/lib/referral";

/**
 * Fängt einen Werbe-Link (`?ref=<userId>`) ab und hinterlegt den Code still als
 * Cookie. Rendert bewusst nichts.
 */
export function ReferralCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    // Nur plausible Werbe-Codes übernehmen: kein Müll aus der URL ins Cookie.
    if (!ref || ref.length > 128) return;
    if (hasReferralCookie(document.cookie)) return;

    const cookieBase = `${REFERRAL_COOKIE}=${encodeReferralCookie(ref)}; Path=/; SameSite=Lax; Max-Age=${REFERRAL_COOKIE_MAX_AGE}`;
    document.cookie =
      window.location.protocol === "https:"
        ? `${cookieBase}; Secure`
        : cookieBase;
  }, []);

  return null;
}
