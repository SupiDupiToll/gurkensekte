"use client";

import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string | number;
  reset: (widgetId: string | number) => void;
};

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
};

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Wiederverwendbares Cloudflare-Turnstile-Widget im Gurken-Stil.
 *
 * Rendert genau ein Widget, meldet das Token per `onVerify` und setzt sich
 * per `resetKey`-Wechsel zurück (z. B. nach einem 403 vom Server). Ohne
 * konfigurierten Site-Key wird ein Hinweis statt des Widgets gezeigt.
 */
export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  resetKey = 0,
  className = "",
}: {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  resetKey?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  });
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current) return;
    const turnstile = (window as TurnstileWindow).turnstile;
    if (!turnstile || widgetIdRef.current !== null) return;

    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: string) => callbacksRef.current.onVerify(token),
      "expired-callback": () => callbacksRef.current.onExpire?.(),
      "error-callback": () => callbacksRef.current.onError?.(),
    });
  }, [siteKey]);

  // Widget bei Bedarf zurücksetzen (z. B. nach abgelaufenem Token).
  useEffect(() => {
    if (resetKey === 0) return;
    const turnstile = (window as TurnstileWindow).turnstile;
    if (turnstile && widgetIdRef.current !== null) {
      turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  useEffect(() => {
    if (!siteKey) return;
    if ((window as TurnstileWindow).turnstile) {
      renderWidget();
      return;
    }

    const existingScript =
      document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", renderWidget);
      return () =>
        existingScript.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderWidget);
    document.head.appendChild(script);

    return () => script.removeEventListener("load", renderWidget);
  }, [siteKey, renderWidget]);

  if (!siteKey) {
    return (
      <div
        className={`rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-200 ${className}`}
      >
        Turnstile ist nicht konfiguriert (NEXT_PUBLIC_TURNSTILE_SITE_KEY
        fehlt).
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gurken-500/20 bg-gurken-900/40 p-3 ${className}`}
    >
      <div ref={containerRef} />
    </div>
  );
}

/** Ob das Captcha im Frontend überhaupt lösbar ist (Site-Key gesetzt). */
export function turnstileKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
