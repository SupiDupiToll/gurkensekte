"use client";

import { useEffect } from "react";

/** Registriert den minimalen Service Worker (nötig für PWA-Installierbarkeit). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // still installierbar via Manifest, SW ist Kür
      });
    }
  }, []);
  return null;
}
