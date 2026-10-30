import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { HomeCta } from "@/components/HomeCta";
import { ScrollCraftMount } from "@/components/ScrollCraftMount";
import { Tageslosung } from "@/components/Tageslosung";
import "@/app/scrollcraft.css";
import "@/app/startseite.css";

const manifest = [
  {
    text: "Die Gurke ist nicht nur ein Gemüse. Sie ist ein Versprechen.",
    context: "Manifest der Gurke, Kapitel 1",
  },
  {
    text: "Wer eine Gurke isst, ohne an Gürkchen zu denken, hat sie nicht verdient.",
    context: "Gürkchen, 2024",
  },
  {
    text: "Salat ist der erste Schritt. Die Sekte ist das Ziel.",
    context: "Gürkchen, 2024",
  },
  {
    text: "Gürkchen spricht zu uns durch das Knacken der Schale.",
    context: "Manifest der Gurke, Kapitel 4",
  },
];

const wege = [
  {
    num: "I",
    titel: "Segen sammeln",
    text: "Täglicher Bonus, Zitate, Chat. Ab 1.000 Punkten wird daraus eine echte Gurke.",
    href: "/mitglieder",
  },
  {
    num: "II",
    titel: "Mit Gürkchen sprechen",
    text: "Eine Frage, eine Antwort, fünf Punkte. Gürkchen antwortet nur, wenn es will.",
    href: "/mitglieder",
  },
  {
    num: "III",
    titel: "GurkenMail",
    text: "Eine Adresse, die nach Essig riecht. Zehn Punkte für jeden Brief, den du schreibst.",
    href: "/mitglieder/gurkenmail",
  },
  {
    num: "IV",
    titel: "Gurken Casino",
    text: "Slot bis 3×, Roulette bis 35:1. Gespielt wird mit Punkten, nicht mit Geld.",
    href: "/mitglieder/casino",
  },
];

