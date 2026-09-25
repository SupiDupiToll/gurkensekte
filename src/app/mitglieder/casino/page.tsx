"use client";

import { useUser } from "@hexclave/next";
import { CasinoPage } from "@/components/CasinoPage";

export default function CasinoRoute() {
  // Ausgeloggte Besucher werden direkt zur Anmeldung umgeleitet.
  useUser({ or: "redirect" });

  return (
    <CasinoPage
      punkteApiBase="/api/mitglieder/punkte"
      backHref="/mitglieder"
    />
  );
}
