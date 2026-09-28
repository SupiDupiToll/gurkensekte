/**
 * GET /api/spenden/status?sessionId=cs_…
 *
 * Fragt den Zahlungsstatus serverseitig bei Mangoe ab – URL-Parameter
 * (`session_id`, `order`) werden NIE allein als Zahlungsnachweis akzeptiert.
 * Wird vom Spenden-Iframe (Browser-Event) und von /spenden/danke genutzt.
 */

export const runtime = "nodejs";

function mangoeBase(): string {
  return (process.env.MANGOE_URL?.trim() || "https://payments.mangoe.de").replace(
    /\/+$/,
    "",
  );
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return Response.json({ error: "sessionId fehlt" }, { status: 400 });
  }

  const apiKey = process.env.MANGOE_API_KEY?.trim();
  if (!apiKey || apiKey === "your_mangoe_api_key_here") {
    return Response.json(
      { error: "Mangoe ist nicht konfiguriert (MANGOE_API_KEY fehlt)" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${mangoeBase()}/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) {
      return Response.json(
        { error: "Session konnte nicht geprüft werden" },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      paid?: boolean;
      orderNumber?: string;
      orderStatus?: string;
      paymentMethod?: string;
      amountCents?: number;
      currency?: string;
    };
    return Response.json({
      paid: data.paid === true,
      orderNumber: data.orderNumber ?? null,
      orderStatus: data.orderStatus ?? null,
      paymentMethod: data.paymentMethod ?? null,
      amountCents: data.amountCents ?? null,
      currency: data.currency ?? null,
    });
  } catch (error) {
    console.error("Mangoe Status: Netzwerk-Fehler", error);
    return Response.json(
      { error: "Session konnte nicht geprüft werden" },
      { status: 502 },
    );
  }
}
