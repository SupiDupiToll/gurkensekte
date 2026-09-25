/**
 * Lieferadresse der echten Gurken-Bestellung.
 *
 * Die Adresse ist Pflicht: erst wenn Name, Straße, PLZ und Ort vollständig
 * sind, wird die Bestellung angenommen und die 1000 Punkte abgezogen.
 * Die Adresse geht anschließend als Hexclave-E-Mail an die Sekten-Leitung
 * ({@link BESTELLUNG_EMAIL}).
 */

export type GurkenAdresse = {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
};

/**
 * An diese Adresse geht jede Gurken-Bestellung als Hexclave-E-Mail –
 * dieselbe Sekten-Leitung wie bei den Werbe-Prüf-Mails.
 */
export const BESTELLUNG_EMAIL = "rui@sdtoll.de";

/** Schutz gegen endlose Metadaten-Einträge. */
const MAX = { name: 80, strasse: 120, plz: 10, ort: 80, land: 60 } as const;

function text(wert: unknown, max: number): string {
  return typeof wert === "string" ? wert.trim().slice(0, max) : "";
}

export type AdressPruefung =
  | { ok: true; adresse: GurkenAdresse }
  | { ok: false; error: string };

/** Prüft eine rohe Adresse aus dem Request und liefert eine konkrete Meldung. */
export function adressePruefen(raw: unknown): AdressPruefung {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      error: "Bitte gib zuerst deine Lieferadresse an",
    };
  }

  const roh = raw as Partial<Record<keyof GurkenAdresse, unknown>>;
  const adresse: GurkenAdresse = {
    name: text(roh.name, MAX.name),
    strasse: text(roh.strasse, MAX.strasse),
    plz: text(roh.plz, MAX.plz),
    ort: text(roh.ort, MAX.ort),
    land: text(roh.land, MAX.land) || "Deutschland",
  };

  if (!adresse.name) return { ok: false, error: "Bitte trag deinen Namen ein" };
  if (!adresse.strasse) {
    return { ok: false, error: "Bitte trag Straße und Hausnummer ein" };
  }
  if (!adresse.plz) {
    return { ok: false, error: "Bitte trag deine Postleitzahl ein" };
  }
  if (!adresse.ort) return { ok: false, error: "Bitte trag deinen Ort ein" };

  return { ok: true, adresse };
}

/** Einzeilige Darstellung für Benachrichtigungen und Anzeigen. */
export function adresseFormatieren(adresse: GurkenAdresse): string {
  const ort = `${adresse.plz} ${adresse.ort}`.trim();
  return `${adresse.name}, ${adresse.strasse}, ${ort} (${adresse.land})`;
}

/** Liest eine gespeicherte Adresse defensiv aus den Metadaten. */
export function adresseLesen(raw: unknown): GurkenAdresse | null {
  const pruefung = adressePruefen(raw);
  return pruefung.ok ? pruefung.adresse : null;
}
