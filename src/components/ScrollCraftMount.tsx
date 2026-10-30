"use client";

import { useEffect, useRef, type ReactNode } from "react";

declare global {
  interface Window {
    ScrollCraft?: {
      mount: (root: Element, opts?: { lerp?: number }) => { layout: () => void };
    };
  }
}

let engineLaden: Promise<void> | null = null;

/**
 * Lädt die scrollcraft-Engine einmal pro Dokument und mountet sie am
 * Startseiten-Wrapper. Die Engine ist vanilla JS und erzeugt kein DOM; sie
 * liest nur die data-sc-* Attribute aus dem Markup.
 */
function ladeEngine(): Promise<void> {
  if (window.ScrollCraft) return Promise.resolve();
  if (engineLaden) return engineLaden;

  engineLaden = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/scrollcraft/scrollcraft.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("scrollcraft engine failed to load"));
    document.head.appendChild(script);
  });

  return engineLaden;
}

export function ScrollCraftMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let abgebrochen = false;
    let frame = 0;
    let entferneHalt: (() => void) | undefined;
    const root = ref.current;

    ladeEngine()
      .then(() => {
        if (abgebrochen || !root || root.dataset.scMounted === "1") return;
        root.dataset.scMounted = "1";
        window.ScrollCraft?.mount(root);

        // Eigene Bewegungen (Knick-Wort, wachsende Zeile) sind für die Engine
        // unsichtbar. Der Prüfstand liest data-sc-verify-state, also schreiben
        // wir die tatsächlich gezeichnete Position hinein: ehrlicher Zustand
        // statt Scroll-Fortschritt.
        const ziele = Array.from(
          root.querySelectorAll<HTMLElement>("[data-sc-verify]"),
        );
        if (ziele.length === 0) return;

        // Bei reduzierter Bewegung steht der Riss bewusst still. Der Prüfstand
        // darf diese gerahmte Ruhe nicht als Stillstand der Seite lesen, also
        // deklarieren wir sie als gewollten Halt (nur dann).
        const bewegung = window.matchMedia("(prefers-reduced-motion: reduce)");
        const setzeHalt = () => {
          for (const ziel of ziele) {
            if (bewegung.matches) {
              ziel.setAttribute("data-sc-verify-hold", "true");
            } else {
              ziel.removeAttribute("data-sc-verify-hold");
            }
          }
        };
        setzeHalt();
        bewegung.addEventListener("change", setzeHalt);
        entferneHalt = () => {
          bewegung.removeEventListener("change", setzeHalt);
          for (const ziel of ziele) ziel.removeAttribute("data-sc-verify-hold");
        };

        const takt = () => {
          for (const ziel of ziele) {
            const lese = ziel.dataset.scVerifyRead;
            const gemessen =
              (lese ? ziel.querySelector<HTMLElement>(lese) : null) ?? ziel;
            const r = gemessen.getBoundingClientRect();
            const imBild =
              r.bottom > 0 &&
              r.top < window.innerHeight &&
              r.right > 0 &&
              r.left < window.innerWidth;

            // Gerundete, gerenderte Werte. Außerhalb des Bildes gar kein
            // Prüfwert, damit die Stillstands-Erkennung für die ruhigen
            // Fließabschnitte weiter greift.
            const wert = imBild
              ? `${ziel.dataset.scVerify ?? "state"}:${Math.round(r.left)},${Math.round(r.top)}`
              : null;

            if (wert === null) {
              if (ziel.hasAttribute("data-sc-verify-state")) {
                ziel.removeAttribute("data-sc-verify-state");
              }
            } else if (ziel.getAttribute("data-sc-verify-state") !== wert) {
              ziel.setAttribute("data-sc-verify-state", wert);
            }
          }
          frame = requestAnimationFrame(takt);
        };
        frame = requestAnimationFrame(takt);
      })
      .catch(() => {
        // Ohne Engine bleibt die Seite lesbar: die Inhalte sind echtes HTML und
        // alle Cues starten sichtbar, sobald der Beobachter fehlt (noscript-Regel).
        document.documentElement.classList.add("sc-fallback");
      });

    return () => {
      abgebrochen = true;
      if (frame) cancelAnimationFrame(frame);
      entferneHalt?.();
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
