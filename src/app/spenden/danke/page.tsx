"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Reveal } from "@/components/Reveal";

type Status = "pruefe" | "bezahlt" | "offen" | "fehler";

function DankeInhalt() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const order = searchParams.get("order");
  const [status, setStatus] = useState<Status>(sessionId ? "pruefe" : "offen");
  const [betrag, setBetrag] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    // URL-Parameter nie allein vertrauen – Abschluss serverseitig verifizieren.
    fetch(`/api/spenden/status?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then(
        (data: {
          paid?: boolean;
          amountCents?: number | null;
          currency?: string | null;
        }) => {
          if (data.paid) {
            setStatus("bezahlt");
            if (typeof data.amountCents === "number") {
              setBetrag(
                (data.amountCents / 100).toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                }),
              );
            }
          } else {
            setStatus("offen");
          }
        },
      )
      .catch(() => setStatus("fehler"));
  }, [sessionId]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-16 text-center md:pt-24">
      <Reveal>
        <p className="text-6xl" aria-hidden="true">
          🥒
        </p>
        {status === "pruefe" && (
          <>
            <h1 className="font-display mt-6 text-4xl font-semibold text-[#faf8f1]">
              Das Glas prüft deine Gabe …
            </h1>
            <p className="mt-4 text-[15px] text-[#a3ad9a]">
              Einen Moment, Gürkchen zählt die Gurken.
            </p>
          </>
        )}
        {status === "bezahlt" && (
          <>
            <p className="eyebrow mt-6">Opfergabe bestätigt</p>
            <h1 className="font-display mt-4 text-4xl font-semibold text-[#faf8f1] md:text-5xl">
              Gürkchen dankt dir{betrag ? ` für ${betrag} €` : ""}.
            </h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-[#a3ad9a]">
              Deine Spende ist eingelegt.
              {order ? ` Bestellung ${order}.` : ""} Möge dein Kühlschrank nie
              leer sein.
            </p>
            <Link
              href="/"
              className="btn-cta btn-cta-primary mx-auto mt-8 w-fit"
            >
              Zurück zum Glas
            </Link>
          </>
        )}
        {status === "offen" && (
          <>
            <h1 className="font-display mt-6 text-4xl font-semibold text-[#faf8f1]">
              Noch nichts eingelegt.
            </h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-[#a3ad9a]">
              Wir konnten keine bezahlte Spende finden. Falls du gerade gezahlt
              hast, warte kurz und lade neu – oder starte einfach erneut.
            </p>
            <Link
              href="/spenden"
              className="btn-cta btn-cta-primary mx-auto mt-8 w-fit"
            >
              Erneut spenden
            </Link>
          </>
        )}
        {status === "fehler" && (
          <>
            <h1 className="font-display mt-6 text-4xl font-semibold text-[#faf8f1]">
              Das Glas klemmt.
            </h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-[#a3ad9a]">
              Die Prüfung ist fehlgeschlagen. Lade die Seite neu – dein Geld ist
              bei Mangoe sicher, es wurde nichts doppelt abgebucht.
            </p>
            <Link
              href="/spenden"
              className="btn-cta btn-cta-primary mx-auto mt-8 w-fit"
            >
              Zurück zur Spende
            </Link>
          </>
        )}
      </Reveal>
    </main>
  );
}

export default function SpendenDankePage() {
  return (
    <Suspense>
      <DankeInhalt />
    </Suspense>
  );
}
