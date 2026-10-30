"use client";

import { useEffect, useRef, useState } from "react";
import { TurnstileWidget, turnstileKonfiguriert } from "@/components/TurnstileWidget";
import type { CaptchaLoesung } from "@/lib/captchaClient";

/** Gepinnte Widget-Version – verhindert unerwartete Upstream-Änderungen. */
const CAP_WIDGET_SRC =
  "https://cdn.jsdelivr.net/npm/cap-widget@0.1.58/cap.min.js";
/** Ab hier wird der manuelle Wechsel angeboten. */
const CAP_WIDGET_SLOW_MS = 4_000;
/** Danach wird automatisch auf Turnstile gewechselt. */
const CAP_WIDGET_TIMEOUT_MS = 10_000;

let capWidgetSkript: Promise<void> | null = null;

function ladeCapWidget(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.customElements.get("cap-widget")) return Promise.resolve();
  if (capWidgetSkript) return capWidgetSkript;

  capWidgetSkript = new Promise<void>((resolve, reject) => {
    const vorhanden = document.querySelector<HTMLScriptElement>(
      "script[data-cap-widget]",
    );

    // Das Skript kann bereits geladen sein, während der Custom-Element-
    // Name noch nicht registriert ist. `whenDefined` deckt beide Fälle ab.
    const fertig = () => {
      window.customElements
        .whenDefined("cap-widget")
        .then(() => resolve())
        .catch((error) => {
          capWidgetSkript = null;
          reject(error);
        });
    };

    if (vorhanden?.dataset.capWidgetStatus === "loaded") {
      fertig();
      return;
    }

    const script = vorhanden ?? document.createElement("script");
    script.addEventListener("load", () => {
      script.dataset.capWidgetStatus = "loaded";
      fertig();
    }, { once: true });
    script.addEventListener(
      "error",
      () => {
        capWidgetSkript = null;
        script.remove();
        reject(new Error("Cap-Widget-Skript konnte nicht geladen werden"));
      },
      { once: true },
    );

    if (!vorhanden) {
      script.src = CAP_WIDGET_SRC;
      script.async = true;
      script.dataset.capWidget = "true";
      document.head.appendChild(script);
    }
  });

  return capWidgetSkript;
}

function capEndpunkt(): string | null {
  const siteKey = process.env.NEXT_PUBLIC_CAP_SITE_KEY?.trim();
  if (!siteKey) return null;
  const server = (
    process.env.NEXT_PUBLIC_CAP_SERVER_URL?.trim() ||
    "https://cap.sdtoll.de"
  ).replace(/\/+$/, "");
  return `${server}/${encodeURIComponent(siteKey)}/`;
}

/**
 * Captcha-Widget im Gurken-Stil: Cap als primärer Schutz, Cloudflare
 * Turnstile als automatischer Fallback.
 *
 * Der Fallback greift, wenn das Cap-Skript nicht lädt, das Widget einen
 * Fehler meldet (z. B. Cap-Server down/CORS) oder das Widget nach 10 Sekunden
 * noch nicht bereit ist. Nutzer können zusätzlich manuell auf Turnstile
 * wechseln. `onVerify` bekommt Anbieter + Token, damit die Requests das
 * richtige Feld (`capToken` bzw. `turnstileToken`) senden.
 */
