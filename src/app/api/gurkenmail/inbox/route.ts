import { hexclaveServerApp } from "@/hexclave/server";
import { leseMailbox } from "@/lib/gurkenmail";
import { syncMailboxZumWorker } from "@/lib/gurkenmailServer";
import type { GurkenmailEingang } from "@/lib/gurkenmail";

export const runtime = "nodejs";

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

/**
 * Posteingang: proxyt zum Empfangs-Worker (D1). Ohne konfigurierten Worker
 * (lokal / vor dem Routing-Setup) leeres Ergebnis + `bereit: false`.
 */
export async function GET(req: Request) {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: req,
    or: "return-null",
  })) as unknown as {
    id: string;
    clientReadOnlyMetadata?: Record<string, unknown>;
  } | null;
  if (!user?.id) {
    return Response.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  const meta = (user.clientReadOnlyMetadata ?? {}) as Record<string, unknown>;
  const mailbox = leseMailbox(meta);
  if (!mailbox) {
    return Response.json({ error: "Noch keine GurkenMail-Adresse", mails: [] }, { status: 404 });
  }

  if (!INBOUND_URL || !INBOUND_SECRET) {
    const mails: GurkenmailEingang[] = [];
    return Response.json({ mailbox, mails, bereit: false });
  }

  // Selbstheilung: eigene Mailbox in D1 spiegeln, falls der Sync bei der
  // Vergabe (Worker war noch nicht deployed) fehlgeschlagen ist.
  await syncMailboxZumWorker(mailbox.localpart, user.id);

  try {
    const url = new URL("/inbox", INBOUND_URL);
    url.searchParams.set("mailbox", mailbox.localpart);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${INBOUND_SECRET}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Inbound ${res.status}`);
    const data = (await res.json()) as { mails?: GurkenmailEingang[] };
    return Response.json({ mailbox, mails: data.mails ?? [], bereit: true });
  } catch (error) {
    console.error("GurkenMail Inbox-Proxy:", error);
    return Response.json(
      { mailbox, mails: [], bereit: false, error: "Postfach gerade nicht erreichbar." },
      { status: 502 },
    );
  }
}
