import { eq } from "drizzle-orm";
import { after, NextResponse, type NextRequest } from "next/server";

import { db, webhookEvents } from "@/lib/db";
import { resolveShop } from "@/lib/shopify/credentials";
import { handleWebhook } from "@/lib/shopify/handlers";
import {
  isValidShopDomain,
  normalizeShopDomain,
  verifyWebhookHmac,
} from "@/lib/shopify/hmac";
import { topicFromHeader } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single endpoint for every Shopify webhook.
 *
 * Contract with Shopify:
 *   1. Work out which app sent this, then verify the HMAC over the raw body
 *      with that app's secret — an unverified payload is rejected with 401 and
 *      nothing is written.
 *   2. Deduplicate on `X-Shopify-Event-Id` via a unique index, so a redelivery
 *      is acknowledged without being processed a second time.
 *   3. Acknowledge immediately and do the work in `after()`, so a slow
 *      downstream call never causes Shopify to time out and retry.
 */
export async function POST(request: NextRequest) {
  // The raw bytes, exactly as received: re-serialising would break the HMAC.
  const rawBody = await request.text();

  const topicHeader = request.headers.get("x-shopify-topic") ?? "";
  const eventId = request.headers.get("x-shopify-event-id");
  const shopHeader = request.headers.get("x-shopify-shop-domain");
  const shopDomain = shopHeader ? normalizeShopDomain(shopHeader) : null;

  // --- Which app signed this? ----------------------------------------------
  // One endpoint serves every Shopify app the platform holds, and each app has
  // its own secret, so the shop domain has to be read before the signature can
  // be checked at all. The header is unauthenticated — it only selects a
  // candidate secret, and naming the wrong shop simply fails the check below.
  // Authenticity still rests entirely on the HMAC.
  if (!shopDomain || !isValidShopDomain(shopDomain)) {
    return NextResponse.json({ error: "Missing shop domain." }, { status: 400 });
  }

  const { store, credentials } = await resolveShop(shopDomain);

  // A shop we do not know falls back to the environment credentials, so a
  // webhook that arrives before the install finishes is still verifiable. With
  // neither, the answer is the same as a bad signature — deliberately, so this
  // endpoint cannot be used to find out which shops exist.
  const signatureOk =
    credentials !== null &&
    verifyWebhookHmac({
      rawBody,
      headerHmac: request.headers.get("x-shopify-hmac-sha256"),
      secret: credentials.apiSecret,
    });

  if (!signatureOk) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const topic = topicFromHeader(topicHeader);
  if (!topic) {
    // Acknowledge so Shopify stops retrying a topic we do not consume.
    return NextResponse.json({ ok: true, ignored: topicHeader });
  }
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id." }, { status: 400 });
  }

  // --- Idempotence ---------------------------------------------------------
  // The unique index on shopify_event_id is the arbiter: if the insert returns
  // nothing, another delivery of this exact event already claimed it.
  const claimed = await db
    .insert(webhookEvents)
    .values({ shopifyEventId: eventId, shopDomain, topic: topicHeader })
    .onConflictDoNothing({ target: webhookEvents.shopifyEventId })
    .returning({ id: webhookEvents.id });

  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const eventRowId = claimed[0].id;

  if (!store) {
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: "Unknown store." })
      .where(eq(webhookEvents.id, eventRowId));
    return NextResponse.json({ ok: true, detail: "Unknown store." });
  }

  // Acknowledge now, process after the response is flushed.
  after(async () => {
    try {
      const payload = JSON.parse(rawBody) as unknown;
      const result = await handleWebhook({ topic, store, payload });
      await db
        .update(webhookEvents)
        .set({
          processedAt: new Date(),
          error: result.handled ? null : result.detail,
        })
        .where(eq(webhookEvents.id, eventRowId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[webhook] ${topicHeader} failed:`, message);
      await db
        .update(webhookEvents)
        .set({ processedAt: new Date(), error: message.slice(0, 1000) })
        .where(eq(webhookEvents.id, eventRowId));
    }
  });

  return NextResponse.json({ ok: true });
}
