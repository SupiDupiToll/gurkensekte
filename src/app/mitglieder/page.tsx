"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, useHexclaveApp } from "@hexclave/next";
import { buildTippieLink } from "@/lib/tippie";
import {
  SpinningCucumber,
  FloatingCucumber,
  WigglingCucumber,
  BouncingCucumber,
  ShakingCucumber,
} from "@/components/SpinningCucumber";
import {
  PaperPlaneTilt,
  SignOut,
  ShoppingCart,
  CalendarBlank,
  ShieldCheck,
  ChatDots,
  ArrowsInSimple,
  Coin,
  Gift,
  Basket,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { PunkteProvider, usePunkte, claimPunkte } from "@/components/PunkteContext";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function PunkteAnzeige() {
  const { punkte, loading, dailyAvailable, verlauf, refresh } = usePunkte();
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingRedeem, setClaimingRedeem] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function handleDaily() {
    setClaimingDaily(true);
    const result = await claimPunkte("daily");
    if (result) {
      await refresh();
    }
    setClaimingDaily(false);
  }

  async function handleRedeem() {
    setClaimingRedeem(true);
    const result = await claimPunkte("einloesen");
    if (result) {
      await refresh();
    }
    setClaimingRedeem(false);
  }

  if (loading) {
    return (
      <div className="card p-6 md:p-8 mb-8 text-center">
        <SpinningCucumber size="text-3xl" />
      </div>
    );
  }

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <Coin size={24} weight="fill" className="text-yellow-400" />
        <h2 className="text-xl font-heading font-bold text-gurken-200">
          🥒 Punkte & Belohnungen 🥒
        </h2>
      </div>

      {/* Points Balance */}
      <div className="bg-gurken-800/40 rounded-2xl p-6 text-center mb-6 border border-gurken-500/10">
        <div className="text-gurken-500 text-xs uppercase tracking-wider mb-1">
          Dein Gurkensegen
        </div>
        <div className="text-5xl font-heading font-bold text-yellow-300 mb-1">
          {punkte}
        </div>
        <div className="text-gurken-400 text-sm">🥒 Punkte</div>

        {punkte >= 300 ? (
          <div className="mt-4 space-y-3">
            <div className="text-gurken-300 text-sm">
              🥒 Du hast genug Punkte für eine <strong>echte Gurke</strong>!
              Gürkchen persönlich schickt sie dir per Post. 🥒
            </div>
            <button
              onClick={handleRedeem}
              disabled={claimingRedeem}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gurken-500 hover:bg-gurken-400 text-gurken-950 font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 touch-manipulation min-h-[48px]"
            >
              <Basket size={20} weight="fill" />
              {claimingRedeem ? "Wird eingelöst…" : "🥒 Jetzt echte Gurke bestellen"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gurken-500 mb-1.5">
              <span>Nächste Belohnung: Echte Gurke 🥒</span>
              <span>{punkte} / 300 Punkte</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gurken-800/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gurken-600 to-yellow-400 transition-all duration-500"
                style={{ width: `${Math.min((punkte / 300) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-4">
        <div className="bg-gurken-800/30 rounded-xl p-4 border border-gurken-500/10 flex items-center justify-between">
          <div>
            <div className="text-gurken-400 text-xs uppercase tracking-wider mb-1">
              Täglicher Bonus
            </div>
            <div className="text-gurken-200 font-bold text-lg">+20 🥒</div>
          </div>
          <button
            onClick={handleDaily}
            disabled={!dailyAvailable || claimingDaily}
            className="px-4 py-2.5 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-sm transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] flex items-center gap-1.5"
          >
            <Gift size={18} weight="fill" />
            {claimingDaily
              ? "…"
              : dailyAvailable
                ? "Abholen"
                : "✅ Erledigt"}
          </button>
        </div>

        <div className="bg-gurken-800/30 rounded-xl p-4 border border-gurken-500/10">
          <div className="text-gurken-400 text-xs uppercase tracking-wider mb-1">
            So sammelst du Punkte
          </div>
          <ul className="text-gurken-300 text-sm space-y-1">
            <li>🥒 Zitat generieren: +5</li>
            <li>🥒 Chat-Nachricht: +3</li>
            <li>🥒 Täglicher Bonus: +20</li>
            <li className="text-yellow-400/80 font-bold pt-1 border-t border-gurken-500/10 mt-1">
              🎁 300 Punkte → Echte Gurke bestellen
            </li>
          </ul>
        </div>
      </div>

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-1.5 text-gurken-500 hover:text-gurken-400 text-xs font-bold transition-all"
      >
        <ClockCounterClockwise size={14} />
        {showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}
      </button>

      {showHistory && (
        <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
          {verlauf.length === 0 && (
            <p className="text-gurken-500 text-xs">Noch keine Aktivität</p>
          )}
          {[...verlauf].reverse().map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-gurken-800/20"
            >
              <span className="text-gurken-400">
                {new Date(e.datum).toLocaleString("de-DE")}
              </span>
              <span className="text-gurken-300 capitalize">{e.aktion}</span>
              <span
                className={`font-bold ${e.punkte > 0 ? "text-yellow-400" : "text-red-400"}`}
              >
                {e.punkte > 0 ? "+" : ""}
                {e.punkte}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GurkchenQuote() {
  const [quote, setQuote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { refresh } = usePunkte();

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/guerkchen/quote");
      const data = await res.json();
      setQuote(data.quote);
      claimPunkte("zitat");
      refresh();
    } catch {
      setQuote("Die Gurke ist der Urknall in essbarer Form. – Gürkchen 🥒");
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-4">
          <SpinningCucumber size="text-3xl" />
        </div>
      ) : (
        <blockquote className="text-gurken-200 text-lg italic leading-relaxed mb-4 min-h-[3rem]">
          &bdquo;{quote}&rdquo;
        </blockquote>
      )}
      <button
        onClick={fetchQuote}
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-sm transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
      >
        🥒 Neues Zitat
      </button>
    </div>
  );
}

function GurkchenChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "🥒 Sei gegrüßt, mein Gurken-Kind! 🥒 Ich bin Gürkchen, der allmächtige Anführer der einen wahren Sekte. Was bedrückt deine eingelegte Seele?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { refresh } = usePunkte();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const history = [...messages, userMessage];

    try {
      const res = await fetch("/api/guerkchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("text/plain")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        let fullContent = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullContent,
            };
            return updated;
          });
        }
      } else {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }

      claimPunkte("chat");
      refresh();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "🥒 Gürkchen meditiert gerade im Glas und ist nicht erreichbar. Versuch's gleich nochmal. 🥒",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasAssistantResponse =
    messages.length > 1 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content.length > 0;

  const showSpinner = loading && !hasAssistantResponse;

  return (
    <div>
      {/* Messages */}
      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] md:max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-gurken-600/80 text-gurken-100 rounded-br-md"
                  : "bg-gurken-800/60 text-gurken-200 rounded-bl-md border border-gurken-500/15"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="flex items-center gap-1 text-gurken-400 text-[10px] font-bold tracking-wide uppercase block mb-1">
                  🥒 Gürkchen
                </span>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {showSpinner && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 bg-gurken-800/60 border border-gurken-500/15 rounded-bl-md">
              <SpinningCucumber size="text-xl" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="🥒 Schreib deine Nachricht an Gürkchen..."
          rows={2}
          disabled={loading}
          inputMode="text"
          enterKeyHint="send"
          className="flex-1 min-h-[44px] resize-none rounded-xl border border-gurken-500/20 bg-gurken-800/50 px-3 py-2.5 text-sm text-gurken-100 placeholder-gurken-500/40 outline-none transition-all duration-200 focus:border-gurken-400 focus:shadow-[0_0_16px_#22c55e]/20 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-gurken-600 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-gurken-500 hover:shadow-[0_0_20px_#22c55e]/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="Nachricht senden"
        >
          <PaperPlaneTilt size={20} weight="fill" />
        </button>
      </div>
    </div>
  );
}

function GurkchenSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-8">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="relative w-full group overflow-hidden rounded-2xl border border-gurken-500/20 bg-gradient-to-br from-gurken-700/40 via-gurken-800/30 to-gurken-900/40 p-8 md:p-10 text-center transition-all duration-300 hover:border-gurken-400/40 hover:shadow-[0_0_40px_#22c55e33] hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#22c55e0a_0%,_transparent_70%)] group-hover:bg-[radial-gradient(ellipse_at_center,_#22c55e15_0%,_transparent_70%)] transition-all duration-500" />
          <div className="relative">
            <div className="text-6xl mb-4">
              <SpinningCucumber size="text-6xl" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold text-gurken-200 mb-2">
              🥒 Gürkchen &mdash; Der Erleuchtete 🥒
            </h2>
            <p className="text-gurken-400 text-sm md:text-base mb-6 max-w-md mx-auto">
              Lausche den heiligen Gurken-Weisheiten oder tausche dich mit dem
              allmächtigen Gürkchen aus.
            </p>
            <span className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gurken-500 hover:bg-gurken-400 text-gurken-950 font-bold text-lg transition-all duration-200 shadow-[0_0_20px_#22c55e33] group-hover:shadow-[0_0_30px_#22c55e66]">
              <ChatDots size={22} weight="fill" />
              Öffnen
            </span>
          </div>
        </button>
      ) : (
        <div className="card p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <WigglingCucumber size="text-3xl" />
              <h2 className="text-xl font-heading font-bold text-gurken-200">
                🥒 Gürkchen 🥒
              </h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-gurken-400 hover:text-gurken-200 hover:bg-gurken-800/50 text-sm font-bold transition-all touch-manipulation min-h-[44px]"
            >
              <ArrowsInSimple size={18} />
              Schließen
            </button>
          </div>

          {/* Quote */}
          <div className="mb-8 text-center pb-8 border-b border-gurken-500/10">
            <GurkchenQuote />
          </div>

          {/* Chat */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ChatDots size={18} weight="fill" className="text-gurken-400" />
              <h3 className="text-gurken-300 font-bold text-sm uppercase tracking-wider">
                Chat mit Gürkchen
              </h3>
            </div>
            <GurkchenChat />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MitgliederPage() {
  const user = useUser();
  const app = useHexclaveApp();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="card p-8">
          <SpinningCucumber size="text-5xl" />
          <h1 className="text-2xl font-heading font-bold text-gurken-300 mt-4 mb-2">
            🥒 Zugang verweigert! 🥒
          </h1>
          <p className="text-gurken-400 mb-6">
            Nur eingeweihte Mitglieder der Gurken Sekte haben Zutritt.
          </p>
          <button
            onClick={() => app.redirectToSignIn()}
            className="btn-cta btn-cta-primary"
          >
            Jetzt anmelden 🥒
          </button>
        </div>
      </div>
    );
  }

  const email = user.primaryEmail ?? "unbekannt@sektenmitglied.de";
  const tippieHref = buildTippieLink({
    amountEur: 1.2,
    reference: `Gurke gekauft - GurkenSekte - ${email}`,
  });

  return (
    <PunkteProvider>
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-24 relative pb-safe">
        {/* Decorative cucumbers */}
        <div className="hidden md:flex flex-col gap-6 fixed left-4 top-1/3 opacity-25 pointer-events-none">
          <SpinningCucumber size="text-3xl" />
          <WigglingCucumber size="text-2xl" />
          <BouncingCucumber size="text-3xl" />
        </div>
        <div className="hidden md:flex flex-col gap-6 fixed right-4 top-1/3 opacity-25 pointer-events-none">
          <FloatingCucumber size="text-3xl" />
          <ShakingCucumber size="text-2xl" />
          <SpinningCucumber size="text-3xl" reverse />
        </div>

        <div className="text-center mb-10">
          <SpinningCucumber size="text-5xl" />
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gurken-300 mt-4">
            🥒 Mitgliederbereich 🥒
          </h1>
          <p className="text-gurken-400 mt-2">
            Willkommen, erleuchtete(r) {user.displayName ?? "Gurkenfreund"}! 🥒
          </p>
          <p className="text-gurken-500 text-xs mt-1">E-Mail: {email}</p>
        </div>

        {/* Member Dashboard */}
        <div className="card p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <FloatingCucumber size="text-3xl" />
            <h2 className="text-xl font-heading font-bold text-gurken-200">
              🥒 Dein spirituelles Dashboard 🥒
            </h2>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-8">
            <div className="bg-gurken-800/30 rounded-xl p-4 border border-gurken-500/10">
              <div className="flex items-center gap-2 text-gurken-500 text-xs uppercase tracking-wider mb-1">
                <CalendarBlank size={14} />
                🥒 Mitglied seit
              </div>
              <p className="text-gurken-200 font-bold text-base">
                {user.signedUpAt
                  ? new Date(user.signedUpAt).toLocaleDateString("de-DE")
                  : "Urzeiten der Gurke"}
              </p>
            </div>
            <div className="bg-gurken-800/30 rounded-xl p-4 border border-gurken-500/10">
              <div className="flex items-center gap-2 text-gurken-500 text-xs uppercase tracking-wider mb-1">
                <ShieldCheck size={14} />
                🥒 Status
              </div>
              <p className="text-gurken-200 font-bold text-base flex items-center gap-1.5 flex-wrap">
                Erleuchtet 🥒
                <ShieldCheck
                  size={16}
                  weight="fill"
                  className="text-gurken-400"
                />
              </p>
            </div>
          </div>
        </div>

        {/* Punkte & Belohnungen */}
        <PunkteAnzeige />

        {/* Gürkchen-Sektion */}
        <GurkchenSection />

        {/* Sign Out */}
        <div className="text-center">
          <button
            onClick={() => app.redirectToSignOut()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gurken-600/40 text-gurken-500 hover:text-gurken-400 hover:border-gurken-500 text-sm font-bold transition-all hover:bg-gurken-800/30 touch-manipulation"
          >
            <SignOut size={16} />
            🥒 Ausloggen 🥒
          </button>
        </div>

        <div className="flex justify-center mt-8 gap-3 opacity-40">
          <FloatingCucumber size="text-2xl" />
          <WigglingCucumber size="text-2xl" />
          <SpinningCucumber size="text-2xl" />
          <BouncingCucumber size="text-2xl" />
          <ShakingCucumber size="text-2xl" />
        </div>
      </div>
    </PunkteProvider>
  );
}
