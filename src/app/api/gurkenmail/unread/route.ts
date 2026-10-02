import { hexclaveServerApp } from "@/hexclave/server";
import { leseMailbox } from "@/lib/gurkenmail";
import { syncMailboxZumWorker } from "@/lib/gurkenmailServer";

export const runtime = "nodejs";

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

/**
 * Leichtgewicht für Dashboard-Badge + PWA-Polling: nur die Zahl der
 * ungelesenen Mails (keine Liste). Proxyt zum Worker-`/unread`.
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
    return Response.json({ error: "Noch keine GurkenMail-Adresse", ungelesen: 0 }, { status: 404 });
  }
  if (!INBOUND_URL || !INBOUND_SECRET) {
    return Response.json({ ungelesen: 0, bereit: false });
  }

  await syncMailboxZumWorker(mailbox.localpart, user.id);

  try {
    const url = new URL("/unread", INBOUND_URL);
    url.searchParams.set("mailbox", mailbox.localpart);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${INBOUND_SECRET}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Inbound ${res.status}`);
    const data = (await res.json()) as {
      ungelesen?: number;
      neueste?: { id: string; from: string; subject: string; receivedAt: string } | null;
    };
    const ungelesen =
      typeof data.ungelesen === "number" && Number.isFinite(data.ungelesen) ? data.ungelesen : 0;
    return Response.json({ ungelesen, neueste: data.neueste ?? null, bereit: true });
  } catch (error) {
    console.error("GurkenMail Unread-Proxy:", error);
    return Response.json(
      { ungelesen: 0, bereit: false, error: "Postfach gerade nicht erreichbar." },
      { status: 502 },
    );
  }
}
