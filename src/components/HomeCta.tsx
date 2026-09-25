"use client";

import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { useUser } from "@hexclave/next";
import { ArrowRight, Heart } from "@phosphor-icons/react";

type CtaVariant = "hero" | "join";

const noopSubscribe = () => () => {};

/** `false` while server-rendering/hydrating, `true` once running in the browser. */
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
        <Heart size={20} weight="fill" />
        {signedIn
          ? "Zum Mitgliederbereich 🥒"
          : "Jetzt der GurkenSekte beitreten 🥒"}
      </Link>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
      <Link
        href={mitgliederHref}
        className="btn-cta btn-cta-primary w-full sm:w-auto text-center"
      >
        {signedIn ? "Zum Mitgliederbereich" : "Mitglied werden"}
        <ArrowRight size={20} />
      </Link>
      <Link
        href={`${base}/spenden`}
        className="btn-cta btn-cta-secondary w-full sm:w-auto text-center"
      >
        <Heart size={20} weight="fill" />
        Spende jetzt 🥒
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

/**
 * Member CTA that reflects the auth state.
 *
 * The session is only read after mount: Hexclave's `useUser()` bails out of
 * server rendering entirely, which would strip the public landing page of its
 * markup. Until then the logged-out variant is used.
 */
export function HomeCta({
  base = "",
  variant,
}: {
  base?: string;
  variant: CtaVariant;
}) {
  const hydrated = useIsHydrated();

  const loggedOut = <CtaLinks base={base} variant={variant} signedIn={false} />;

  if (!hydrated) {
    return loggedOut;
  }

  return (
    <Suspense fallback={loggedOut}>
      <SignedInCta base={base} variant={variant} />
    </Suspense>
  );
}
