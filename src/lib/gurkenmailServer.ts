/** Serverseitige GurkenMail-Helfer (nur in Route Handlern nutzen). */

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

export function inboundKonfiguriert(): boolean {
  return Boolean(INBOUND_URL && INBOUND_SECRET);
}

/**
 * Gesendete Mail für den Versendet-Tab ablegen. Fail-open: Klappt der
 * Worker-Call nicht, ist die Mail trotzdem raus – nur der Verlauf fehlt.
 */
export async function speichereGesendet(
  mailboxLocalpart: string,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  if (!inboundKonfiguriert()) return;
  try {
    await fetch(new URL("/sent", INBOUND_URL!), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INBOUND_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mailbox: mailboxLocalpart, to, subject, text }),
    });
  } catch (error) {
    console.error("GurkenMail Sent-Speichern-Fehler:", error);
  }
}
/**
 * Eigene Mailbox in die D1-Tabelle des Empfangs-Workers spiegeln.
 * Best-effort (fail-open): Bei Fehler nur loggen – die Vergabe selbst
 * ist bereits in Hexclave+Upstash gespeichert, der Sync wird beim
 * nächsten Postfach-Besuch / Versand wiederholt.
 */
export async function syncMailboxZumWorker(
  localpart: string,
  userId: string,
): Promise<void> {
  if (!inboundKonfiguriert()) return;
  try {
    await fetch(new URL("/sync-mailbox", INBOUND_URL!), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INBOUND_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localpart, userId }),
    });
  } catch (error) {
    console.error("GurkenMail Sync-Fehler:", error);
  }
}

/**
 * Willkommens-Mail direkt ins frische Postfach legen (fail-open).
 * Nutzt die interne Zustellung (`/deliver`) – kein Resend, keine
 * Limit-Anrechnung. Wird nur bei der allerersten Vergabe aufgerufen.
 */
export async function stelleWillkommensMailZu(
  localpart: string,
  willkommen: { subject: string; text: string; from: string },
): Promise<void> {
  if (!inboundKonfiguriert()) return;
  try {
    await fetch(new URL("/deliver", INBOUND_URL!), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INBOUND_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: localpart,
        from: willkommen.from,
        subject: willkommen.subject,
        text: willkommen.text,
      }),
    });
  } catch (error) {
    console.error("GurkenMail Willkommens-Mail-Fehler:", error);
  }
}
