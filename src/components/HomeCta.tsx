"use client";

import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { useUser } from "@hexclave/next";
import { ArrowRight, ArrowUpRight, HeartStraight } from "@phosphor-icons/react";

type CtaVariant = "hero" | "join";

const noopSubscribe = () => () => {};

function useIsHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function CtaLinks({
  base = "",
  variant,
  signedIn,
}: {
  base?: string;
  variant: CtaVariant;
  signedIn: boolean;
}) {
  const mitgliederHref = `${base}/mitglieder`;

  if (variant === "join") {
    return (
      <Link href={mitgliederHref} className="btn-cta btn-cta-primary">
        {signedIn ? "Zum Mitgliederbereich" : "Der Sekte beitreten"}
        <span className="btn-dot">
          <ArrowRight size={18} weight="bold" />
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <Link href={mitgliederHref} className="btn-cta btn-cta-lg btn-cta-primary">
        {signedIn ? "Zum Mitgliederbereich" : "Mitglied werden"}
        <span className="btn-dot">
          <ArrowRight size={20} weight="bold" />
        </span>
      </Link>
      <Link href={`${base}/spenden`} className="btn-cta btn-cta-lg btn-cta-secondary">
        <HeartStraight size={20} weight="fill" />
        Spenden
        <span className="btn-dot">
          <ArrowUpRight size={18} weight="bold" />
        </span>
      </Link>
    </div>
  );
}

function SignedInCta({
  base = "",
  variant,
}: {
  base?: string;
  variant: CtaVariant;
}) {
  const user = useUser();
  return <CtaLinks base={base} variant={variant} signedIn={Boolean(user)} />;
}

export function HomeCta({
  base = "",
  variant,
}: {
  base?: string;
  variant: CtaVariant;
}) {
  const hydrated = useIsHydrated();
  const loggedOut = <CtaLinks base={base} variant={variant} signedIn={false} />;
  if (!hydrated) return loggedOut;
  return (
    <Suspense fallback={loggedOut}>
      <SignedInCta base={base} variant={variant} />
    </Suspense>
  );
}
