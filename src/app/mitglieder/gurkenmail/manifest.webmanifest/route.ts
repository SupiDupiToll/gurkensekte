/**
 * Eigenes Webmanifest für die GurkenMail-Seite: Wer die PWA von hier aus
 * installiert, landet beim Öffnen direkt im Postfach. Von überall sonst
 * startet die App im Mitgliederbereich (Haupt-Manifest).
 */
export async function GET() {
  return Response.json({
    name: "GurkenMail – Gurken Sekte",
    short_name: "GurkenMail",
    description: "Dein GurkenMail-Postfach: name@gurkensekte.de lesen und schreiben.",
    id: "/mitglieder/gurkenmail",
    scope: "/",
    start_url: "/mitglieder/gurkenmail",
    display: "standalone",
    background_color: "#1e3226",
    theme_color: "#1e3226",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon.png", sizes: "192x192 512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  });
}
