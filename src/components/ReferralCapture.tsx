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
    if (!ref) return;
    if (hasReferralCookie(document.cookie)) return;

    document.cookie = `${REFERRAL_COOKIE}=${encodeReferralCookie(
      ref,
    )}; Path=/; SameSite=Lax; Max-Age=${REFERRAL_COOKIE_MAX_AGE}`;
  }, []);

  return null;
}
