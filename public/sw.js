/* Minimaler Service Worker für PWA-Installierbarkeit.
 * Kein Offline-Cache in v1: nur aktivieren + sofort übernehmen.
 * Verbraucht keinen nennenswerten Speicher – GurkenMail bleibt eine
 * verlinkte Website, keine heruntergeladene App.
 */
self.addEventListener("install", () => {
  // @ts-expect-error ServiceWorker-Kontext
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // @ts-expect-error ServiceWorker-Kontext
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: alles geht ans Netz, nichts wird gecacht.
});
