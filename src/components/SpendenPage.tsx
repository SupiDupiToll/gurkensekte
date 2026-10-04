"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { Reveal } from "@/components/Reveal";
import { MANGOE_BASE_URL, isMangoeSuccessMessage } from "@/lib/mangoe";
import {
  ArrowRight,
  CheckCircle,
  Minus,
  Plus,
  ArrowSquareOut,
  X,
} from "@phosphor-icons/react";

type Phase = "idle" | "loading" | "ready" | "error";

export function SpendenPage() {
  const [amountEur, setAmountEur] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const abgebrochen = searchParams.get("abgebrochen") === "1";

  const embedCheckout = useCallback((url: string) => {
    const sdk = window.MangoePay;
    if (sdk) {
      try {
        // Hoch einbetten (Viewport-Anteil), danach per Style auf die
        // volle Modal-Höhe strecken – das SDK setzt sonst fixe Pixel.
        sdk.embed("#mangoe-pay-box", url, {
          height: Math.max(700, Math.floor(window.innerHeight * 0.82)),
          title: "Mangoe Spenden-Checkout",
        });
      } catch (error) {
        console.error("Mangoe embed fehlgeschlagen, Fallback-Iframe:", error);
      }
    }
    // Iframe (SDK oder Fallback) auf die volle Box-Höhe strecken.
    requestAnimationFrame(() => {
      const box = document.getElementById("mangoe-pay-box");
      if (!box) return;
      if (!box.querySelector("iframe")) {
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.title = "Mangoe Spenden-Checkout";
        box.appendChild(iframe);
      }
      const frame = box.querySelector("iframe");
      if (frame) {
        frame.style.width = "100%";
        frame.style.height = "100%";
        frame.style.border = "0";
      }
    });
  }, []);

  async function starteCheckout() {
    setPhase("loading");
    setFehler(null);
    try {
      const res = await fetch("/api/spenden/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountEur }),
      });
      const data = (await res.json()) as {
        sessionId?: string;
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.sessionId || !data.checkoutUrl) {
        throw new Error(data.error ?? "Checkout fehlgeschlagen");
      }
      setSessionId(data.sessionId);
      setCheckoutUrl(data.checkoutUrl);
      setPhase("ready");
      setModalOpen(true);
      // Ein Frame weiter warten, bis das Modal im DOM ist.
      const url = data.checkoutUrl;
      requestAnimationFrame(() => embedCheckout(url));
    } catch (error) {
      console.error("Spenden-Checkout:", error);
      setFehler(
        error instanceof Error ? error.message : "Checkout fehlgeschlagen",
      );
      setPhase("error");
    }
  }

  function oeffneModal() {
    setModalOpen(true);
    // Falls die Box leer ist (z. B. SDK war beim Start blockiert), erneut einbetten.
    if (checkoutUrl) {
      const url = checkoutUrl;
      requestAnimationFrame(() => {
        const box = document.getElementById("mangoe-pay-box");
        if (box && !box.querySelector("iframe")) embedCheckout(url);
      });
    }
  }

  function schliesseModal() {
    setModalOpen(false);
  }

  function reset() {
    setModalOpen(false);
    setPhase("idle");
    setCheckoutUrl(null);
    setSessionId(null);
    setFehler(null);
    const box = document.getElementById("mangoe-pay-box");
    if (box) box.innerHTML = "";
  }

  // Modal: Body-Scroll sperren, ESC schließt.
  useEffect(() => {
    if (!(phase === "ready" && modalOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, modalOpen]);

  // Browser-Event der eingebetteten Erfolgsseite: danach IMMER serverseitig
  // verifizieren (Status-Route), nie dem Event allein vertrauen.
  useEffect(() => {
    if (phase !== "ready" || !sessionId) return;
    const sid = sessionId;
    function onMessage(event: MessageEvent) {
      if (event.origin !== new URL(MANGOE_BASE_URL).origin) return;
      if (!isMangoeSuccessMessage(event.data)) return;
      fetch(`/api/spenden/status?sessionId=${encodeURIComponent(sid)}`)
        .then((res) => res.json())
        .then((status: { paid?: boolean; orderNumber?: string | null }) => {
          if (status.paid) {
            const order = status.orderNumber ?? event.data.order ?? "";
            router.push(
              `/spenden/danke?session_id=${encodeURIComponent(sid)}${order ? `&order=${encodeURIComponent(order)}` : ""}`,
            );
          }
        })
        .catch((error) => console.error("Status-Prüfung:", error));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase, sessionId, router]);

  const betragLabel = amountEur.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
  });

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 pb-24 pt-12 md:pt-20">
      <Script src={`${MANGOE_BASE_URL}/mangoe.js`} strategy="afterInteractive" />
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        {/* Links: Editorial */}
        <div className="md:col-span-5">
          <Reveal>
            <p className="eyebrow">Opfergabe</p>
            <h1 className="font-display mt-4 max-w-md text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-5xl">
              Eine Spende für das nächste Glas.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-[#a3ad9a]">
              Deine Gabe hält das Einlegeglas am Laufen: Server, Gurken und die
              Weisheiten von Gürkchen. Jeder Euro wird feierlich eingelegt.
            </p>
            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <span className="text-5xl" aria-hidden="true">
                🥒
              </span>
              <div>
                <p className="tabular font-display text-3xl font-semibold text-[#ede8d6]">
                  {betragLabel} €
                </p>
                <p className="text-xs text-[#6b7565]">Deine gewählte Gabe</p>
              </div>
            </div>
            <p className="mt-6 max-w-[46ch] text-xs leading-relaxed text-[#6b7565]">
              Alle Zahlungen laufen über Mangoe Payments. Nicht steuerlich
              absetzbar. Frag im Zweifel deinen Gurkenberater.
            </p>
          </Reveal>
        </div>

        {/* Rechts: Double-Bezel Spendenkarte */}
        <div className="md:col-span-7">
          <Reveal delay={1}>
            <div className="shell">
              <div className="core p-6 md:p-9">
                {abgebrochen && phase === "idle" && (
                  <p className="mb-4 rounded-lg border border-[#c9a86a]/30 bg-[#c9a86a]/10 px-4 py-3 text-sm text-[#e2d9bf]">
                    Zahlung abgebrochen – kein Geld geflossen. Wähle einfach
                    einen neuen Betrag.
                  </p>
                )}

                <p className="text-sm font-semibold text-[#8fa96d]">
                  Betrag wählen
                </p>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[1, 5, 10, 25, 50].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountEur(val)}
                      disabled={phase === "loading"}
                      className={`tabular min-h-[48px] rounded-lg text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] disabled:opacity-50 ${
                        amountEur === val
                          ? "bg-[#ede8d6] text-[#0b120d]"
                          : "border border-white/10 text-[#a3ad9a] hover:border-[#abc189]/35 hover:text-[#ede8d6]"
                      }`}
                    >
                      {val} €
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <button
                    onClick={() => setAmountEur(Math.max(0.5, amountEur - 0.5))}
                    disabled={phase === "loading"}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 text-[#ede8d6] transition-all duration-300 hover:border-[#abc189]/40 active:scale-95 disabled:opacity-50"
                    aria-label="Betrag verringern"
                  >
                    <Minus size={18} weight="bold" />
                  </button>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={amountEur}
                      disabled={phase === "loading"}
                      onChange={(e) =>
                        setAmountEur(
                          Math.max(0.5, parseFloat(e.target.value) || 0.5),
                        )
                      }
                      aria-label="Spendenbetrag in Euro"
                      className="tabular w-24 bg-transparent text-center text-3xl font-semibold text-[#faf8f1] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50"
                    />
                    <span className="text-lg font-semibold text-[#6b7565]">
                      €
                    </span>
                  </div>
                  <button
                    onClick={() => setAmountEur(amountEur + 0.5)}
                    disabled={phase === "loading"}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 text-[#ede8d6] transition-colors hover:border-[#abc189]/40 active:scale-95 disabled:opacity-50"
                    aria-label="Betrag erhöhen"
                  >
                    <Plus size={18} weight="bold" />
                  </button>
                </div>

                {phase !== "ready" ? (
                  <button
                    onClick={starteCheckout}
                    disabled={phase === "loading"}
                    className="btn-cta btn-cta-primary mt-6 w-full disabled:opacity-60"
                  >
                    {phase === "loading"
                      ? "Glas wird geöffnet …"
                      : ` ${betragLabel} € via Mangoe spenden`}
                    <span className="btn-dot">
                      <ArrowRight size={16} weight="bold" />
                    </span>
                  </button>
                ) : (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      onClick={oeffneModal}
                      className="btn-cta btn-cta-primary"
                    >
                      Zahlung fortsetzen
                      <span className="btn-dot">
                        <ArrowRight size={16} weight="bold" />
                      </span>
                    </button>
                    <button
                      onClick={reset}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-[#cfc8b0] transition-colors hover:border-[#abc189]/40 hover:text-[#faf8f1]"
                    >
                      Neuer Betrag
                    </button>
                  </div>
                )}

                {fehler && (
                  <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {fehler}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Checkout-Popup: großes Modal, Iframe füllt die Fläche */}
      {phase === "ready" && modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Mangoe Spenden-Checkout"
        >
          <button
            aria-label="Checkout schließen"
            onClick={schliesseModal}
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
          />
          <div className="relative flex h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101b14] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
              <p className="text-sm font-semibold text-[#ede8d6]">
                <span aria-hidden="true">🥒</span> {betragLabel} € spenden{" "}
                <span className="font-normal text-[#6b7565]">
                  · Mangoe Payments
                </span>
              </p>
              <button
                onClick={schliesseModal}
                aria-label="Popup schließen"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#cfc8b0] transition-colors hover:border-[#abc189]/40 hover:text-[#faf8f1]"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div
              id="mangoe-pay-box"
              className="min-h-0 flex-1 bg-white"
              aria-live="polite"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
              <p className="flex items-center gap-2 text-xs text-[#6b7565]">
                <CheckCircle size={14} />
                Sicherer Checkout – du verlässt die Seite nicht.
              </p>
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#cfc8b0] transition-colors hover:text-[#faf8f1]"
                >
                  <ArrowSquareOut size={14} />
                  In neuem Tab öffnen
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
