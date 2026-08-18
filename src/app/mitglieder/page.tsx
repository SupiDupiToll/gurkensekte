"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { MitgliederDashboard } from "@/components/MitgliederDashboard";
import { SpinningCucumber } from "@/components/SpinningCucumber";

export default function MitgliederPage() {
  const user = useUser();
  const app = useHexclaveApp();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="card p-8">
          <SpinningCucumber size="text-5xl" />
          <h1 className="text-2xl font-heading font-bold text-gurken-300 mt-4 mb-2">
            🥒 Zugang verweigert! 🥒
          </h1>
          <p className="text-gurken-400 mb-6">
            Nur eingeweihte Mitglieder der Gurken Sekte haben Zutritt.
          </p>
          <button
            onClick={() => app.redirectToSignIn()}
            className="btn-cta btn-cta-primary"
          >
            Jetzt anmelden 🥒
          </button>
        </div>
      </div>
    );
  }

  return (
    <MitgliederDashboard
      user={{
        displayName: user.displayName,
        primaryEmail: user.primaryEmail,
        signedUpAt: user.signedUpAt,
      }}
      onSignOut={() => app.redirectToSignOut()}
    />
  );
}