export function CaptchaWidget({
  onVerify,
  onExpire,
  onError,
  resetKey = 0,
  className = "",
}: {
  onVerify: (loesung: CaptchaLoesung) => void;
  onExpire?: () => void;
  onError?: () => void;
  resetKey?: number;
  className?: string;
}) {
  const capEndpoint = capEndpunkt();
  const turnstileAktiv = turnstileKonfiguriert();

  const [modus, setModus] = useState<"cap" | "turnstile" | "keins">(
    capEndpoint ? "cap" : turnstileAktiv ? "turnstile" : "keins",
  );
  const [langsam, setLangsam] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  });

  // Cap-Widget bei Bedarf (neu) aufbauen. resetKey erzwingt einen frischen
  // Solve – Cap-Tokens sind Single-Use.
  useEffect(() => {
    if (modus !== "cap" || !capEndpoint) return;
    const container = containerRef.current;
    if (!container) return;

    let abgebrochen = false;
    let bereit = false;
    setLangsam(false);
    const langsamTimer = setTimeout(() => {
      if (!abgebrochen) setLangsam(true);
    }, CAP_WIDGET_SLOW_MS);
    // Nur solange das Widget noch nicht steht: Ein Nutzer, der sich Zeit
    // lässt, soll nicht mitten im Lösen auf Turnstile geworfen werden.
    const fallbackTimer = setTimeout(() => {
      if (!abgebrochen && !bereit) fallbackOderFehler();
    }, CAP_WIDGET_TIMEOUT_MS);

    function fallbackOderFehler() {
      if (abgebrochen) return;
      // Ein evtl. schon gelöstes Cap-Token verfällt beim Anbieterwechsel.
      callbacksRef.current.onExpire?.();
      if (turnstileAktiv) {
        setModus("turnstile");
      } else {
        callbacksRef.current.onError?.();
      }
    }

    ladeCapWidget()
      .then(() => {
        if (abgebrochen || !container) return;
        bereit = true;
        clearTimeout(langsamTimer);
        clearTimeout(fallbackTimer);
        setLangsam(false);
        const widget = document.createElement("cap-widget");
        widget.setAttribute("data-cap-api-endpoint", capEndpoint);
        // Deutsche Labels, passend zum Rest der Seite.
        widget.setAttribute("data-cap-i18n-initial-state", "Ich bin ein Mensch");
        widget.setAttribute("data-cap-i18n-verifying-label", "Wird geprüft …");
        widget.setAttribute("data-cap-i18n-solved-label", "Bestätigt");
        widget.setAttribute("data-cap-i18n-error-label", "Captcha-Fehler");
        widget.setAttribute(
          "data-cap-i18n-troubleshooting-label",
          "Hilfe",
        );
        widget.setAttribute(
          "data-cap-i18n-verify-aria-label",
          "Klicken, um zu bestätigen, dass du ein Mensch bist",
        );
        widget.setAttribute(
          "data-cap-i18n-verifying-aria-label",
          "Wird geprüft, bitte warten",
        );
        widget.setAttribute(
          "data-cap-i18n-verified-aria-label",
          "Bestätigt",
        );
        widget.setAttribute(
          "data-cap-i18n-error-aria-label",
          "Ein Fehler ist aufgetreten, bitte erneut versuchen",
        );

        widget.addEventListener("solve", (event) => {
          const detail = (event as CustomEvent<{ token?: string }>).detail;
          if (!detail?.token) return;
          setLangsam(false);
          callbacksRef.current.onVerify({
            token: detail.token,
            anbieter: "cap",
          });
        });
        widget.addEventListener("reset", () => {
          callbacksRef.current.onExpire?.();
        });
        widget.addEventListener("error", () => {
          fallbackOderFehler();
        });

        container.replaceChildren(widget);
      })
      .catch((error) => {
        console.warn("Captcha: Cap-Widget nicht verfügbar.", error);
        fallbackOderFehler();
      });

    return () => {
      abgebrochen = true;
      clearTimeout(langsamTimer);
      clearTimeout(fallbackTimer);
      container.replaceChildren();
    };
  }, [modus, capEndpoint, turnstileAktiv, resetKey]);

  if (modus === "keins") {
    return (
      <div
        className={`rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-200 ${className}`}
      >
        Captcha ist nicht konfiguriert (NEXT_PUBLIC_CAP_SITE_KEY oder
        NEXT_PUBLIC_TURNSTILE_SITE_KEY fehlt).
      </div>
    );
  }

  if (modus === "turnstile") {
    return (
      <div className={className}>
        <TurnstileWidget
          resetKey={resetKey}
          onVerify={(token) =>
            callbacksRef.current.onVerify({ token, anbieter: "turnstile" })
          }
          onExpire={() => callbacksRef.current.onExpire?.()}
          onError={() => callbacksRef.current.onError?.()}
        />
        {capEndpoint && (
          <p className="mt-2 text-center text-[11px] text-[#6b7565]">
            Cap ist gerade nicht erreichbar – Turnstile schützt dieses Formular.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gurken-500/20 bg-gurken-900/40 p-3 ${className}`}
    >
      <div ref={containerRef} />
      {langsam && (
        <button
          type="button"
          onClick={() => {
            if (turnstileAktiv) setModus("turnstile");
            else callbacksRef.current.onError?.();
          }}
          className="mt-2 min-h-[32px] w-full text-center text-[11px] font-semibold text-[#a3ad9a] underline decoration-white/20 underline-offset-2 transition-colors hover:text-[#ede8d6]"
        >
          Captcha lädt nicht? Anderen Schutz verwenden
        </button>
      )}
    </div>
  );
}

/** Ob im Frontend überhaupt ein Captcha gelöst werden kann. */
export function captchaKonfiguriert(): boolean {
  return Boolean(capEndpunkt() || turnstileKonfiguriert());
}
