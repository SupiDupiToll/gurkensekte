import { CucumberSwarm } from "@/components/SpinningCucumber";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-32">
      <CucumberSwarm />
      <p className="animate-pulse text-[15px] font-medium text-[#a3ad9a]">
        Die Gurken werden eingelegt …
      </p>
    </div>
  );
}
