import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gurken Sekte – Offizielle Kult-Website",
    short_name: "Gurken Sekte",
    description:
      "Willkommen bei der Gurken Sekte! Tritt unserem exklusiven Kult bei und spende Gurken für die Erleuchtung.",
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
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
