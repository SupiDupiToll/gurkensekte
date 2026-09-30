import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gurken Sekte – Offizielle Kult-Website",
    short_name: "Gurken Sekte",
    description:
      "Willkommen bei der Gurken Sekte! Tritt unserem exklusiven Kult bei und spende Gurken für die Erleuchtung.",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#1e3226",
    theme_color: "#1e3226",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "192x192 512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "GurkenMail öffnen",
        short_name: "GurkenMail",
        description: "Direkt zu deinem GurkenMail-Postfach",
        url: "/mitglieder/gurkenmail",
        icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
