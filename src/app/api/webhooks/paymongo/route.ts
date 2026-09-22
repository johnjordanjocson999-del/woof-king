import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { markPaymentPaid, verifyPaymongoSignature } from "@/domain/payments";

/**
 * PayMongo webhook.
 * Success redirects never mark paid — only a verified event here does.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const settings = await getSettings();
  const secret =
    settings.paymongoWebhookKey || process.env.PAYMONGO_WEBHOOK_SECRET || "";
  const signature = req.headers.get("paymongo-signature");

  if (!verifyPaymongoSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    data?: {
      id?: string;
      attributes?: {
        type?: string;
        data?: {
          id?: string;
          attributes?: {
            status?: string;
            metadata?: { payment_id?: string; order_id?: string };
            payment_intent_id?: string;
          };
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const eventId = payload.data?.id;
  const eventType = payload.data?.attributes?.type;
  if (!eventId) return NextResponse.json({ error: "No event id" }, { status: 400 });

  const existing = await db.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "paymongo", eventId } },
  });
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  await db.webhookEvent.create({
    data: {
      provider: "paymongo",
      eventId,
      orderId: payload.data?.attributes?.data?.attributes?.metadata?.order_id,
    },
  });

  if (
    eventType === "checkout_session.payment.paid" ||
    eventType === "payment.paid"
  ) {
    const meta = payload.data?.attributes?.data?.attributes?.metadata;
    const paymentId = meta?.payment_id;
    if (paymentId) {
      await markPaymentPaid({
        paymentId,
        providerPaymentId: payload.data?.attributes?.data?.id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
