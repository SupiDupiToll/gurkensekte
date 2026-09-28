import Link from "next/link";
import { HomeCta } from "@/components/HomeCta";
import { Reveal } from "@/components/Reveal";
import { SpinningCucumber } from "@/components/SpinningCucumber";
import {
  ArrowRight,
  ArrowUpRight,
  Quotes,
  SealCheck,
  Coins,
  ChatCircleText,
} from "@phosphor-icons/react/dist/ssr";

const quotes = [
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

export function HomePage({ base = "" }: { base?: string }) {
  return (
    <main className="w-full max-w-full overflow-x-hidden">
      {/* ── Hero: Editorial Split ── */}
      <section className="mx-auto grid min-h-[calc(100svh-68px)] w-full max-w-6xl grid-cols-1 content-center items-center gap-10 px-4 py-14 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          <Reveal>
            <div className="mb-6 flex items-center gap-5" aria-hidden="true">
              <SpinningCucumber size="text-3xl" />
              <SpinningCucumber size="text-4xl" reverse />
              <SpinningCucumber size="text-2xl" />
              <SpinningCucumber size="text-4xl" />
              <SpinningCucumber size="text-3xl" reverse />
            </div>
            <p className="eyebrow">Satirische Parodie · Einlegeglas Nr. 7</p>
            <h1 className="font-display mt-5 max-w-3xl text-[clamp(2.6rem,5.2vw,4.6rem)] font-semibold leading-[1.02] text-[#faf8f1]">
              Die Gurke hat dich
              <span className="italic text-[#abc189]"> gerufen.</span>
            </h1>
          </Reveal>
          <Reveal delay={1}>
            <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-[#a3ad9a] md:text-lg">
              Die heilige Gurke hat dich gerufen. Tritt ein, sammle Segen und
              ernte am Ende eine echte Gurke.
            </p>
          </Reveal>
          <Reveal delay={2}>
            <div className="mt-8">
              <HomeCta variant="hero" base={base} />
            </div>
          </Reveal>
        </div>

        {/* Rechte Spalte: Double-Bezel Manifest-Karte */}
        <div className="md:col-span-5">
          <Reveal delay={1} className="md:pl-4">
            <div className="shell">
              <div className="core p-7 md:p-8">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9a86a]/30 bg-[#c9a86a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e2d9bf]">
                    <SealCheck size={14} weight="fill" />
                    Manifest
                  </span>
                  <span className="text-[11px] font-medium tracking-[0.08em] text-[#6b7565]">
                    Kap. 1 · Vers 3
                  </span>
                </div>
                <div className="my-6 flex h-44 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <SpinningCucumber size="text-8xl" />
                </div>
                <blockquote className="font-display text-xl italic leading-snug text-[#ede8d6]">
                  „Es gibt keine Probleme, nur Gurken, die noch nicht entdeckt wurden.“
                </blockquote>
                <p className="mt-3 text-sm text-[#a3ad9a]">
                  Gürkchen · Erleuchtet im Kühlregal, 1987
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Bento: dicht, asymmetrisch ── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:pb-32">
        <Reveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Das Sektenleben</p>
              <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-tight text-[#faf8f1] md:text-[2.6rem]">
                Drei Wege zur Erleuchtung, ein Einlegeglas.
              </h2>
            </div>
            <Link
              href={`${base}/mitglieder`}
              className="group inline-flex items-center gap-2 rounded-lg border border-white/12 px-4 py-2 text-sm font-semibold text-[#cfc8b0] transition-all duration-300 hover:border-[#abc189]/40 hover:text-[#faf8f1]"
            >
              Mitgliederbereich
              <ArrowRight size={16} className="transition-transform duration-300 " />
            </Link>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:grid-flow-dense">
          <Reveal className="md:col-span-7" delay={1}>
            <div className="shell h-full">
              <div className="core flex h-full flex-col justify-between p-7 md:p-9">
                <div>
                  <Coins size={28} weight="fill" className="text-[#c9a86a]" />
                  <h3 className="font-display mt-4 text-2xl font-semibold text-[#faf8f1]">
                    Sammle Segen, ernte Gurken
                  </h3>
                <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-[#a3ad9a]">
                    Bonus, Zitate, Chat, Casino. Ab 1.000 Punkten schickt
                    Gürkchen dir eine echte Gurke.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-lg bg-white/[0.07]">
                    <div className="h-full w-[38%] rounded-lg bg-[#8fa96d]" />
                  </div>
                  <span className="tabular text-xs font-semibold text-[#cfc8b0]">380 / 1.000</span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-5" delay={2}>
            <div className="shell h-full">
              <div className="core flex h-full flex-col justify-between p-7 md:p-9">
                <div>
                  <ChatCircleText size={28} weight="fill" className="text-[#8fa96d]" />
                  <h3 className="font-display mt-4 text-2xl font-semibold text-[#faf8f1]">
                    Gürkchen antwortet
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#a3ad9a]">
                    Weisheit mit Segen pro Nachricht.
                  </p>
                </div>
                <p className="font-display mt-6 border-l-2 border-[#8fa96d]/50 pl-4 text-[15px] italic leading-relaxed text-[#e2d9bf]">
                  „Sei gegrüßt, mein Gurken-Kind. Was bedrückt deine eingelegte Seele?“
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-5" delay={1}>
            <Link href={`${base}/mitglieder/casino`} className="shell group block h-full">
              <div className="core flex h-full items-center justify-between gap-4 p-7">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c9a86a]">
                    Spielgeld · Punkte
                  </p>
                  <h3 className="font-display mt-2 text-xl font-semibold text-[#faf8f1]">
                    Gurken Casino
                  </h3>
                  <p className="mt-1 text-sm text-[#a3ad9a]">Slot bis 3×, Roulette bis 35:1.</p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#8fa96d]">
                  <ArrowUpRight size={20} weight="bold" />
                </span>
              </div>
            </Link>
          </Reveal>

          <Reveal className="md:col-span-7" delay={2}>
            <Link href={`${base}/spenden`} className="shell group block h-full">
              <div className="core flex h-full flex-wrap items-center justify-between gap-4 p-7">
                <div className="min-w-52 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa96d]">
                    Heilige Gurken finanzieren
                  </p>
                  <h3 className="font-display mt-2 text-xl font-semibold text-[#faf8f1]">
                    Spende für das nächste Glas
                  </h3>
                  <p className="mt-1 text-sm text-[#a3ad9a]">
                    Via Mangoe Payments: sicher eingebettet, ohne Umweg.
                  </p>
                </div>
                <span className="btn-cta btn-cta-primary !py-2 !pl-5 text-sm">
                  Spenden
                  <span className="btn-dot !h-9 !w-9">
                    <ArrowRight size={16} weight="bold" />
                  </span>
                </span>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Weisheiten: Editorial-Liste statt Kartenraster ── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:pb-32">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Reveal>
              <div className="md:sticky md:top-28">
                <p className="eyebrow">Weisheiten</p>
                <h2 className="font-display mt-3 text-3xl font-semibold leading-tight text-[#faf8f1] md:text-4xl">
                  Vier Sätze, null Salat.
                </h2>
                <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-[#a3ad9a]">
                  Aus dem Manifest. Täglich drei neue im Mitgliederbereich.
                </p>
                <Link
                  href={`${base}/mitglieder`}
                  className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#abc189] hover:text-[#c9d6ae]"
                >
                  <Quotes size={18} weight="fill" />
                  Eigene Weisheit generieren
                  <ArrowRight size={16} className="transition-transform duration-300 " />
                </Link>
              </div>
            </Reveal>
          </div>
          <div className="md:col-span-8">
            <ol className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {quotes.map((q, i) => (
                <Reveal key={q.text} delay={(i % 3) as 0 | 1 | 2}>
                  <li className="group grid grid-cols-[3rem_1fr] gap-4 py-7 transition-colors md:grid-cols-[4rem_1fr_auto] md:items-baseline">
                    <span className="tabular font-display text-sm text-[#6b7565]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-display text-xl italic leading-snug text-[#ede8d6] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]  md:text-2xl">
                        „{q.text}“
                      </p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-[#6b7565]">
                        {q.context}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Über Gürkchen ── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:pb-32">
        <Reveal>
          <div className="shell">
            <div className="core grid grid-cols-1 gap-8 p-8 md:grid-cols-12 md:p-12">
              <div className="flex items-start justify-center md:col-span-4">
                <div className="flex h-52 w-52 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-8xl" aria-hidden="true">
                  🥒
                </div>
              </div>
              <div className="md:col-span-8">
                <p className="eyebrow">Der Erleuchtete</p>
                <h2 className="font-display mt-3 text-3xl font-semibold text-[#faf8f1] md:text-4xl">
                  Gürkchen, geboren 1987 im bayerischen Kleingarten.
                </h2>
                <div className="mt-5 max-w-[62ch] space-y-4 text-[15px] leading-relaxed text-[#a3ad9a]">
                  <p>
                    Geboren 1987 unter vollem Salatmond im bayerischen
                    Kleingarten. Nach Jahren der Meditation im Kühlregal
                    erlangte er die Erleuchtung und gründete die Gurken Sekte.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── CTA: Drenched ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 md:pb-36">
        <Reveal>
          <div className="rounded-2xl border border-white/[0.08] bg-[#111a13] p-10 text-center md:p-16">
            <div className="relative">
              <div className="mb-7 flex items-center justify-center gap-5" aria-hidden="true">
                <SpinningCucumber size="text-3xl" reverse />
                <SpinningCucumber size="text-5xl" />
                <SpinningCucumber size="text-3xl" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8fa96d]">
                Salatsaison ohne Ende
              </p>
              <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] text-[#faf8f1] md:text-6xl">
                Bereit für die Erleuchtung im Glas?
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#a3ad9a]">
                Warte nicht, bis die Saison vorbei ist.
              </p>
              <div className="mt-9 flex justify-center">
                <HomeCta variant="join" base={base} />
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
