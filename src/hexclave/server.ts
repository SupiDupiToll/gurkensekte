import { HexclaveServerApp } from "@hexclave/next";
import { hexclaveClientApp } from "./client";

// Beim `next build` wertet Next die Module aus (Seitendaten, statisches
// Rendern). Der echte Server-Key existiert im Build-Container nicht und wird
// dort auch nicht gebraucht – er kommt zur Laufzeit als Worker-Secret. Ohne
// Platzhalter würde allein das Instanziieren den Build abbrechen. Zur Laufzeit
// ist NEXT_PHASE nicht gesetzt, dann greift weiterhin der echte Key (bzw. der
// SDK-Fehler, wenn er fehlt).
const buildSecret =
  process.env.NEXT_PHASE === "phase-production-build"
    ? "build-time-placeholder-not-used-at-runtime"
    : undefined;

export const hexclaveServerApp = new HexclaveServerApp({
  inheritsFrom: hexclaveClientApp,
  ...(buildSecret ? { secretServerKey: buildSecret } : {}),
});
