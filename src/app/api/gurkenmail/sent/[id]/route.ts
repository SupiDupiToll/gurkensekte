import { hexclaveServerApp } from "@/hexclave/server";
import { leseMailbox } from "@/lib/gurkenmail";

export const runtime = "nodejs";

const INBOUND_URL = process.env.GURKENMAIL_INBOUND_URL;
const INBOUND_SECRET = process.env.GURKENMAIL_INBOUND_SECRET;

/** Einzelne gesendete Mail (Volltext) aus dem Empfangs-Worker holen. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = (await hexclaveServerApp.getUser({
    tokenStore: _req,
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
    return Response.json({ error: "Noch keine GurkenMail-Adresse" }, { status: 404 });
  }
  if (!INBOUND_URL || !INBOUND_SECRET) {
    return Response.json({ error: "Versendet gerade nicht erreichbar." }, { status: 502 });
  }

  const { id } = await params;
  if (!id || id.length > 100) {
    return Response.json({ error: "Ungültige Mail-ID" }, { status: 400 });
  }

  try {
    const url = new URL("/sent-mail", INBOUND_URL);
    url.searchParams.set("mailbox", mailbox.localpart);
    url.searchParams.set("id", id);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${INBOUND_SECRET}` },
      cache: "no-store",
    });
    if (res.status === 404) {
      return Response.json({ error: "Mail nicht gefunden." }, { status: 404 });
    }
    if (!res.ok) throw new Error(`Inbound ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error("GurkenMail Sent-Mail-Proxy:", error);
    return Response.json(
      { error: "Mail konnte nicht geladen werden." },
      { status: 502 },
    );
  }
}
