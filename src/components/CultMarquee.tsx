const cultSayings = [
  "🥒 Rette die Gurke! Tritt der Sekte bei! 🥒",
  "🥒 Gürkchen sieht alles! 🥒",
  "🥒 Die Gurke ist der Weg! 🥒",
  "🥒 Eine Gurke für den Führer! 🥒",
  "🥒 Gurkenpower! 🥒",
  "🥒 Erleuchtung durch die heilige Gurke! 🥒",
  "🥒 Spende Gurken, sei ein Held! 🥒",
  "🥒 Gürkchen liebt dich! 🥒",
  "🥒 Die Salatsaison naht! 🥒",
  "🥒 Gurken über alles! 🥒",
];

export function CultMarquee() {
  const text = cultSayings.join("  ~  ");
  return (
    <div className="relative w-full overflow-hidden bg-gurken-950/80 border-y border-gurken-500/20 py-2">
      <div className="animate-marquee whitespace-nowrap text-gurken-300 text-sm md:text-base font-bold tracking-wider motion-reduce:animate-none motion-reduce:overflow-x-auto motion-reduce:whitespace-normal motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:px-4">
        {text}
      </div>
    </div>
  );
}