export function HomePage({ base = "" }: { base?: string }) {
  const link = (pfad: string) => `${base}${pfad}`;
  // Die Demo spiegelt nur Mitglieder, Casino und Spenden. Ohne eigene
  // GurkenMail-Route führt der Eintrag dort auf den Mitgliederbereich.
  const gurkenmailHref = base ? link("/mitglieder") : link("/mitglieder/gurkenmail");

  return (
    <ScrollCraftMount>
      <div className="gurken-poster" data-sc-lerp="0.16">
        <div className="sc-grain" aria-hidden="true" />

        {/* ── I · Erkennen: die Zeile, sonst nichts ───────────────────── */}
        <section
          className="g-hero"
          aria-labelledby="g-hero-titel"
          data-sc-act="flow"
          data-sc-drift="#0d1710"
        >
          <div className="g-hero__ghost" aria-hidden="true">
            GURKE
          </div>

          <div className="sc-wrap g-hero__inner">
            <p className="g-meta">
              <span>Satirische Parodie</span>
              <span className="g-meta__sep" aria-hidden="true" />
              <span className="g-meta__extra">Einlegeglas Nr. 7</span>
              <span className="g-meta__sep g-meta__extra" aria-hidden="true" />
              <span>seit 2026</span>
            </p>

            <h1 id="g-hero-titel" className="g-hero__titel">
              <span className="g-hero__zeile g-rise">Die Gurke</span>
              <span className="g-hero__zeile g-rise g-rise--d1">hat dich</span>
              <span className="g-hero__zeile g-hero__zeile--akzent g-rise g-rise--d2">
                gerufen.
              </span>
            </h1>

            <div className="g-hero__fuss">
              <p className="g-hero__lede g-rise g-rise--d3">
                Tritt ein, sammle Segen und ernte am Ende eine echte Gurke.
              </p>
              <div className="g-hero__cta g-rise g-rise--d4">
                <HomeCta variant="hero" base={base} />
              </div>
            </div>

            <div className="g-hero__rand g-rise g-rise--d4">
              <span className="g-kicker">Manifest, Kapitel 4</span>
              <p>Gürkchen spricht durch das Knacken der Schale.</p>
            </div>
          </div>
        </section>

        {/* ── II · Beklemmung: der Altar ohne Gemeinde ─────────────────── */}
        <section
          className="g-tension"
          data-sc-act="flow"
          data-sc-drift="#0b120d"
          aria-labelledby="g-tension-titel"
        >
          <div className="sc-wrap g-tension__inner">
            <h2 id="g-tension-titel" className="g-tension__zeile" data-sc-cue="-0.2">
              Dein Kühlschrank ist ein Altar ohne Gemeinde.
            </h2>
            <p className="g-tension__leise" data-sc-cue="0.34 0.72" data-sc-kinetic="words">
              Du hast Gemüse. Du hast kein Ritual.
            </p>
          </div>
        </section>

        {/* ── III · Der Riss: das Knacken (Peak, größte Spanne) ────────── */}
        <section
          className="g-act g-act--knack"
          data-sc-act="pin"
          data-sc-span="2.6"
          data-sc-drift="#080d09"
          data-sc-verify="knack"
          data-sc-verify-read=".g-knack__haelfte--l"
          aria-labelledby="g-knack-titel"
        >
          <div className="sc-stage g-knack">
            <h2 id="g-knack-titel" className="g-sr-only">
              Es knackt. Gürkchen spricht.
            </h2>

            <div className="g-knack__offenbarung">
              <p className="g-knack__marke">Es hat geknackt.</p>
              <blockquote className="g-knack__zitat">
                „Es gibt keine Probleme, nur Gurken, die noch nicht entdeckt
                wurden.“
              </blockquote>
              <p className="g-knack__quelle">
                Gürkchen · erleuchtet im Kühlregal, 1987
              </p>
            </div>

            <div className="g-knack__wort" aria-hidden="true">
              <span className="g-knack__haelfte g-knack__haelfte--l">
                <span className="g-knack__lang">GÜRKCHEN</span>
                <span className="g-knack__kurz">GÜRK</span>
              </span>
              <span className="g-knack__haelfte g-knack__haelfte--r">
                <span className="g-knack__lang">GÜRKCHEN</span>
                <span className="g-knack__kurz">CHEN</span>
              </span>
              <span className="g-knack__naht" />
            </div>
          </div>
        </section>

        {/* ── IV · Andacht: Losung und Manifest ────────────────────────── */}
        <section className="g-doktrin" data-sc-act="flow" data-sc-drift="#0b120d" aria-labelledby="g-doktrin-titel">
          <div className="sc-wrap">
            <h2 id="g-doktrin-titel" className="g-h2" data-sc-cue="0.04 0.5">
              Vier Sätze, null Salat.
            </h2>

            <Tageslosung base={base} />

            <ol className="g-manifest" data-sc-in data-sc-stagger="90">
              {manifest.map((satz, i) => (
                <li key={satz.text} className="g-manifest__zeile">
                  <span className="g-manifest__num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="g-manifest__text">
                    <p className="g-manifest__satz">„{satz.text}“</p>
                    <p className="g-manifest__quelle">{satz.context}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="g-mehr" data-sc-in>
              <Link href={link("/mitglieder")} className="g-link">
                Eigene Weisheit generieren
                <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>

        {/* ── V · Verlangen: vier Wege, echte Zahlen ───────────────────── */}
        <section className="g-wege" data-sc-act="flow" data-sc-drift="#0d1710" aria-labelledby="g-wege-titel">
          <div className="sc-wrap">
            <h2 id="g-wege-titel" className="g-h2" data-sc-in>
              Vier Wege ins Glas.
            </h2>

            <ol className="g-index" data-sc-in data-sc-stagger="70">
              {wege.map((weg) => (
                <li key={weg.num} className="g-index__punkt">
                  <Link
                    href={weg.titel === "GurkenMail" ? gurkenmailHref : link(weg.href)}
                    className="g-index__zeile"
                  >
                    <span className="g-index__num" aria-hidden="true">
                      {weg.num}
                    </span>
                    <span className="g-index__titel">{weg.titel}</span>
                    <span className="g-index__text">{weg.text}</span>
                    <ArrowUpRight
                      className="g-index__pfeil"
                      size={22}
                      weight="bold"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ol>

            <p className="g-spende" data-sc-in>
              Oder das Glas füllen:{" "}
              <Link href={link("/spenden")} className="g-link">
                Spenden
                <ArrowUpRight size={15} weight="bold" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>

        {/* ── VI · Entschluss: kleinste Schrift, das Siegel ────────────── */}
        <section
          className="g-close"
          data-sc-act="flow"
          data-sc-drift="#0c1410"
          aria-labelledby="g-close-titel"
        >
          <div className="g-close__siegel" aria-hidden="true">
            <svg viewBox="0 0 200 200" role="presentation">
              <defs>
                <path
                  id="g-siegel-bahn"
                  d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0"
                />
              </defs>
              <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
              <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
              <text className="g-siegel__ring">
                <textPath href="#g-siegel-bahn" startOffset="0">
                  GURKEN SEKTE · GEGRÜNDET IM KÜHLREGAL · 1987 ·
                </textPath>
              </text>
              <text x="100" y="97" textAnchor="middle" className="g-siegel__wort">
                GÜRKCHEN
              </text>
              <text x="100" y="115" textAnchor="middle" className="g-siegel__klein">
                SIEGEL
              </text>
            </svg>
          </div>

          <div className="sc-wrap g-close__lage">
            <div className="g-close__inner">
              <h2 id="g-close-titel" className="g-close__titel" data-sc-cue="0.12">
                Du bist nur noch nicht eingelegt.
              </h2>

              <div className="g-close__cta" data-sc-cue="0.24">
                <HomeCta variant="join" base={base} />
              </div>

              <p className="g-close__klein" data-sc-cue="0.32">
                Satirische Parodie. Keine Gurke wurde verletzt.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ScrollCraftMount>
  );
}
