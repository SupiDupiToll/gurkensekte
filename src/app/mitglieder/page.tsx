"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, useHexclaveApp } from "@hexclave/next";
import { buildTippieLink } from "@/lib/tippie";
import {
  SpinningCucumber,
  FloatingCucumber,
  WigglingCucumber,
} from "@/components/SpinningCucumber";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function GurkchenChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Sei gegrüßt, mein Gurken-Kind! 🥒 Ich bin Gürkchen, der allmächtige Anführer der einen wahren Sekte. Was bedrückt deine eingelegte Seele?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
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
            "Gürkchen meditiert gerade im Glas und ist nicht erreichbar. Versuch's gleich nochmal. 🥒",
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
    <div className="bg-gurken-900/40 rounded-2xl p-6 md:p-8 border border-gurken-500/20 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <WigglingCucumber size="text-3xl" />
          <h2 className="text-xl font-black text-gurken-200">
            Gürkchen-Chat
          </h2>
        </div>
        <button
          onClick={() => setChatVisible(!chatVisible)}
          className="text-gurken-400 hover:text-gurken-200 text-sm font-bold transition-colors"
        >
          {chatVisible ? "Schließen" : "Öffnen"}
        </button>
      </div>

      {chatVisible && (
        <>
          <div className="max-h-80 overflow-y-auto space-y-3 mb-4 pr-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-gurken-700/80 text-gurken-100 rounded-br-md border border-gurken-500/30"
                      : "bg-gurken-800/80 text-gurken-200 rounded-bl-md border border-gurken-500/20"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <span className="text-gurken-400 text-[10px] font-bold tracking-wide uppercase block mb-0.5">
                      🥒 Gürkchen
                    </span>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}

            {showSpinner && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2 bg-gurken-800/80 border border-gurken-500/20 rounded-bl-md">
                  <span className="inline-block animate-cucumber-spin text-xl">
                    🥒
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Schreib deine Nachricht an Gürkchen..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-gurken-500/30 bg-gurken-800/60 px-3 py-2.5 text-sm text-gurken-100 placeholder-gurken-500/50 outline-none transition-all duration-200 focus:border-gurken-400 focus:shadow-[0_0_16px_#22c55e]/30 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-gurken-600 px-4 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-gurken-500 hover:shadow-[0_0_20px_#22c55e]/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Senden
            </button>
          </div>
        </>
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
        <div className="bg-gurken-900/40 rounded-2xl p-8 border border-gurken-500/20">
          <SpinningCucumber size="text-5xl" />
          <h1 className="text-2xl font-black text-gurken-300 mt-4 mb-2">
            Zugang verweigert!
          </h1>
          <p className="text-gurken-400 mb-6">
            Nur eingeweihte Mitglieder der Gurken Sekte haben Zutritt.
          </p>
          <button
            onClick={() => app.redirectToSignIn()}
            className="px-6 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:scale-105 active:scale-95"
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
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
      <div className="text-center mb-10">
        <SpinningCucumber size="text-5xl" />
        <h1 className="text-3xl md:text-4xl font-black text-gurken-300 mt-4 animate-pulse-glow">
          Mitgliederbereich
        </h1>
        <p className="text-gurken-400 mt-2">
          Willkommen, erleuchtete(r) {user.displayName ?? "Gurkenfreund"}!
        </p>
        <p className="text-gurken-500 text-xs mt-1">E-Mail: {email}</p>
      </div>

      {/* Member Dashboard */}
      <div className="bg-gurken-900/40 rounded-2xl p-6 md:p-8 border border-gurken-500/20 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <FloatingCucumber size="text-3xl" />
          <h2 className="text-xl font-black text-gurken-200">
            Dein spirituelles Gurken-Dashboard
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="bg-gurken-800/40 rounded-xl p-4 border border-gurken-500/20">
            <p className="text-gurken-500 text-xs uppercase tracking-wider">
              Mitglied seit
            </p>
            <p className="text-gurken-200 font-bold">
              {user.signedUpAt
                ? new Date(user.signedUpAt).toLocaleDateString("de-DE")
                : "Urzeiten der Gurke"}
            </p>
          </div>
          <div className="bg-gurken-800/40 rounded-xl p-4 border border-gurken-500/20">
            <p className="text-gurken-500 text-xs uppercase tracking-wider">
              Status
            </p>
            <p className="text-gurken-200 font-bold">Erleuchtet ✅</p>
          </div>
        </div>

        {/* Buy Cucumber Section */}
        <div className="bg-gurken-800/50 rounded-xl p-6 border border-gurken-400/30 text-center">
          <WigglingCucumber size="text-4xl" />
          <h3 className="text-lg font-black text-gurken-300 mt-3 mb-2">
            Kaufe eine heilige Gurke! (echt!!!)
          </h3>
          <p className="text-gurken-400 text-sm mb-1">
            Nur 1,20 &euro; &mdash; exklusiv f&uuml;r eingeweihte Mitglieder.
          </p>
          <p className="text-gurken-500 text-xs mb-4">
            Du bekommst eine echte Gurke!!
          </p>
          <a
            href={tippieHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:scale-105 active:scale-95"
          >
            🥒 Gurke kaufen (1,20 &euro;)
          </a>
        </div>
      </div>

      {/* Gürkchen-Chat – exklusiv für Mitglieder */}
      <GurkchenChat />

      {/* Sign Out */}
      <div className="text-center">
        <button
          onClick={() => app.redirectToSignOut()}
          className="px-6 py-2 rounded-lg border border-gurken-600/50 text-gurken-500 hover:text-gurken-400 hover:border-gurken-500 text-sm font-bold transition-all"
        >
          Ausloggen
        </button>
      </div>

      <div className="flex justify-center mt-8 gap-2 opacity-50">
        <FloatingCucumber size="text-2xl" />
        <WigglingCucumber size="text-2xl" />
        <SpinningCucumber size="text-2xl" />
      </div>
    </div>
  );
}
