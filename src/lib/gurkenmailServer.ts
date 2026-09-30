/** Serverseitige GurkenMail-Helfer (nur in Route Handlern nutzen). */

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

export function inboundKonfiguriert(): boolean {
  return Boolean(INBOUND_URL && INBOUND_SECRET);
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
