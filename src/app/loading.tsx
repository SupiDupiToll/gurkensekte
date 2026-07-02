import { CucumberSwarm } from "@/components/SpinningCucumber";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-32">
      <CucumberSwarm />
      <p className="text-gurken-400 text-lg font-bold animate-pulse">
        🥒 Die Gurken werden geladen... 🥒
      </p>
    </div>
  );
}
