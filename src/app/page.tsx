import Link from "next/link";
import {
  SpinningCucumber,
  WigglingCucumber,
  FloatingCucumber,
  BouncingCucumber,
  ShakingCucumber,
  CucumberSwarm,
} from "@/components/SpinningCucumber";
import { ArrowRight, Heart, Sparkle } from "@phosphor-icons/react/dist/ssr";

const quotes = [
  {
    text: "Die Gurke ist nicht nur ein Gemüse. Sie ist ein Versprechen.",
    context: "aus dem Manifest der Gurke, Kapitel 1",
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
    context: "aus dem Manifest der Gurke, Kapitel 4",
  },
];

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24 pb-safe">
      {/* Hero Section */}
      <section className="text-center mb-20 md:mb-28 relative">
        <div className="absolute -top-10 left-0 opacity-30 hidden md:block">
          <FloatingCucumber size="text-5xl" />
        </div>
        <div className="absolute -top-5 right-10 opacity-20 hidden md:block">
          <ShakingCucumber size="text-4xl" />
        </div>
        <CucumberSwarm className="mb-8" />
        <h1 className="text-4xl md:text-6xl font-heading font-bold text-gurken-300 mb-4 leading-tight">
          Willkommen bei der
          <br />
          <span className="text-5xl md:text-7xl">Gurken Sekte 🥒</span>
        </h1>
        <p className="text-lg md:text-xl text-gurken-400 max-w-2xl mx-auto mb-10 leading-relaxed px-2">
          Du hast den ersten Schritt zur Erleuchtung getan. Die heilige Gurke
          hat dich gerufen. Tritt ein in die Gemeinschaft der
          Auserwählten &mdash; wo die Salatsaison niemals endet.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
          <Link
            href="/spenden"
            className="btn-cta btn-cta-primary w-full sm:w-auto text-center"
          >
            <Heart size={20} weight="fill" />
            Spende jetzt 🥒
          </Link>
          <Link
            href="/mitglieder"
            className="btn-cta btn-cta-secondary w-full sm:w-auto text-center"
          >
            Mitglied werden
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Floating cucumbers along sides */}
      <div className="hidden md:flex flex-col gap-8 fixed left-4 top-1/3 -translate-y-1/2 opacity-30 pointer-events-none">
        <SpinningCucumber size="text-2xl" />
        <FloatingCucumber size="text-3xl" />
        <WigglingCucumber size="text-2xl" />
      </div>
      <div className="hidden md:flex flex-col gap-8 fixed right-4 top-1/3 -translate-y-1/2 opacity-30 pointer-events-none">
        <WigglingCucumber size="text-2xl" />
        <BouncingCucumber size="text-3xl" />
        <SpinningCucumber size="text-2xl" reverse />
      </div>

      {/* Über unseren Führer */}
      <section className="mb-20 md:mb-28 relative">
        <div className="text-center mb-10">
          <SpinningCucumber size="text-5xl" />
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-gurken-300 mt-4">
            🥒 Über unseren Führer 🥒
          </h2>
          <p className="text-gurken-500 text-sm mt-1">
            Der Erleuchtete &mdash; die Stimme der Gurke
          </p>
        </div>

        <div className="card p-6 md:p-10 hover:glow-green-lg transition-all duration-300">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-gurken-500 to-gurken-800 flex items-center justify-center text-7xl border-4 border-gurken-400/60 shadow-[0_0_30px_#22c55e33]">
              <SpinningCucumber size="text-7xl" />
            </div>

            <div className="flex-1 space-y-4">
              <h3 className="text-2xl md:text-3xl font-heading font-bold text-gurken-200">
                🥒 Gürkchen 🥒
              </h3>
              <p className="text-gurken-300/80 leading-relaxed">
                Gürkchen, der Einzige seiner Art, wurde im Frühjahr
                1987 unter dem Licht eines vollen Salatmonds im Gurkenbeet eines
                bayerischen Kleingartens geboren. Schon als junge Gewächshaus-Gurke
                zeigte er übernatürliche Fähigkeiten: Er konnte
                Einmachgläser mit einem Blick versiegeln und wusste immer,
                wann der Dill reif war.
              </p>
              <p className="text-gurken-300/80 leading-relaxed">
                Nach Jahren der Meditation im Kühlregal eines
                Discounters erlangte er die Erleuchtung und gründete die
                Gurken Sekte. Sein Ziel: die Befreiung der Menschheit durch die
                heilige Gurke. Seine Lehren sind im Manifest der Gurke
                niedergeschrieben, einem Werk von unermesslicher
                Salat-Weisheit.
              </p>
              <p className="text-gurken-400 font-bold italic">
                &bdquo;Es gibt keine Probleme, nur Gurken, die noch nicht
                entdeckt wurden.&rdquo; 🥒
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Zitate */}
      <section className="mb-20 md:mb-28">
        <div className="text-center mb-10">
          <FloatingCucumber size="text-4xl" />
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-gurken-300 mt-4">
            🥒 Weisheiten der Sekte 🥒
          </h2>
        </div>

        <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
          {quotes.map((quote, i) => (
            <div
              key={i}
              className="card p-5 hover:translate-y-[-2px]"
            >
              <div className="flex items-start gap-3">
                <WigglingCucumber size="text-2xl" className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gurken-200 font-medium mb-2 italic leading-relaxed">
                    &bdquo;{quote.text}&rdquo;
                  </p>
                  <p className="text-gurken-500 text-xs flex items-center gap-1 flex-wrap">
                    <Sparkle size={12} />
                    {quote.context}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="text-center glass-strong rounded-2xl p-8 md:p-14 glow-green-lg relative overflow-hidden">
        <div className="absolute -top-6 -right-6 opacity-20">
          <SpinningCucumber size="text-6xl" />
        </div>
        <div className="absolute -bottom-4 -left-4 opacity-20">
          <WigglingCucumber size="text-5xl" />
        </div>
        <SpinningCucumber size="text-5xl" />
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-gurken-300 mt-4 mb-4">
          🥒 Bist du bereit für die Erleuchtung? 🥒
        </h2>
        <p className="text-gurken-400 mb-8 max-w-xl mx-auto leading-relaxed px-2">
          Tausende haben bereits den Weg zur Gurke gefunden. Warte nicht,
          bis die Salatsaison vorbei ist!
        </p>
        <Link
          href="/spenden"
          className="btn-cta btn-cta-primary"
        >
          <Heart size={20} weight="fill" />
          Jetzt Gurke spenden 🥒
        </Link>
      </section>
    </div>
  );
}
