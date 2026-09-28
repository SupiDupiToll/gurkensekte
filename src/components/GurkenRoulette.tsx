"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner, Target } from "@phosphor-icons/react";
import { usePunkte } from "@/components/PunkteContext";
import {
  TurnstileWidget,
  turnstileKonfiguriert,
} from "@/components/TurnstileWidget";
import {
  ROULETTE_CHANCEN,
  ROULETTE_CHIPS,
  ROULETTE_DUTZENDE,
  ROULETTE_KOLONNEN,
  ROULETTE_MAX_GESAMTEINSATZ,
  ROULETTE_RAD_REIHENFOLGE,
  ROULETTE_ROT,
  istRoteZahl,
  type RouletteEinsatz,
  type RouletteEinsatzTyp,
} from "@/lib/roulette";

function zahl(n: number) {
  return n.toLocaleString("de-DE");
}

/* ── Kessel (Canvas) im Gurken-Design ─────────────────────────────── */

function GurkenKessel({
  dreht,
  ziel,
  gewinnzahl,
  onGelandet,
}: {
  dreht: boolean;
  ziel: number | null;
  gewinnzahl: number | null;
  onGelandet: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const kugelRotationRef = useRef(0);
  const kugelTempoRef = useRef(0);
  const radTempoRef = useRef(0);
  const faelltRef = useRef(false);
  const kugelRadiusRef = useRef(0);
  const gelandetRef = useRef(false);
  // Aktuelle Props für die Animationsschleife (stabile Schleife, keine
  // Closures, die sich selbst referenzieren).
  const standRef = useRef({ dreht, ziel, gewinnzahl, onGelandet });
  useEffect(() => {
    standRef.current = { dreht, ziel, gewinnzahl, onGelandet };
  });

  const maleRad = useCallback(
    (ctx: CanvasRenderingContext2D, breite: number, hoehe: number, rotation: number) => {
      const mitteX = breite / 2;
      const mitteY = hoehe / 2;
      const aussen = Math.min(breite, hoehe) / 2 - 8;
      const innen = aussen * 0.85;
      const zentrum = aussen * 0.55;

      ctx.clearRect(0, 0, breite, hoehe);

      // Äußerer Rand: dunkles Grün statt Grau
      const randFarbverlauf = ctx.createRadialGradient(
        mitteX, mitteY, aussen * 0.9, mitteX, mitteY, aussen,
      );
      randFarbverlauf.addColorStop(0, "#182219");
      randFarbverlauf.addColorStop(0.5, "#2b3826");
      randFarbverlauf.addColorStop(1, "#0b120d");
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, aussen, 0, Math.PI * 2);
      ctx.fillStyle = randFarbverlauf;
      ctx.fill();
      ctx.strokeStyle = "#c9a86a";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const segment = (Math.PI * 2) / 37;
      for (let i = 0; i < 37; i++) {
        const start = rotation + i * segment - Math.PI / 2;
        const ende = start + segment;
        const nummer = ROULETTE_RAD_REIHENFOLGE[i];
        const farbe =
          nummer === 0
            ? "#5c7345"
            : ROULETTE_ROT.includes(nummer)
              ? "#7a3b32"
              : "#131c15";

        ctx.beginPath();
        ctx.moveTo(mitteX, mitteY);
        ctx.arc(mitteX, mitteY, innen, start, ende);
        ctx.closePath();
        ctx.fillStyle = farbe;
        ctx.fill();
        ctx.strokeStyle = "#c9a86a";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.save();
        ctx.translate(mitteX, mitteY);
        ctx.rotate(start + segment / 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ede8d6";
        ctx.font = `600 ${Math.min(13, aussen / 16)}px Outfit, sans-serif`;
        ctx.fillText(nummer.toString(), innen - 20, 0);
        ctx.restore();
      }

      // Goldring + grüne Mitte mit Gurke
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, zentrum, 0, Math.PI * 2);
      ctx.strokeStyle = "#c9a86a";
      ctx.lineWidth = 2;
      ctx.stroke();

      const mitteVerlauf = ctx.createRadialGradient(
        mitteX, mitteY, 0, mitteX, mitteY, zentrum,
      );
      mitteVerlauf.addColorStop(0, "#2b3826");
      mitteVerlauf.addColorStop(0.6, "#111a13");
      mitteVerlauf.addColorStop(1, "#2b3826");
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, zentrum * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = mitteVerlauf;
      ctx.fill();
      ctx.font = `${Math.round(zentrum * 0.9)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🥒", mitteX, mitteY + 2);
    },
    [],
  );

  const maleKugel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      breite: number,
      hoehe: number,
      rotation: number,
      radius: number,
    ) => {
      const mitteX = breite / 2;
      const mitteY = hoehe / 2;
      const x = mitteX + Math.cos(rotation) * radius;
      const y = mitteY + Math.sin(rotation) * radius;

      ctx.beginPath();
      ctx.arc(x + 2, y + 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fill();

      const verlauf = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, 6);
      verlauf.addColorStop(0, "#ffffff");
      verlauf.addColorStop(0.3, "#e0e0e0");
      verlauf.addColorStop(1, "#a0a0a0");
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = verlauf;
      ctx.fill();
    },
    [],
  );

  const maleZeiger = useCallback(
    (ctx: CanvasRenderingContext2D, breite: number) => {
      const mitteX = breite / 2;
      const oben = 10;
      ctx.beginPath();
      ctx.moveTo(mitteX, oben + 20);
      ctx.lineTo(mitteX - 10, oben);
      ctx.lineTo(mitteX + 10, oben);
      ctx.closePath();
      ctx.fillStyle = "#e2d9bf";
      ctx.fill();
      ctx.strokeStyle = "#c9a86a";
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    [],
  );

  // Ein einzelnes Frame: Physik + Zeichnung. Liest alles aus Refs, damit
  // die Schleife stabil bleibt und sich nicht selbst referenziert.
  const maleFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const breite = canvas.width;
    const hoehe = canvas.height;
    const { dreht: drehtGerade, ziel, gewinnzahl, onGelandet } =
      standRef.current;

    if (drehtGerade) {
      radTempoRef.current = Math.max(0, radTempoRef.current - 0.0003);
      rotationRef.current += radTempoRef.current;

      if (!faelltRef.current) {
        kugelTempoRef.current = Math.max(0, kugelTempoRef.current - 0.0002);
        kugelRotationRef.current += kugelTempoRef.current;
        if (kugelTempoRef.current < 0.02) faelltRef.current = true;
      } else if (!gelandetRef.current) {
        const tasche = (Math.min(breite, hoehe) / 2) * 0.75;
        kugelRadiusRef.current = Math.max(tasche, kugelRadiusRef.current - 0.5);
        kugelRotationRef.current += kugelTempoRef.current * 1.5;

        if (kugelRadiusRef.current <= tasche + 5) {
          // Auf der Server-Zahl landen (Ergebnis steht vorher fest).
          const zielZahl = ziel ?? 0;
          const index = Math.max(
            0,
            ROULETTE_RAD_REIHENFOLGE.indexOf(zielZahl),
          );
          const segment = (Math.PI * 2) / 37;
          const normiert = rotationRef.current % (Math.PI * 2);
          kugelRotationRef.current =
            normiert + index * segment - Math.PI / 2 + segment / 2;
          kugelRadiusRef.current = tasche;
          gelandetRef.current = true;
          onGelandet(zielZahl);
        }
      }
    }

    maleRad(ctx, breite, hoehe, rotationRef.current);
    maleKugel(
      ctx,
      breite,
      hoehe,
      kugelRotationRef.current,
      kugelRadiusRef.current,
    );
    maleZeiger(ctx, breite);

    if (gewinnzahl !== null && !drehtGerade && gelandetRef.current) {
      const index = ROULETTE_RAD_REIHENFOLGE.indexOf(gewinnzahl);
      const segment = (Math.PI * 2) / 37;
      ctx.save();
      ctx.translate(breite / 2, hoehe / 2);
      ctx.rotate(index * segment + rotationRef.current);
      const glanz = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      glanz.addColorStop(0, "rgba(250, 204, 21, 0.8)");
      glanz.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.beginPath();
      ctx.arc((Math.min(breite, hoehe) / 2) * 0.75, 0, 25, 0, Math.PI * 2);
      ctx.fillStyle = glanz;
      ctx.fill();
      ctx.restore();
    }

    }, [maleRad, maleKugel, maleZeiger]);

  // Stabile Schleife: läuft dauerhaft, ein Frame liest alles aus Refs.
  useEffect(() => {
    let raf = 0;
    const schleife = () => {
      maleFrame();
      raf = requestAnimationFrame(schleife);
    };
    raf = requestAnimationFrame(schleife);
    return () => cancelAnimationFrame(raf);
  }, [maleFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const passeAn = () => {
      const eltern = canvas.parentElement;
      if (eltern) {
        const rect = eltern.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        kugelRadiusRef.current = Math.min(rect.width, rect.height) / 2 - 25;
      }
    };
    passeAn();
    window.addEventListener("resize", passeAn);
    return () => window.removeEventListener("resize", passeAn);
  }, []);

  useEffect(() => {
    if (!dreht) return;
    radTempoRef.current = 0.15 + Math.random() * 0.05;
    kugelTempoRef.current = 0.2 + Math.random() * 0.05;
    faelltRef.current = false;
    gelandetRef.current = false;
  }, [dreht]);

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))" }}
      />
    </div>
  );
}

/* ── Setztisch ────────────────────────────────────────────────────── */

function Setztisch({
  einsaetze,
  chip,
  onEinsatz,
  gewinnzahl,
  deaktiviert,
}: {
  einsaetze: RouletteEinsatz[];
  chip: number;
  onEinsatz: (e: RouletteEinsatz) => void;
  gewinnzahl: number | null;
  deaktiviert: boolean;
}) {
  const summeAuf = (nummern: number[]) =>
    einsaetze
      .filter(
        (e) =>
          e.numbers.length === nummern.length &&
          e.numbers.every((n) => nummern.includes(n)),
      )
      .reduce((s, e) => s + e.amount, 0);

  const klick = (
    nummern: number[],
    label: string,
    type: RouletteEinsatzTyp,
  ) => {
    if (deaktiviert) return;
    onEinsatz({ type, numbers: nummern, amount: chip, label });
  };

  const zellFarbe = (n: number) =>
    n === 0
      ? "bg-[#2b3826] text-[#ede8d6]"
      : istRoteZahl(n)
        ? "bg-[#4a2b26] text-[#ede8d6]"
        : "bg-white/[0.04] border border-white/10 text-[#ede8d6]";

  const badge = (nummern: number[]) => {
    const summe = summeAuf(nummern);
    if (summe <= 0) return null;
    return (
      <span className="tabular absolute -top-1.5 -right-1.5 bg-[#ede8d6] text-[#0b120d] text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
        {summe}
      </span>
    );
  };

  return (
    <div className="w-full">
      {/* Null oben, volle Breite */}
      <button
        onClick={() => klick([0], "0", "straight")}
        disabled={deaktiviert}
        className={`relative w-full mb-1.5 rounded-lg bg-[#2b3826] py-2.5 text-[#ede8d6] font-semibold text-sm transition-colors hover:bg-[#35492f] disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] ${
          gewinnzahl === 0 ? "ring-1 ring-[#c9a86a]" : ""
        }`}
      >
        0 {badge([0])}
      </button>

      {/* Zahlen 1–36 */}
      <div className="grid grid-cols-6 gap-1.5 mb-1.5">
        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => klick([n], n.toString(), "straight")}
            disabled={deaktiviert}
            className={`tabular relative aspect-square rounded-lg flex items-center justify-center font-semibold text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${zellFarbe(n)} ${
              gewinnzahl === n ? "ring-1 ring-[#c9a86a]" : ""
            }`}
          >
            {n}
            {badge([n])}
          </button>
        ))}
      </div>

      {/* Kolonnen */}
      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {ROULETTE_KOLONNEN.map((k) => (
          <button
            key={k.label}
            onClick={() => klick(k.numbers, k.label, "column")}
            disabled={deaktiviert}
            className="relative rounded-lg bg-white/[0.04] border border-white/10 py-2 text-[#cfc8b0] text-xs font-semibold hover:border-white/25 transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
          >
            2:1 · {k.label}
            {badge(k.numbers)}
          </button>
        ))}
      </div>

      {/* Dutzende */}
      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {ROULETTE_DUTZENDE.map((d) => (
          <button
            key={d.label}
            onClick={() => klick(d.numbers, d.label, "dozen")}
            disabled={deaktiviert}
            className="relative rounded-lg bg-white/[0.04] border border-white/10 py-2 text-[#cfc8b0] text-xs font-semibold hover:border-white/25 transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
          >
            {d.label}
            {badge(d.numbers)}
          </button>
        ))}
      </div>

      {/* Einfache Chancen */}
      <div className="grid grid-cols-3 gap-1.5">
        {ROULETTE_CHANCEN.map((c) => {
          const rot = c.label === "Rot";
          const schwarz = c.label === "Schwarz";
          return (
            <button
              key={c.label}
              onClick={() => klick(c.numbers, c.label, "outside")}
              disabled={deaktiviert}
              className={`relative rounded-lg py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] ${
                rot
                  ? "bg-[#4a2b26] text-[#e8c9c2] hover:bg-[#55332c]"
                  : schwarz
                    ? "bg-white/[0.04] text-[#ede8d6] border border-white/10 hover:border-white/25"
                    : "bg-white/[0.04] border border-white/10 text-[#cfc8b0] hover:border-white/25"
              }`}
            >
              {c.label.toUpperCase()}
              {badge(c.numbers)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Das Spiel ────────────────────────────────────────────────────── */

type ServerErgebnis = {
  gewinnzahl: number;
  auszahlung: number;
  einsatzGesamt: number;
  delta: number;
  punkte: number;
  punkteGesamt: number;
};

/**
 * Gurken Roulette: Einsatz wählen, Felder antippen, Kugel rollen lassen.
 * Die Gewinnzahl zieht der Server – der Kessel zeigt sie nur an.
 */
export function GurkenRoulette({ apiBase }: { apiBase: string }) {
  const { punkte, loading, refresh } = usePunkte();
  const [einsaetze, setEinsaetze] = useState<RouletteEinsatz[]>([]);
  const [chip, setChip] = useState<number>(ROULETTE_CHIPS[0]);
  const [dreht, setDreht] = useState(false);
  const [ziel, setZiel] = useState<number | null>(null);
  const [gewinnzahl, setGewinnzahl] = useState<number | null>(null);
  const [auszahlung, setAuszahlung] = useState<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [captchaPflicht, setCaptchaPflicht] = useState(turnstileKonfiguriert());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaHinweis, setCaptchaHinweis] = useState<string | null>(
    turnstileKonfiguriert()
      ? "Bitte löse kurz das Captcha, dann rollt die Kugel."
      : null,
  );
  const [captchaReset, setCaptchaReset] = useState(0);
  const ausstehendRef = useRef<ServerErgebnis | null>(null);

  const gesamtEinsatz = einsaetze.reduce((s, e) => s + e.amount, 0);

  function platziere(e: RouletteEinsatz) {
    if (dreht || loading) return;
    if (punkte < gesamtEinsatz + e.amount) {
      setFehler(
        `Nicht genug Punkte: ${zahl(gesamtEinsatz + e.amount)} Punkte Einsatz, aber nur ${zahl(punkte)} auf dem Konto.`,
      );
      return;
    }
    if (gesamtEinsatz + e.amount > ROULETTE_MAX_GESAMTEINSATZ) {
      setFehler(
        `Höchstens ${zahl(ROULETTE_MAX_GESAMTEINSATZ)} Punkte pro Dreh – nimm erst Einsätze zurück.`,
      );
      return;
    }
    setFehler(null);
    setEinsaetze((prev) => [...prev, e]);
  }

  function zuruecknehmen() {
    if (dreht) return;
    setEinsaetze([]);
    setGewinnzahl(null);
    setAuszahlung(null);
    setDelta(null);
    setFehler(null);
  }

  async function drehen() {
    if (dreht || loading || einsaetze.length === 0) return;
    if (captchaPflicht && !turnstileToken) {
      setCaptchaHinweis("Bitte zuerst das Captcha lösen, dann rollt die Kugel.");
      return;
    }
    if (punkte < gesamtEinsatz) {
      setFehler(
        `Nicht genug Punkte für ${zahl(gesamtEinsatz)} Punkte Einsatz.`,
      );
      return;
    }

    setFehler(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${apiBase}/roulette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ einsaetze, turnstileToken }),
        signal: controller.signal,
      });

      if (res.status === 403) {
        const data = (await res.json().catch(() => ({}))) as {
          requiresTurnstile?: boolean;
        };
        if (data.requiresTurnstile) {
          setCaptchaPflicht(true);
          setTurnstileToken(null);
          setCaptchaReset((n) => n + 1);
          setCaptchaHinweis(
            "Captcha erforderlich – bitte erneut bestätigen, dann nochmal drehen.",
          );
          await refresh();
          return;
        }
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setFehler(
          (data.error ?? `Das Roulette meldet Fehler ${res.status}`) +
            " – es wurden keine Punkte gebucht.",
        );
        await refresh();
        return;
      }

      const data = (await res.json()) as ServerErgebnis;
      ausstehendRef.current = data;
      setGewinnzahl(null);
      setAuszahlung(null);
      setDelta(null);
      setZiel(data.gewinnzahl);
      setDreht(true);
      setCaptchaPflicht(false);
      setCaptchaHinweis(null);
    } catch {
      setFehler(
        controller.signal.aborted
          ? "Das Roulette meldet sich nicht – es wurden keine Punkte gebucht."
          : "Das Roulette ist außer Betrieb – es wurden keine Punkte gebucht.",
      );
      await refresh();
    } finally {
      clearTimeout(timeout);
    }
  }

  const gelandet = useCallback(
    async (n: number) => {
      const ergebnis = ausstehendRef.current;
      ausstehendRef.current = null;
      setGewinnzahl(n);
      if (ergebnis) {
        setAuszahlung(ergebnis.auszahlung);
        setDelta(ergebnis.delta);
      }
      setDreht(false);
      setEinsaetze([]);
      await refresh();
    },
    [refresh],
  );

  const kannDrehen =
    !dreht &&
    !loading &&
    einsaetze.length > 0 &&
    punkte >= gesamtEinsatz &&
    (!captchaPflicht || turnstileToken);

  return (
    <div className="card p-6 md:p-8 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Target size={22} weight="fill" className="text-[#8fa96d]" />
          <h2 className="font-display text-xl font-semibold text-[#faf8f1]">
            Gurken Roulette
          </h2>
        </div>
        <span className="tabular rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-[#e2d9bf]">
          {zahl(punkte)} Punkte
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-[#a3ad9a]">
        Europäischer Kessel mit einer Null. Tippe Felder an, die Kugel
        entscheidet – die Gewinnzahl zieht der Server, nicht dein
        Bauchgefühl.
      </p>

      {/* Kessel */}
      <div className="mb-5 rounded-lg border border-white/10 bg-[#0b120d]/60 p-2 sm:p-4">
        <GurkenKessel
          dreht={dreht}
          ziel={ziel}
          gewinnzahl={gewinnzahl}
          onGelandet={gelandet}
        />
      </div>

      {/* Ergebnis */}
      {gewinnzahl !== null && delta !== null && auszahlung !== null && (
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-center ${
            delta > 0
              ? "border-[#c9a86a]/30 bg-[#c9a86a]/[0.07]"
              : "border-red-500/25 bg-red-950/25"
          }`}
        >
          <p className="text-xs text-[#6b7565] mb-1">Gewinnzahl</p>
          <p
            className={`tabular text-4xl font-semibold ${
              gewinnzahl === 0
                ? "text-[#8fa96d]"
                : istRoteZahl(gewinnzahl)
                  ? "text-red-400"
                  : "text-[#ede8d6]"
            }`}
          >
            {gewinnzahl}
          </p>
          <p
            className={`tabular mt-2 font-display text-lg font-semibold ${
              delta > 0 ? "text-[#e2d9bf]" : "text-red-300"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {zahl(delta)} Punkte
          </p>
          {delta > 0 && (
            <p className="mt-0.5 text-xs text-[#a3ad9a]">
              Auszahlung {zahl(auszahlung)} Punkte (Einsatz zurück inklusive)
            </p>
          )}
        </div>
      )}

      {fehler && (
        <div className="mb-5 rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-3 text-center text-sm text-red-200">
          {fehler}
        </div>
      )}

      {/* Setztisch */}
      <div className="mb-5">
        <Setztisch
          einsaetze={einsaetze}
          chip={chip}
          onEinsatz={platziere}
          gewinnzahl={dreht ? null : gewinnzahl}
          deaktiviert={dreht || loading}
        />
      </div>

      {/* Chips */}
      <div className="mb-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7565]">
          Chip wählen
        </div>
        <div className="flex flex-wrap gap-2">
          {ROULETTE_CHIPS.map((wert) => (
            <button
              key={wert}
              onClick={() => setChip(wert)}
              disabled={dreht}
              className={`tabular min-h-[44px] min-w-[64px] rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all duration-300 active:scale-[0.97] disabled:opacity-50 ${
                chip === wert
                  ? "border-transparent bg-[#ede8d6] text-[#0b120d]"
                  : "border-white/10 bg-white/[0.03] text-[#a3ad9a] hover:border-white/25 hover:text-[#ede8d6]"
              }`}
            >
              {zahl(wert)}
            </button>
          ))}
        </div>
      </div>

      {/* Bot-Schutz */}
      {captchaPflicht && (
        <div className="mb-4">
          <TurnstileWidget
            resetKey={captchaReset}
            onVerify={(token) => {
              setTurnstileToken(token);
              setCaptchaHinweis(null);
            }}
            onExpire={() => {
              setTurnstileToken(null);
              setCaptchaHinweis("Captcha abgelaufen. Bitte erneut bestätigen.");
            }}
            onError={() => {
              setTurnstileToken(null);
              setCaptchaHinweis(
                "Captcha konnte nicht geladen werden. Bitte erneut versuchen.",
              );
            }}
          />
          {captchaHinweis && (
            <p className="mt-2 text-center text-xs text-[#a3ad9a]">
              {captchaHinweis}
            </p>
          )}
        </div>
      )}

      {/* Steuerung */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#6b7565]">Gesamteinsatz</p>
          <p className="tabular text-2xl font-semibold text-[#ede8d6]">
            {zahl(gesamtEinsatz)}{" "}
            <span className="text-sm font-medium text-[#6b7565]">
              Punkte
            </span>
          </p>
          <p className="tabular text-[11px] text-[#6b7565]">
            {einsaetze.length} {einsaetze.length === 1 ? "Einsatz" : "Einsätze"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={zuruecknehmen}
            disabled={dreht || einsaetze.length === 0}
            className="min-h-[48px] px-4 rounded-lg border border-white/10 bg-white/[0.03] text-[#cfc8b0] font-semibold text-sm hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Zurück
          </button>
          <button
            onClick={drehen}
            disabled={!kannDrehen}
            className="btn-cta btn-cta-primary min-h-[48px] !text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dreht ? (
              <>
                <Spinner size={18} weight="fill" className="animate-spin" />
                Rollt …
              </>
            ) : (
              <>Drehen</>
            )}
          </button>
        </div>
      </div>

      {/* Auszahlungen */}
      <details className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <summary className="text-[#cfc8b0] font-semibold text-sm cursor-pointer">
          Auszahlungen
        </summary>
        <div className="tabular mt-2 grid grid-cols-2 gap-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#6b7565]">Plein (1 Zahl)</span>
            <span className="text-[#ede8d6] font-semibold">35 : 1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7565]">Dutzend / Spalte</span>
            <span className="text-[#ede8d6] font-semibold">2 : 1</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-[#6b7565]">
              Einfache Chance (Rot/Schwarz, Gerade/Ungerade, 1–18/19–36)
            </span>
            <span className="text-[#ede8d6] font-semibold">1 : 1</span>
          </div>
        </div>
      </details>

      <p className="mt-3 text-center text-xs leading-relaxed text-[#6b7565]">
        Spielgeld-Regeln: Die Auszahlung enthält deinen Einsatz zurück. Wer auf
        viele Felder setzt, gewinnt öfter, aber kleiner. Maximal{" "}
        {zahl(ROULETTE_MAX_GESAMTEINSATZ)} Punkte pro Dreh – wie am Automaten.
        Der Kessel ist leicht gezinkt (Hausvorteil ca. Slot-Niveau).
      </p>
    </div>
  );
}
