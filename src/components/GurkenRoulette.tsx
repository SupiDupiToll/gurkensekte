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
      randFarbverlauf.addColorStop(0, "#052e16");
      randFarbverlauf.addColorStop(0.5, "#14532d");
      randFarbverlauf.addColorStop(1, "#03170c");
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, aussen, 0, Math.PI * 2);
      ctx.fillStyle = randFarbverlauf;
      ctx.fill();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.stroke();

      const segment = (Math.PI * 2) / 37;
      for (let i = 0; i < 37; i++) {
        const start = rotation + i * segment - Math.PI / 2;
        const ende = start + segment;
        const nummer = ROULETTE_RAD_REIHENFOLGE[i];
        const farbe =
          nummer === 0
            ? "#16a34a"
            : ROULETTE_ROT.includes(nummer)
              ? "#b91c1c"
              : "#0a1f14";

        ctx.beginPath();
        ctx.moveTo(mitteX, mitteY);
        ctx.arc(mitteX, mitteY, innen, start, ende);
        ctx.closePath();
        ctx.fillStyle = farbe;
        ctx.fill();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 0.75;
        ctx.stroke();

        ctx.save();
        ctx.translate(mitteX, mitteY);
        ctx.rotate(start + segment / 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.min(14, aussen / 15)}px Nunito, sans-serif`;
        ctx.fillText(nummer.toString(), innen - 20, 0);
        ctx.restore();
      }

      // Goldring + grüne Mitte mit Gurke
      ctx.beginPath();
      ctx.arc(mitteX, mitteY, zentrum, 0, Math.PI * 2);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.stroke();

      const mitteVerlauf = ctx.createRadialGradient(
        mitteX, mitteY, 0, mitteX, mitteY, zentrum,
      );
      mitteVerlauf.addColorStop(0, "#15803d");
      mitteVerlauf.addColorStop(0.6, "#052e16");
      mitteVerlauf.addColorStop(1, "#15803d");
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
      ctx.fillStyle = "#fefce8";
      ctx.fill();
      ctx.strokeStyle = "#facc15";
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
      ? "bg-gurken-600"
      : istRoteZahl(n)
        ? "bg-red-700"
        : "bg-gurken-950 border border-gurken-500/25";

  const badge = (nummern: number[]) => {
    const summe = summeAuf(nummern);
    if (summe <= 0) return null;
    return (
      <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-gurken-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
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
        className={`relative w-full mb-1.5 rounded-lg bg-gurken-600 py-2.5 text-white font-bold text-sm hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation min-h-[44px] ${
          gewinnzahl === 0 ? "ring-2 ring-yellow-300" : ""
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
            className={`relative aspect-square rounded-lg flex items-center justify-center text-white font-bold text-sm hover:brightness-125 transition-all disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation ${zellFarbe(n)} ${
              gewinnzahl === n ? "ring-2 ring-yellow-300" : ""
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
            className="relative rounded-lg bg-gurken-800/60 border border-gurken-500/20 py-2 text-gurken-200 text-xs font-bold hover:bg-gurken-700/60 transition-colors disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation min-h-[44px]"
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
            className="relative rounded-lg bg-gurken-800/60 border border-gurken-500/20 py-2 text-gurken-200 text-xs font-bold hover:bg-gurken-700/60 transition-colors disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation min-h-[44px]"
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
              className={`relative rounded-lg py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation min-h-[44px] ${
                rot
                  ? "bg-red-700/70 text-red-100 hover:bg-red-700"
                  : schwarz
                    ? "bg-black/60 text-gurken-100 border border-gurken-500/25 hover:bg-black/80"
                    : "bg-gurken-800/60 border border-gurken-500/20 text-gurken-200 hover:bg-gurken-700/60"
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
      setCaptchaHinweis("Bitte zuerst das Captcha lösen – dann rollt die Kugel. 🥒");
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
            "Captcha erforderlich – bitte erneut bestätigen, dann nochmal drehen. 🥒",
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
          <Target size={24} weight="fill" className="text-gurken-400" />
          <h2 className="text-xl font-heading font-bold text-gurken-200">
            🎡 Gurken Roulette
          </h2>
        </div>
        <span className="rounded-lg border border-yellow-400/25 bg-yellow-400/5 px-3 py-1.5 text-sm font-bold text-yellow-300">
          {zahl(punkte)} Punkte
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-gurken-400">
        Europäischer Kessel mit einer Null. Tippe Felder an, die Kugel
        entscheidet – die Gewinnzahl zieht der Server, nicht dein
        Bauchgefühl.
      </p>

      {/* Kessel */}
      <div className="mb-5 rounded-2xl border border-gurken-500/20 bg-gurken-950/40 p-2 sm:p-4">
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
          className={`mb-5 rounded-xl border px-4 py-3 text-center ${
            delta > 0
              ? "border-yellow-400/40 bg-yellow-400/10"
              : "border-red-500/30 bg-red-950/30"
          }`}
        >
          <p className="text-xs text-gurken-400 mb-1">Gewinnzahl</p>
          <p
            className={`text-4xl font-bold ${
              gewinnzahl === 0
                ? "text-gurken-400"
                : istRoteZahl(gewinnzahl)
                  ? "text-red-400"
                  : "text-gurken-100"
            }`}
          >
            {gewinnzahl}
          </p>
          <p
            className={`mt-2 font-heading text-lg font-bold ${
              delta > 0 ? "text-yellow-300" : "text-red-300"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {zahl(delta)} Punkte
          </p>
          {delta > 0 && (
            <p className="mt-0.5 text-xs text-gurken-400">
              Auszahlung {zahl(auszahlung)} Punkte (Einsatz zurück inklusive)
            </p>
          )}
        </div>
      )}

      {fehler && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-center text-sm text-red-200">
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
        <div className="mb-2 text-xs uppercase tracking-wider text-gurken-500">
          Chip wählen
        </div>
        <div className="flex flex-wrap gap-2">
          {ROULETTE_CHIPS.map((wert) => (
            <button
              key={wert}
              onClick={() => setChip(wert)}
              disabled={dreht}
              className={`min-h-[44px] min-w-[64px] rounded-full border px-5 py-2.5 text-sm font-bold transition-all touch-manipulation disabled:opacity-50 ${
                chip === wert
                  ? "border-yellow-400/60 bg-yellow-400 text-gurken-950 shadow-[0_0_18px_rgba(250,204,21,0.35)] scale-105"
                  : "border-gurken-500/20 bg-gurken-800/40 text-gurken-300 hover:border-gurken-500 hover:text-gurken-100"
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
            <p className="mt-2 text-center text-xs text-gurken-400">
              {captchaHinweis}
            </p>
          )}
        </div>
      )}

      {/* Steuerung */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gurken-500">Gesamteinsatz</p>
          <p className="text-2xl font-bold text-gurken-100">
            {zahl(gesamtEinsatz)}{" "}
            <span className="text-sm font-semibold text-gurken-400">
              Punkte
            </span>
          </p>
          <p className="text-[11px] text-gurken-500">
            {einsaetze.length} {einsaetze.length === 1 ? "Einsatz" : "Einsätze"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={zuruecknehmen}
            disabled={dreht || einsaetze.length === 0}
            className="min-h-[48px] px-4 rounded-xl border border-gurken-500/25 bg-gurken-800/40 text-gurken-200 font-bold text-sm hover:bg-gurken-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation"
          >
            Zurück
          </button>
          <button
            onClick={drehen}
            disabled={!kannDrehen}
            className="min-h-[48px] px-6 rounded-xl bg-yellow-400 text-gurken-950 font-bold text-sm hover:bg-yellow-300 hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation inline-flex items-center gap-2"
          >
            {dreht ? (
              <>
                <Spinner size={18} weight="fill" className="animate-spin" />
                Rollt…
              </>
            ) : (
              <>🎡 Drehen</>
            )}
          </button>
        </div>
      </div>

      {/* Auszahlungen */}
      <details className="mt-5 rounded-xl border border-gurken-500/15 bg-gurken-800/30 px-4 py-3">
        <summary className="text-gurken-300 font-semibold text-sm cursor-pointer touch-manipulation">
          Auszahlungen (antippen)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gurken-500">Plein (1 Zahl)</span>
            <span className="text-gurken-200 font-bold">35 : 1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gurken-500">Dutzend / Spalte</span>
            <span className="text-gurken-200 font-bold">2 : 1</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-gurken-500">
              Einfache Chance (Rot/Schwarz, Gerade/Ungerade, 1–18/19–36)
            </span>
            <span className="text-gurken-200 font-bold">1 : 1</span>
          </div>
        </div>
      </details>

      <p className="mt-3 text-center text-xs leading-relaxed text-gurken-500">
        Spielgeld-Regeln: Die Auszahlung enthält deinen Einsatz zurück. Wer auf
        viele Felder setzt, gewinnt öfter, aber kleiner. Maximal{" "}
        {zahl(ROULETTE_MAX_GESAMTEINSATZ)} Punkte pro Dreh – wie am Automaten.
        Der Kessel ist leicht gezinkt (Hausvorteil ca. Slot-Niveau).
      </p>
    </div>
  );
}
