export function SpinningCucumber({
  size = "text-6xl",
  className = "",
  reverse = false,
}: {
  size?: string;
  className?: string;
  reverse?: boolean;
}) {
  return (
    <span
      className={`inline-block ${size} ${reverse ? "animate-spin-reverse" : "animate-spin-slow"} select-none ${className}`}
      aria-hidden="true"
    >
      🥒
    </span>
  );
}

export function WigglingCucumber({
  size = "text-4xl",
  className = "",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block ${size} animate-wiggle select-none ${className}`}
      aria-hidden="true"
    >
      🥒
    </span>
  );
}

export function FloatingCucumber({
  size = "text-5xl",
  className = "",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block ${size} animate-float select-none ${className}`}
      aria-hidden="true"
    >
      🥒
    </span>
  );
}

export function ShakingCucumber({
  size = "text-3xl",
  className = "",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block ${size} animate-shake select-none ${className}`}
      aria-hidden="true"
    >
      🥒
    </span>
  );
}

export function BouncingCucumber({
  size = "text-4xl",
  className = "",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block ${size} animate-bounce-gentle select-none ${className}`}
      aria-hidden="true"
    >
      🥒
    </span>
  );
}

export function CucumberSwarm({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-3 flex-wrap justify-center ${className}`}>
      <SpinningCucumber size="text-3xl" />
      <FloatingCucumber size="text-4xl" />
      <WigglingCucumber size="text-3xl" />
      <ShakingCucumber size="text-2xl" />
      <BouncingCucumber size="text-3xl" />
      <SpinningCucumber size="text-2xl" reverse />
      <WigglingCucumber size="text-4xl" />
      <FloatingCucumber size="text-3xl" />
      <ShakingCucumber size="text-2xl" />
      <BouncingCucumber size="text-3xl" />
    </div>
  );
}
