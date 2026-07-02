"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { buildTippieLink } from "@/lib/tippie";
import {
  SpinningCucumber,
  FloatingCucumber,
  WigglingCucumber,
} from "@/components/SpinningCucumber";

export default function MitgliederPage() {
  const user = useUser();
  const app = useHexclaveApp();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-gurken-900/40 rounded-2xl p-8 border border-gurken-500/20">
          <SpinningCucumber size="text-5xl" />
          <h1 className="text-2xl font-black text-gurken-300 mt-4 mb-2">
            Zugang verweigert!
          </h1>
          <p className="text-gurken-400 mb-6">
            Nur eingeweihte Mitglieder der Gurken Sekte haben Zutritt.
          </p>
          <button
            onClick={() => app.redirectToSignIn()}
            className="px-6 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:scale-105 active:scale-95"
          >
            Jetzt anmelden 🥒
          </button>
        </div>
      </div>
    );
  }

  const email = user.primaryEmail ?? "unbekannt@sektenmitglied.de";
  const tippieHref = buildTippieLink({
    amountEur: 1.2,
    reference: `Gurke gekauft - GurkenSekte - ${email}`,
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
      <div className="text-center mb-10">
        <SpinningCucumber size="text-5xl" />
        <h1 className="text-3xl md:text-4xl font-black text-gurken-300 mt-4 animate-pulse-glow">
          Mitgliederbereich
        </h1>
        <p className="text-gurken-400 mt-2">
          Willkommen, erleuchtete(r) {user.displayName ?? "Gurkenfreund"}!
        </p>
        <p className="text-gurken-500 text-xs mt-1">E-Mail: {email}</p>
      </div>

      {/* Member Dashboard */}
      <div className="bg-gurken-900/40 rounded-2xl p-6 md:p-8 border border-gurken-500/20 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <FloatingCucumber size="text-3xl" />
          <h2 className="text-xl font-black text-gurken-200">
            Dein spirituelles Gurken-Dashboard
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="bg-gurken-800/40 rounded-xl p-4 border border-gurken-500/20">
            <p className="text-gurken-500 text-xs uppercase tracking-wider">
              Mitglied seit
            </p>
            <p className="text-gurken-200 font-bold">
              {user.signedUpAt
                ? new Date(user.signedUpAt).toLocaleDateString("de-DE")
                : "Urzeiten der Gurke"}
            </p>
          </div>
          <div className="bg-gurken-800/40 rounded-xl p-4 border border-gurken-500/20">
            <p className="text-gurken-500 text-xs uppercase tracking-wider">
              Status
            </p>
            <p className="text-gurken-200 font-bold">Erleuchtet ✅</p>
          </div>
        </div>

        {/* Buy Cucumber Section */}
        <div className="bg-gurken-800/50 rounded-xl p-6 border border-gurken-400/30 text-center">
          <WigglingCucumber size="text-4xl" />
          <h3 className="text-lg font-black text-gurken-300 mt-3 mb-2">
            Kaufe eine heilige Gurke! (echt!!!)
          </h3>
          <p className="text-gurken-400 text-sm mb-1">
            Nur 1,20 &euro; &mdash; exklusiv f&uuml;r eingeweihte Mitglieder.
          </p>
          <p className="text-gurken-500 text-xs mb-4">
            Du bekommst eine echte Gurke!!
          </p>
          <a
            href={tippieHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-xl bg-gurken-600 hover:bg-gurken-500 text-white font-bold text-base transition-all duration-200 hover:shadow-[0_0_20px_#22c55e] hover:scale-105 active:scale-95"
          >
            🥒 Gurke kaufen (1,20 &euro;)
          </a>
        </div>
      </div>

      {/* Sign Out */}
      <div className="text-center">
        <button
          onClick={() => app.redirectToSignOut()}
          className="px-6 py-2 rounded-lg border border-gurken-600/50 text-gurken-500 hover:text-gurken-400 hover:border-gurken-500 text-sm font-bold transition-all"
        >
          Ausloggen
        </button>
      </div>

      <div className="flex justify-center mt-8 gap-2 opacity-50">
        <FloatingCucumber size="text-2xl" />
        <WigglingCucumber size="text-2xl" />
        <SpinningCucumber size="text-2xl" />
      </div>
    </div>
  );
}
