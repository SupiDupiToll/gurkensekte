/**
 * POST /api/spenden/webhook
 *
 * Empfängt Mangoe-Zahlungsereignisse (im Dashboard pro Payment Link als
 * Webhook-URL hinterlegen):
 *   https://gurkensekte.de/api/spenden/webhook
 *
 * Header: X-Mangoe-Event, X-Mangoe-Signature (HMAC-SHA256 über den Raw-Body
 * mit MANGOE_WEBHOOK_SECRET), X-Mangoe-Delivery.
 * Events: checkout.session.completed, payment.succeeded, payment.failed.
 *
 * Für Spenden gibt es keine Bestellung zu erfüllen – der Abschluss wird
 * geloggt und mit 200 bestätigt. Die Danke-Seite verifiziert zusätzlich
 * serverseitig über /api/spenden/status.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const BEKANNTE_EVENTS = new Set([
  "checkout.session.completed",
  "payment.succeeded",
  "payment.failed",
]);

function signaturOk(rawBody: string, signature: string | null): boolean {
  const secret = process.env.MANGOE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const erwartet = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(erwartet, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.MANGOE_WEBHOOK_SECRET?.trim();
  if (!secret || secret === "your_mangoe_webhook_secret_here") {
    console.error("Mangoe Webhook: MANGOE_WEBHOOK_SECRET fehlt");
    return Response.json(
      { error: "Webhook ist nicht konfiguriert (MANGOE_WEBHOOK_SECRET fehlt)" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const event = req.headers.get("x-mangoe-event");
  const signature = req.headers.get("x-mangoe-signature");

  if (!signaturOk(rawBody, signature)) {
    return Response.json({ error: "Ungültige Signatur" }, { status: 401 });
  }

  if (!event || !BEKANNTE_EVENTS.has(event)) {
    // Unbekannte Events trotzdem mit 200 quittieren, damit Mangoe nicht
    // endlos erneut zustellt.
    return Response.json({ ok: true, ignored: true });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const delivery = req.headers.get("x-mangoe-delivery") ?? "unbekannt";
  console.info("Mangoe Webhook:", {
    event,
    delivery,
    orderNumber: payload.orderNumber ?? null,
    externalReference: payload.externalReference ?? null,
    amountCents: payload.amountCents ?? null,
    currency: payload.currency ?? null,
    paymentMethod: payload.paymentMethod ?? null,
    status: payload.status ?? null,
    customerEmail: payload.customerEmail ?? null,
  });

  // Kein 500er nach erfolgreicher Prüfung: Fehlgeschlagene Zustellungen
  // würden sonst im Dashboard als fehlerhaft auftauchen und erneut senden.
  return Response.json({ ok: true });
}

/** Hinweis für den Browser – echte Events kommen nur per POST von Mangoe. */
export async function GET() {
  return Response.json({
    ok: true,
    hinweis:
      "Mangoe-Webhook-Endpunkt. Im Dashboard als Webhook-URL hinterlegen: https://gurkensekte.de/api/spenden/webhook",
  });
}
