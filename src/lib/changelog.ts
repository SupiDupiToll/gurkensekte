/**
 * Changelog / Neuigkeiten: eine Datei als feste Stelle.
 *
 * Quelle ist `public/neuigkeiten.md` (der Client holt sie per fetch bei jedem
 * Seitenbesuch). Version steht in der ersten Zeile als
 * `<!-- changelog-version: 2026-10-05-01 -->`. Neue Einträge gehören immer oben
 * hin, Version dabei hochzählen – das Popup erscheint dann automatisch einmal
 * pro Version (localStorage, siehe `ChangelogPopup`).
 *
 * Reine String-Helfer ohne React, damit sie überall nutzbar bleiben.
 */

export const CHANGELOG_URL = "/neuigkeiten.md";
export const CHANGELOG_STORAGE_KEY = "gurken-changelog-gesehen";

/** Versionskennung aus dem HTML-Kommentar der MD-Datei ziehen. */
export function extrahiereChangelogVersion(md: string): string | null {
  const m = md.match(/changelog-version:\s*([^\s\-<>"]+)/);
  return m ? m[1].trim() : null;
}

export type ChangelogBlock =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "li"; text: string };

/**
 * Minimaler Markdown-Ausschnitt für unsere Datei: #, ##, ###, "- "/ "* "-Listen,
 * Absätze. HTML-Kommentare und leere Zeilen fallen weg.
 */
export function parseChangelogKoerper(md: string): ChangelogBlock[] {
  const ohneKommentare = md.replace(/<!--[\s\S]*?-->/g, "");
  const bloecke: ChangelogBlock[] = [];
  let absatz: string[] = [];

  function absatzLeeren() {
    const text = absatz.join(" ").trim();
    if (text) bloecke.push({ kind: "p", text });
    absatz = [];
  }

  for (const rohZeile of ohneKommentare.split("\n")) {
    const zeile = rohZeile.trim();
    if (!zeile) {
      absatzLeeren();
      continue;
    }
    if (zeile.startsWith("### ")) {
      absatzLeeren();
      bloecke.push({ kind: "h3", text: zeile.slice(4).trim() });
    } else if (zeile.startsWith("## ")) {
      absatzLeeren();
      bloecke.push({ kind: "h2", text: zeile.slice(3).trim() });
    } else if (zeile.startsWith("# ")) {
      absatzLeeren();
      bloecke.push({ kind: "h1", text: zeile.slice(2).trim() });
    } else if (/^---+$/.test(zeile)) {
      absatzLeeren();
    } else if (/^[-*]\s+/.test(zeile)) {
      absatzLeeren();
      bloecke.push({ kind: "li", text: zeile.replace(/^[-*]\s+/, "").trim() });
    } else {
      absatz.push(zeile);
    }
  }
  absatzLeeren();
  return bloecke;
}

export type InlineTeil = {
  text: string;
  href?: string;
  bold?: boolean;
};

/**
 * Inline-Syntax: [Text](href) und **fett**. Links werden in der UI als Buttons
 * gerendert (Wunsch: Änderungen mit Links/Buttons), Fett bleibt Fett.
 */
export function parseInline(text: string): InlineTeil[] {
  const teile: InlineTeil[] = [];
  const linkMuster = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let letzte = 0;
  let m: RegExpExecArray | null;
  while ((m = linkMuster.exec(text)) !== null) {
    if (m.index > letzte) {
      teile.push({ text: text.slice(letzte, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      teile.push({ text: m[1], href: m[2] });
    } else if (m[3] !== undefined) {
      teile.push({ text: m[3], bold: true });
    }
    letzte = m.index + m[0].length;
  }
  if (letzte < text.length) {
    teile.push({ text: text.slice(letzte) });
  }
  return teile.filter((t) => t.text.length > 0);
}

export type ChangelogSchritt = {
  titel: string;
  bloecke: ChangelogBlock[];
};

/**
 * Teilt die Blöcke in Tour-Schritte: Jede `##`-Überschrift beginnt einen
 * neuen Schritt, die `#`-Überschrift wird zur Dachzeile. Blöcke vor der
 * ersten `##` gehören zum ersten Schritt.
 */
export function teileChangelogSchritte(bloecke: ChangelogBlock[]): {
  ueberschrift: string;
  schritte: ChangelogSchritt[];
} {
  let ueberschrift = "Neu im Glas";
  const schritte: ChangelogSchritt[] = [];
  let aktuell: ChangelogBlock[] = [];
  let titel = "";

  function schrittAblegen() {
    if (aktuell.length === 0 && !titel) return;
    schritte.push({ titel, bloecke: aktuell });
    aktuell = [];
    titel = "";
  }

  for (const block of bloecke) {
    if (block.kind === "h1") {
      if (block.text.trim()) ueberschrift = block.text.trim();
    } else if (block.kind === "h2") {
      schrittAblegen();
      titel = block.text.trim();
    } else {
      aktuell.push(block);
    }
  }
  schrittAblegen();

  if (schritte.length === 0) {
    schritte.push({ titel: "", bloecke: [] });
  }
  return { ueberschrift, schritte };
}
