"use client";

import { useUser } from "@hexclave/next";
import { DuellPage } from "@/components/DuellPage";

export default function DuellRoute() {
  // Ausgeloggte Besucher werden direkt zur Anmeldung umgeleitet.
  useUser({ or: "redirect" });

  return (
    <DuellPage
      punkteApiBase="/api/mitglieder/punkte"
      duellApiBase="/api/mitglieder/duell"
      backHref="/mitglieder"
    />
  );
}
