"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";

export const LITURGIE_SOZIAL_EVENT = "gurke:sozial-erledigt";

function heuteSchluessel(): string {
  return new Date().toISOString().split("T")[0];
}

function sozialSchluessel(heute: string): string {
  return `gurken-liturgie-sozial-${heute}`;
}

/**
 * Markiert die Sozial-Tat für heute als erledigt (Gurkenpost versendet oder
 * Duell gefordert). Wird von GurkenMail/Duell aufgerufen, die Liturgie hört
 * per Event + localStorage zu. Fail-open: ohne localStorage passiert nichts.
 */
export function markiereSozialErledigt() {
  try {
    window.localStorage.setItem(sozialSchluessel(heuteSchluessel()), "1");
    window.dispatchEvent(new Event(LITURGIE_SOZIAL_EVENT));
  } catch {
    // Ignore
  }
}

/**
 * Tagesliturgie: 3 kleine Rituale aus Bestand – Bonus + Zitat + Sozial-Tat.
 * Bonus und Zitat kommen vom Server (usePunkte), Sozial per localStorage.
 * Kein neuer Bonus, nur der Abschlusszwang (2/3 → heute Abend nochmal rein).
 */
export function TagesLiturgie() {
  const { dailyAvailable, quoteRemaining, loading } = usePunkte();
  const [sozial, setSozial] = useState(false);

  useEffect(() => {
    function lesen() {
      try {
        setSozial(
          window.localStorage.getItem(sozialSchluessel(heuteSchluessel())) ===
            "1",
        );
      } catch {
        setSozial(false);
      }
    }
    lesen();
    window.addEventListener(LITURGIE_SOZIAL_EVENT, lesen);
    return () => window.removeEventListener(LITURGIE_SOZIAL_EVENT, lesen);
  }, []);

  function sozialUmschalten() {
    const heute = heuteSchluessel();
    const neu = !sozial;
    setSozial(neu);
    try {
      if (neu) {
        window.localStorage.setItem(sozialSchluessel(heute), "1");
      } else {
        window.localStorage.removeItem(sozialSchluessel(heute));
      }
    } catch {
      // Ignore
    }
  }

  if (loading) return null;

  const bonusErledigt = !dailyAvailable;
  const zitatErledigt = quoteRemaining < 3;
  const aufgaben = [
    {
      id: "bonus",
      label: "Tages-Segen abholen",
      erledigt: bonusErledigt,
      href: null as string | null,
    },
    {
      id: "zitat",
      label: `Zitat generieren (${Math.max(0, 3 - quoteRemaining)}/3 heute)`,
      erledigt: zitatErledigt,
      href: null as string | null,
    },
    {
      id: "sozial",
      label: "Gurkenpost schreiben oder Duell fordern",
      erledigt: sozial,
      href: "/mitglieder/gurkenmail" as string | null,
    },
  ];
  const fertig = aufgaben.filter((a) => a.erledigt).length;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#ede8d6]">
          Tagesliturgie
        </h3>
        <span className="tabular text-[11px] font-semibold text-[#6b7565]">
          {fertig}/3 · {fertig === 3 ? "Glas voll" : "noch offen"}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-lg bg-white/[0.07]">
        <div
          className="h-full rounded-lg bg-[#8fa96d] transition-all duration-500"
          style={{ width: `${(fertig / 3) * 100}%` }}
        />
      </div>
      <ul className="mt-3 space-y-1.5">
        {aufgaben.map((aufgabe) => (
          <li key={aufgabe.id}>
            {aufgabe.id === "sozial" ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={sozialUmschalten}
                  aria-pressed={aufgabe.erledigt}
                  aria-label="Sozial-Tat als erledigt markieren"
                  className="flex min-h-[40px] flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] px-3 py-2 text-left transition-colors hover:border-white/20"
                >
                  {aufgabe.erledigt ? (
                    <CheckCircle
                      size={18}
                      weight="fill"
                      className="shrink-0 text-[#8fa96d]"
                    />
                  ) : (
                    <Circle size={18} className="shrink-0 text-[#6b7565]" />
                  )}
                  <span
                    className={`text-[13px] ${aufgabe.erledigt ? "text-[#a3ad9a] line-through" : "text-[#ede8d6]"}`}
                  >
                    {aufgabe.label}
                  </span>
                </button>
                <Link
                  href="/mitglieder/duell"
                  className="flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
                >
                  Duell
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] px-3 py-2.5">
                {aufgabe.erledigt ? (
                  <CheckCircle
                    size={18}
                    weight="fill"
                    className="shrink-0 text-[#8fa96d]"
                  />
                ) : (
                  <Circle size={18} className="shrink-0 text-[#6b7565]" />
                )}
                <span
                  className={`text-[13px] ${aufgabe.erledigt ? "text-[#a3ad9a] line-through" : "text-[#ede8d6]"}`}
                >
                  {aufgabe.label}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {fertig === 3 && (
        <p className="mt-2 text-center text-xs font-semibold text-[#8fa96d]">
          Glas voll – Gürkchen ist stolz auf dich.
        </p>
      )}
    </div>
  );
}
