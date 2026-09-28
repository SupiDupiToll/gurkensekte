import type { NextConfig } from "next";

const securityHeaders = [
  // Kein MIME-Sniffing – erschwert Drive-by via hochgeladene Inhalte.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Kein Einbetten als iframe auf fremden Seiten (Clickjacking-Schutz).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Möglichst wenig Referrer preisgeben (u. a. Token-URLs wie
  // /referral/bestaetigen?token=… nicht an Dritte leaken).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browser-APIs, die die Sekte nicht braucht, pauschal abdrehen.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // HTTPS erzwingen, sobald die Seite über TLS ausgeliefert wird.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
