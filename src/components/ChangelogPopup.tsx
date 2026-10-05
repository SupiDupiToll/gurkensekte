"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "@phosphor-icons/react";
import {
  CHANGELOG_STORAGE_KEY,
  CHANGELOG_URL,
  extrahiereChangelogVersion,
  parseChangelogKoerper,
  parseInline,
  teileChangelogSchritte,
  type ChangelogBlock,
  type ChangelogSchritt,
} from "@/lib/changelog";

function Inline({ text }: { text: string }) {
  const teile = parseInline(text);
  return (
    <>
      {teile.map((teil, i) =>
        teil.href ? (
          <Link
            key={i}
            href={teil.href}
            className="mt-1 inline-flex min-h-[40px] items-center rounded-lg bg-[#ede8d6] px-4 py-1.5 text-[13px] font-semibold text-[#0b120d] transition-transform active:scale-[0.98]"
          >
            {teil.text}
          </Link>
        ) : teil.bold ? (
          <strong key={i} className="text-[#ede8d6]">
            {teil.text}
          </strong>
        ) : (
          <span key={i}>{teil.text}</span>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: ChangelogBlock }) {
  if (block.kind === "h3") {
    return (
      <h4 className="mt-3 text-sm font-semibold text-[#ede8d6]">
        <Inline text={block.text} />
      </h4>
    );
  }
  if (block.kind === "li") {
    const istLinkZeile = /^\[.+?\]\(.+?\)\s*$/.test(block.text);
    if (istLinkZeile) {
      return (
        <p className="mt-2 flex flex-wrap gap-2">
          <Inline text={block.text} />
        </p>
      );
    }
    return (
      <li className="mt-1.5 flex gap-2 text-sm leading-relaxed text-[#a3ad9a]">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-[#8fa96d]">
          •
        </span>
        <span>
          <Inline text={block.text} />
        </span>
      </li>
    );
  }
  return (
    <p className="mt-2 text-sm leading-relaxed text-[#a3ad9a]">
      <Inline text={block.text} />
    </p>
  );
}

function Fortschritt({ aktiv, anzahl }: { aktiv: number; anzahl: number }) {
  if (anzahl <= 1) return null;
  return (
    <div
      className="tour-fortschritt"
      aria-label={`Schritt ${aktiv + 1} von ${anzahl}`}
    >
      {Array.from({ length: anzahl }).map((_, i) => (
        <span key={i} className={i <= aktiv ? "aktiv" : ""} />
      ))}
    </div>
  );
}

/**
 * Neuigkeiten-Tour wie die Einleitung: holt `public/neuigkeiten.md` bei jedem
 * Seitenbesuch im Mitgliederbereich, zeigt aber jede `##`-Rubrik als eigenen
 * Schritt (Weiter/Zurück statt alles auf einmal). Einmal pro Version
 * (localStorage) – Schließen oder Überspringen markiert als gesehen.
 * Fail-open: Lädt die Datei nicht, bleibt alles still.
 */
export function ChangelogPopup() {
  const [version, setVersion] = useState<string | null>(null);
  const [ueberschrift, setUeberschrift] = useState("Neu im Glas");
  const [schritte, setSchritte] = useState<ChangelogSchritt[]>([]);
  const [offen, setOffen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const res = await fetch(CHANGELOG_URL, { cache: "no-cache" });
        if (!res.ok) return;
        const md = await res.text();
        const v = extrahiereChangelogVersion(md);
        if (!v) return;
        if (!aktiv) return;
        const teile = teileChangelogSchritte(parseChangelogKoerper(md));
        setVersion(v);
        setUeberschrift(teile.ueberschrift);
        setSchritte(teile.schritte);
        let gesehen: string | null = null;
        try {
          gesehen = window.localStorage.getItem(CHANGELOG_STORAGE_KEY);
        } catch {
          gesehen = null;
        }
        if (gesehen !== v) {
          setIndex(0);
          setOffen(true);
        }
      } catch {
        // Still bleiben: kein Changelog, keine Tour.
      }
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  const alsGesehenMarkieren = useCallback(() => {
    try {
      if (version) window.localStorage.setItem(CHANGELOG_STORAGE_KEY, version);
    } catch {
      // Ignore (privater Modus o.ä.)
    }
  }, [version]);

  function schliessen() {
    setOffen(false);
    alsGesehenMarkieren();
  }

  function weiter() {
    if (index + 1 >= schritte.length) {
      schliessen();
    } else {
      setIndex((i) => i + 1);
    }
  }

  function zurueck() {
    setIndex((i) => Math.max(0, i - 1));
  }

  // Manuelles Öffnen über den Button im Mitgliederbereich (von vorne).
  useEffect(() => {
    function oeffnen() {
      setIndex(0);
      setOffen(true);
    }
    window.addEventListener("gurke:changelog-oeffnen", oeffnen);
    return () => window.removeEventListener("gurke:changelog-oeffnen", oeffnen);
  }, []);

  // Scroll sperren wie bei der Einleitung, solange die Karte offen ist.
  useEffect(() => {
    if (!offen) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = vorher;
    };
  }, [offen]);

  if (!offen || schritte.length === 0) return null;

  const schritt = schritte[Math.min(index, schritte.length - 1)];
  const letzter = index >= schritte.length - 1;
  const listenEintraege = schritt.bloecke.filter((b) => b.kind === "li");
  const rest = schritt.bloecke.filter((b) => b.kind !== "li");

  return (
    <>
      <div className="tour-overlay" aria-hidden="true" />
      <div
        className="tour-karte"
        role="dialog"
        aria-modal="true"
        aria-label={schritt.titel || ueberschrift}
      >
        <div className="rounded-2xl border border-white/10 bg-[#101b14] px-5 py-5 text-center shadow-2xl md:px-6">
          <Fortschritt aktiv={index} anzahl={schritte.length} />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7565]">
            {ueberschrift}
            {schritte.length > 1
              ? ` · Schritt ${index + 1} von ${schritte.length}`
              : ""}
          </p>
          <div key={`${version}-${index}`} className="tour-balance mt-2">
            <div className="mb-2 flex justify-center" aria-hidden="true">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8fa96d]/15">
                <Megaphone size={24} weight="fill" className="text-[#8fa96d]" />
              </span>
            </div>
            {schritt.titel && (
              <h2 className="font-display mt-1 text-2xl font-semibold text-[#faf8f1]">
                {schritt.titel}
              </h2>
            )}
            <div className="text-left">
              {rest.map((b, i) => (
                <Block key={i} block={b} />
              ))}
              {listenEintraege.length > 0 && (
                <ul className="mt-1">
                  {listenEintraege.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={zurueck}
                className="flex min-h-[48px] items-center justify-center rounded-lg border border-white/10 px-5 py-2.5 text-sm font-semibold text-[#a3ad9a] transition-colors hover:border-white/25 hover:text-[#ede8d6]"
              >
                ← Zurück
              </button>
            )}
            <button
              type="button"
              onClick={weiter}
              className="btn-cta btn-cta-primary min-h-[48px] flex-1 !text-[15px]"
            >
              {letzter ? "Fertig" : "Weiter →"}
            </button>
          </div>
          <button
            type="button"
            onClick={schliessen}
            className="mt-3 min-h-[40px] w-full rounded-lg text-[13px] font-semibold text-[#6b7565] transition-colors hover:text-[#a3ad9a]"
          >
            Überspringen
          </button>
        </div>
      </div>
    </>
  );
}

/** Button zum erneuten Öffnen (hängt am selben Event wie oben). */
export function ChangelogButton() {
  function oeffnen() {
    window.dispatchEvent(new Event("gurke:changelog-oeffnen"));
  }
  return (
    <button
      type="button"
      onClick={oeffnen}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-[#a3ad9a] transition-colors hover:border-[#abc189]/40 hover:text-[#ede8d6]"
    >
      <Megaphone size={14} weight="fill" />
      Neuigkeiten
    </button>
  );
}
