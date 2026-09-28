/**
 * Kryptografisch starke Zufallszahlen für Punkte-relevante Ziehungen.
 *
 * `Math.random()` ist vorhersagbar (V8-Seed-Beobachtung) und damit für
 * alles ungeeignet, was Punkte mit Gurken-Gegenwert zieht. Diese Helfer
 * nutzen `globalThis.crypto` (Web Crypto) und funktionieren bewusst ohne
 * `node:`-Import – `lib/casino.ts` und `lib/roulette.ts` werden auch in
 * Client-Komponenten (Konstanten, Validierung) gebündelt.
 */

/** Gleichverteilte Zahl in [0, 1) aus `crypto.getRandomValues`. */
export function zufallsAnteil(): number {
  const puffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(puffer);
  return puffer[0] / 2 ** 32;
}

/** Gleichverteilte ganze Zahl in [0, exklusiv). */
export function zufallsInt(exklusiv: number): number {
  return Math.floor(zufallsAnteil() * exklusiv);
}
