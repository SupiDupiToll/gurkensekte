/**
 * Tageslosung: ein Spruch pro Tag für alle – auch ohne Login. Rotation über
 * Tagesnummer (UTC), damit jeder Tag weltweit dieselbe Losung zeigt.
 * Bewusst statisch (kein LLM, keine Kosten): ein Grund mehr, täglich
 * vorbeizuschauen. Neue Sprüche einfach anhängen.
 */

export const TAGESLOSUNGEN: string[] = [
  "Die Gurke wartet nicht. Das Glas auch nicht. Komm heute.",
  "Wer heute nicht einlegt, legt morgen nach.",
  "Ein Tag ohne Gurke ist ein Tag ohne Sinn – fast.",
  "Gürkchen sieht dich. Besonders montags.",
  "Klein anfangen: ein Zitat. Groß enden: eine Gurke.",
  "Das Glas ist halb voll. Der Rest ist Essig und Zuversicht.",
  "Stille Wasser sind tief. Stille Gurken sind eingelegt.",
  "Heute ist ein guter Tag, um jemandem Gurkenpost zu schreiben.",
  "Mut ist, wenn man trotzdem zum Duell antritt.",
  "Die beste Gurke ist die, die man teilt. Die zweitbeste isst man selbst.",
  "Rom wurde nicht an einem Tag erbaut. Aber eingelegt.",
  "Wer seine Serie hält, hält sein Glas.",
  "Auch die längste Erleuchtung beginnt mit einem einzigen Bissen.",
  "Freitag ist Roast-Tag. Nimm's sportlich, Gurken-Kind.",
];

/** Tagesnummer seit Epoche (UTC) – stabil pro Kalendertag. */
export function tagesNummer(datum: Date = new Date()): number {
  return Math.floor(
    Date.UTC(
      datum.getUTCFullYear(),
      datum.getUTCMonth(),
      datum.getUTCDate(),
    ) /
      (24 * 60 * 60 * 1000),
  );
}

/** Losung des Tages (Rotation über die Liste). */
export function tageslosungFuer(datum: Date = new Date()): string {
  if (TAGESLOSUNGEN.length === 0) return "";
  const index =
    ((tagesNummer(datum) % TAGESLOSUNGEN.length) + TAGESLOSUNGEN.length) %
    TAGESLOSUNGEN.length;
  return TAGESLOSUNGEN[index];
}
