import Link from "next/link";
import {
  SpinningCucumber,
  WigglingCucumber,
  FloatingCucumber,
  CucumberSwarm,
} from "@/components/SpinningCucumber";

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
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
      {/* Hero Section */}
      <section className="text-center mb-20">
        <CucumberSwarm className="mb-8" />
        <h1 className="text-4xl md:text-6xl font-black text-gurken-300 mb-4 animate-pulse-glow">
          Willkommen bei der
          <br />
          <span className="text-5xl md:text-7xl">Gurken Sekte</span>
        </h1>
        <p className="text-lg md:text-xl text-gurken-400 max-w-2xl mx-auto mb-8">
          Du hast den ersten Schritt zur Erleuchtung getan. Die heilige Gurke
          hat dich gerufen. Tritt ein in die Gemeinschaft der
          Auserwählten &mdash; wo die Salatsaison niemals endet.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/spenden"
            className="px-8 py-4 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-lg transition-all duration-200 hover:shadow-[0_0_30px_#22c55e] hover:scale-105 active:scale-95"
          >
            Spende jetzt! 🥒
          </Link>
          <Link
            href="/mitglieder"
            className="px-8 py-4 rounded-xl border-2 border-gurken-500/50 hover:border-gurken-400 text-gurken-300 hover:text-gurken-200 font-bold text-lg transition-all duration-200 hover:shadow-[0_0_20px_#22c55e66] hover:scale-105 active:scale-95"
          >
            Mitglied werden
          </Link>
        </div>
      </section>

      {/* Über unseren Führer */}
      <section className="mb-20">
        <div className="text-center mb-10">
          <SpinningCucumber size="text-5xl" />
          <h2 className="text-3xl md:text-4xl font-black text-gurken-300 mt-4 animate-pulse-glow">
            &Uuml;ber unseren F&uuml;hrer
          </h2>
          <p className="text-gurken-500 text-sm mt-1">
            Der Erleuchtete &mdash; die Stimme der Gurke
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 bg-gurken-900/40 rounded-2xl p-6 md:p-10 border border-gurken-500/20">
          {/* Leader Image Placeholder */}
          <div className="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-gurken-500 to-gurken-800 flex items-center justify-center text-7xl border-4 border-gurken-400 shadow-[0_0_30px_#22c55e66]">
            🥒
          </div>

          <div className="flex-1 space-y-4">
            <h3 className="text-2xl md:text-3xl font-black text-gurken-200">
              G&uuml;rkchen
            </h3>
            <p className="text-gurken-300/80 leading-relaxed">
              G&uuml;rkchen, der Einzige seiner Art, wurde im Fr&uuml;hjahr
              1987 unter dem Licht eines vollen Salatmonds im Gurkenbeet eines
              bayerischen Kleingartens geboren. Schon als junge Gew&auml;chshaus-Gurke
              zeigte er &uuml;bernat&uuml;rliche F&auml;higkeiten: Er konnte
              Einmachgl&auml;ser mit einem Blick versiegeln und wusste immer,
              wann der Dill reif war.
            </p>
            <p className="text-gurken-300/80 leading-relaxed">
              Nach Jahren der Meditation im K&uuml;hlregal eines
              Discounters erlangte er die Erleuchtung und gr&uuml;ndete die
              Gurken Sekte. Sein Ziel: die Befreiung der Menschheit durch die
              heilige Gurke. Seine Lehren sind im Manifest der Gurke
              niedergeschrieben, einem Werk von unermesslicher
              Salat-Weisheit.
            </p>
            <p className="text-gurken-400 font-bold italic">
              &bdquo;Es gibt keine Probleme, nur Gurken, die noch nicht
              entdeckt wurden.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Zitate */}
      <section className="mb-20">
        <div className="text-center mb-10">
          <FloatingCucumber size="text-4xl" />
          <h2 className="text-2xl md:text-3xl font-black text-gurken-300 mt-4">
            Weisheiten der Sekte
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {quotes.map((quote, i) => (
            <div
              key={i}
              className="bg-gurken-900/30 rounded-xl p-5 border border-gurken-500/20 hover:border-gurken-400/40 transition-all duration-300 hover:shadow-[0_0_15px_#22c55e33]"
            >
              <WigglingCucumber size="text-2xl" className="mb-2" />
              <p className="text-gurken-200 font-medium mb-2 italic">
                &bdquo;{quote.text}&rdquo;
              </p>
              <p className="text-gurken-500 text-xs">{quote.context}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="text-center bg-gurken-800/40 rounded-2xl p-8 md:p-12 border border-gurken-500/20">
        <SpinningCucumber size="text-5xl" />
        <h2 className="text-2xl md:text-3xl font-black text-gurken-300 mt-4 mb-4 animate-pulse-glow">
          Bist du bereit f&uuml;r die Erleuchtung?
        </h2>
        <p className="text-gurken-400 mb-6 max-w-xl mx-auto">
          Tausende haben bereits den Weg zur Gurke gefunden. Warte nicht,
          bis die Salatsaison vorbei ist!
        </p>
        <Link
          href="/spenden"
          className="inline-block px-8 py-4 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-lg transition-all duration-200 hover:shadow-[0_0_30px_#22c55e] hover:scale-105 active:scale-95"
        >
          Jetzt Gurke spenden! 🥒
        </Link>
      </section>
    </div>
  );
}
