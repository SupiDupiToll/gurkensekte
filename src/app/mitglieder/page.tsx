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
} from "@phosphor-icons/react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function GurkchenQuote() {
  const [quote, setQuote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/guerkchen/quote");
      const data = await res.json();
      setQuote(data.quote);
    } catch {
      setQuote("Die Gurke ist der Urknall in essbarer Form. – Gürkchen 🥒");
    } finally {
      setLoading(false);
    }
  }, []);

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
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  if (!open) {
    return (
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:-translate-y-0.5 active:translate-y-0 touch-manipulation min-h-[48px]"
        >
          <ChatDots size={20} weight="fill" />
          🥒 Chat mit Gürkchen öffnen 🥒
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gurken-950 shadow-2xl md:inset-6 md:rounded-2xl md:border md:border-gurken-500/15">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-6 pb-3 border-b border-gurken-500/15">
        <div className="flex items-center gap-3">
          <WigglingCucumber size="text-3xl" />
          <h2 className="text-xl font-heading font-bold text-gurken-200">
            🥒 Gürkchen-Chat 🥒
          </h2>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-gurken-400 hover:text-gurken-200 hover:bg-gurken-800/50 text-sm font-bold transition-all touch-manipulation min-h-[44px]"
          aria-label="Chat schließen"
        >
          <ArrowsInSimple size={18} />
          Schließen
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 md:px-6 py-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] md:max-w-[75%] rounded-2xl px-4 py-2.5 ${
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
      <div className="px-4 md:px-6 py-3 border-t border-gurken-500/15">
        <div className="flex gap-2 items-end max-w-4xl mx-auto w-full">
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

      {/* Gürkchen-Zitat */}
      <div className="card p-6 md:p-8 mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <FloatingCucumber size="text-3xl" />
          <h2 className="text-xl font-heading font-bold text-gurken-200">
            🥒 Gürkchen spricht 🥒
          </h2>
        </div>
        <GurkchenQuote />
      </div>

      {/* Gürkchen-Chat */}
      <GurkchenChat />

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
  );
}
