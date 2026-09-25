"use client";

import { useUser, useHexclaveApp } from "@hexclave/next";
import { MitgliederDashboard } from "@/components/MitgliederDashboard";

export default function MitgliederPage() {
  // Signed-out visitors are sent straight to the sign-in page instead of an
  // intermediate teaser page.
  const user = useUser({ or: "redirect" });
  const app = useHexclaveApp();

  return (
    <MitgliederDashboard
      user={{
        id: user.id,
        displayName: user.displayName,
        primaryEmail: user.primaryEmail,
        signedUpAt: user.signedUpAt,
      }}
      onSignOut={() => app.redirectToSignOut()}
    />
  );
}
