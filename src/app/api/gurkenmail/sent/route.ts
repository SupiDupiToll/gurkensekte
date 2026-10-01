import { hexclaveServerApp } from "@/hexclave/server";
import { leseMailbox } from "@/lib/gurkenmail";
import { syncMailboxZumWorker } from "@/lib/gurkenmailServer";
import type { GurkenmailGesendet } from "@/lib/gurkenmail";

export const runtime = "nodejs";

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

/** Versendet-Tab: eigene gesendete Mails aus dem Empfangs-Worker holen. */
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
    const mails: GurkenmailGesendet[] = [];
    return Response.json({ mailbox, mails, bereit: false });
  }

  await syncMailboxZumWorker(mailbox.localpart, user.id);

  try {
    const aufruf = new URL(req.url);
    const url = new URL("/sent", INBOUND_URL);
    url.searchParams.set("mailbox", mailbox.localpart);
    url.searchParams.set("limit", aufruf.searchParams.get("limit") ?? "5");
    url.searchParams.set("offset", aufruf.searchParams.get("offset") ?? "0");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${INBOUND_SECRET}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Inbound ${res.status}`);
    const data = (await res.json()) as { mails?: GurkenmailGesendet[]; hasMore?: boolean };
    return Response.json({ mailbox, mails: data.mails ?? [], hasMore: data.hasMore ?? false, bereit: true });
  } catch (error) {
    console.error("GurkenMail Sent-Proxy:", error);
    return Response.json(
      { mailbox, mails: [], bereit: false, error: "Versendet gerade nicht erreichbar." },
      { status: 502 },
    );
  }
}
