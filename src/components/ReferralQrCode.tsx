"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, DownloadSimple, QrCode } from "@phosphor-icons/react";

/**
 * Werbe-Link als QR-Code im Ente-QR-Design.
 *
 * Stil-Vorgaben aus Ente QR (https://qr.ente.com):
 * - Module `rounded`, Farbe `#171B19`
 * - Corner-Frames `extra-rounded`, Farbe `#171B19`
 * - Corner-Eyes `dot`, Farbe `#00B33C`
 * - Hintergrund `#FFFFFF`, Error Correction `Q`
 * - Weiße Kachel mit großem Radius, Code auf 82 % Breite
 *
 * Die Kachel bleibt bewusst weiß (hoher Kontrast scannt am besten),
 * auch wenn der Rest der Seite dunkel ist.
 */

const ENTE_DOTS = "#171B19";
const ENTE_EYE = "#00B33C";
const ENTE_BG = "#FFFFFF";
const PREVIEW_SIZE = 360;
const EXPORT_SIZE = 1024;

type QrInstance = {
  append: (el: HTMLElement) => void;
  update: (opts: Record<string, unknown>) => void;
  getRawData: (ext?: "png" | "svg") => Promise<Blob | null>;
};

function enteOptions(size: number, data: string) {
  return {
    width: size,
    height: size,
    type: "svg" as const,
    data,
    margin: 8,
    qrOptions: { errorCorrectionLevel: "Q" as const },
    dotsOptions: { type: "rounded" as const, color: ENTE_DOTS },
    backgroundOptions: { color: ENTE_BG },
    cornersSquareOptions: { type: "extra-rounded" as const, color: ENTE_DOTS },
    cornersDotOptions: { type: "dot" as const, color: ENTE_EYE },
  };
}

/** Benachbarte Module hinterlassen AA-Haarlinien; Halb-Pixel-Stroke versiegelt sie. */
function sealSeams(svg: SVGSVGElement) {
  const bg = ENTE_BG.toLowerCase();
  svg.querySelectorAll("rect, path, circle").forEach((el) => {
    const fill = (el.getAttribute("fill") ?? "").toLowerCase();
    if (!fill || fill === "none" || fill === bg) return;
    el.setAttribute("stroke", fill);
    el.setAttribute("stroke-width", "0.6");
  });
}

export function ReferralQrCode({ data }: { data: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QrInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"png" | "svg" | "copy" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // QR-Lib erst im Browser laden (SSR-sicher), Instanz einmal aufbauen.
  // Link-Änderungen danach übernimmt der Update-Effect unten.
  useEffect(() => {
    if (!data || qrRef.current || !mountRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: QRCodeStyling } = await import("qr-code-styling");
      if (cancelled || !mountRef.current) return;
      mountRef.current.innerHTML = "";
      const qr = new QRCodeStyling(enteOptions(PREVIEW_SIZE, data)) as unknown as QrInstance;
      qr.append(mountRef.current);
      qrRef.current = qr;
      // Ein Frame später sitzen die SVG-Knoten – dann Nähte versiegeln.
      requestAnimationFrame(() => {
        const svg = mountRef.current?.querySelector("svg");
        if (svg) sealSeams(svg);
      });
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  // Link-Änderungen (z. B. andere Origin) ohne Neuaufbau übernehmen.
  useEffect(() => {
    if (!data || !qrRef.current) return;
    qrRef.current.update({ data });
    requestAnimationFrame(() => {
      const svg = mountRef.current?.querySelector("svg");
      if (svg) sealSeams(svg);
    });
  }, [data]);

  // Instanz beim Unmount aufräumen.
  useEffect(() => {
    const mount = mountRef.current;
    return () => {
      qrRef.current = null;
      if (mount) mount.innerHTML = "";
    };
  }, []);

  async function freshExportQr(): Promise<QrInstance> {
    const { default: QRCodeStyling } = await import("qr-code-styling");
    return new QRCodeStyling(
      enteOptions(EXPORT_SIZE, data),
    ) as unknown as QrInstance;
  }

  function flash(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 1600);
  }

  async function download(ext: "png" | "svg") {
    if (!data || busy) return;
    setBusy(ext);
    try {
      const qr = await freshExportQr();
      const blob = await qr.getRawData(ext);
      if (!blob) throw new Error("empty");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gurken-sekte-werbelink.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash(ext === "png" ? "PNG gespeichert" : "SVG gespeichert");
    } catch {
      flash("Download fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function copyPng() {
    if (!data || busy) return;
    if (!(navigator.clipboard && window.ClipboardItem)) {
      flash("Kopieren nicht unterstützt");
      return;
    }
    setBusy("copy");
    try {
      const qr = await freshExportQr();
      const blobPromise = qr.getRawData("png").then((b) => {
        if (!b) throw new Error("empty");
        return b;
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      flash("QR kopiert");
    } catch {
      flash("Kopieren fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gurken-500/10 bg-gurken-800/30 px-4 py-4 text-sm text-gurken-400">
        <QrCode size={22} className="flex-shrink-0" />
        QR-Code erscheint, sobald dein Werbe-Link geladen ist …
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gurken-500/10 bg-gurken-800/30 p-4 sm:p-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
        {/* Ente-Kachel: weiß, großer Radius, Code auf 82 % */}
        <div
          className="grid aspect-square w-full max-w-[240px] flex-shrink-0 place-items-center rounded-[28px] bg-white"
          style={{
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.06), 0 32px 80px -24px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div ref={mountRef} className="w-[82%] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" aria-label="QR-Code deines Werbe-Links" role="img" />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="flex items-center justify-center gap-2 text-sm font-bold text-gurken-100 sm:justify-start">
            <QrCode size={18} weight="fill" className="text-gurken-300" />
            QR-Code zum Werbe-Link
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gurken-400">
            Handy draufhalten, Sekte beitreten. Hoher Kontrast scannt am
            besten – teste aus Armlänge. Der Code enthält exakt deinen
            Werbe-Link oben.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => download("png")}
              disabled={!ready || busy !== null}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gurken-500 px-4 py-2.5 text-sm font-bold text-gurken-950 transition-all duration-200 hover:bg-gurken-400 disabled:opacity-50 touch-manipulation"
            >
              <DownloadSimple size={18} weight="bold" />
              {busy === "png" ? "…" : "PNG laden"}
            </button>
            <button
              type="button"
              onClick={() => download("svg")}
              disabled={!ready || busy !== null}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gurken-500/30 px-4 py-2.5 text-sm font-bold text-gurken-200 transition-all duration-200 hover:border-gurken-400 hover:bg-gurken-800/40 disabled:opacity-50 touch-manipulation"
            >
              {busy === "svg" ? "…" : "SVG"}
            </button>
            <button
              type="button"
              onClick={copyPng}
              disabled={!ready || busy !== null}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-gurken-300 transition-all duration-200 hover:bg-gurken-800/50 hover:text-gurken-100 disabled:opacity-50 touch-manipulation"
            >
              {feedback === "QR kopiert" ? (
                <Check size={18} weight="bold" />
              ) : (
                <Copy size={18} weight="bold" />
              )}
              {busy === "copy" ? "…" : "Kopieren"}
            </button>
          </div>
          {feedback && (
            <p className="mt-2 text-xs font-semibold text-gurken-300" role="status">
              {feedback}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
