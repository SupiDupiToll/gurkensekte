/**
 * POST /api/spenden/checkout
 *
 * Legt serverseitig eine Mangoe-Checkout-Session an (Pay-what-you-want:
 * `amountCents` wird mitgeschickt) und gibt `checkoutUrl` + `sessionId`
 * ans Frontend zurück. Das Frontend bettet die URL per
 * `MangoePay.embed()` ein – der API-Key verlässt den Server nie.
 *
 * Env (nur Server):
 * - MANGOE_API_KEY (Pflicht, `mng_live_…`)
 * - MANGOE_URL (optional, Default https://payments.mangoe.de)
 * - MANGOE_PAYMENT_LINK_SLUG (Pflicht, Slug des Spenden-Payment-Links)
 * - SITE_URL (optional, kanonische Origin für successUrl/cancelUrl)
 */

export const runtime = "nodejs";

const MIN_CENTS = 50; // 0,50 €
const MAX_CENTS = 1_000_000; // 10.000 €

function mangoeBase(): string {
  return (process.env.MANGOE_URL?.trim() || "https://payments.mangoe.de").replace(
    /\/+$/,
    "",
  );
}

function requestOrigin(req: Request): string {
  // Kanonische Origin bevorzugen (schützt successUrl vor Host-Header-Poisoning).
  // Fallback: Request-Origin (lokal / Preview).
  const kanonisch = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (kanonisch) return kanonisch;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  let amountEur: unknown;
  try {
    ({ amountEur } = (await req.json()) as { amountEur?: unknown });
  } catch {
    return Response.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const amount = typeof amountEur === "number" ? amountEur : Number(amountEur);
  if (!Number.isFinite(amount)) {
    return Response.json({ error: "Ungültiger Betrag" }, { status: 400 });
  }
  const amountCents = Math.round(amount * 100);
  if (amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return Response.json(
      { error: "Betrag muss zwischen 0,50 € und 10.000 € liegen" },
      { status: 400 },
    );
  }

  const apiKey = process.env.MANGOE_API_KEY?.trim();
  const paymentLinkSlug = process.env.MANGOE_PAYMENT_LINK_SLUG?.trim();
  if (!apiKey || apiKey === "your_mangoe_api_key_here") {
    return Response.json(
      { error: "Mangoe ist nicht konfiguriert (MANGOE_API_KEY fehlt)" },
      { status: 500 },
    );
  }
  if (!paymentLinkSlug) {
    return Response.json(
      { error: "Mangoe ist nicht konfiguriert (MANGOE_PAYMENT_LINK_SLUG fehlt)" },
      { status: 500 },
    );
  }

  const origin = requestOrigin(req);
  const externalReference = `GurkenSpende-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`.slice(0, 120);

  try {
    const res = await fetch(`${mangoeBase()}/api/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentLinkSlug,
        amountCents,
        externalReference,
        successUrl: `${origin}/spenden/danke`,
        cancelUrl: `${origin}/spenden?abgebrochen=1`,
        metadata: { quelle: "gurkensekte-spenden", betragEur: amount },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Mangoe Checkout-Fehler:", res.status, text);
      return Response.json(
        { error: "Spenden-Checkout konnte nicht gestartet werden" },
        { status: 502 },
      );
    }

    const session = (await res.json()) as {
      id?: string;
      checkoutUrl?: string;
    };
    if (!session.id || !session.checkoutUrl) {
      console.error("Mangoe Checkout: unerwartete Antwort", session);
      return Response.json(
        { error: "Spenden-Checkout konnte nicht gestartet werden" },
        { status: 502 },
      );
    }

    return Response.json({
      sessionId: session.id,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (error) {
    console.error("Mangoe Checkout: Netzwerk-Fehler", error);
    return Response.json(
      { error: "Spenden-Checkout konnte nicht gestartet werden" },
      { status: 502 },
    );
  }
}
