import { eq } from "drizzle-orm";

import { randomToken } from "@/lib/crypto/secrets";
import { db, orders, stores, type Order, type Store } from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { cancelPendingSends, scheduleOrderSequence } from "@/lib/email/scheduler";
import { getFirstStage } from "@/lib/orders/stages";
import { placeOrderInFirstStage } from "@/lib/orders/transitions";
import { mapOrderPayload, type ShopifyOrderPayload } from "./orders";
import type { WebhookTopic } from "./webhooks";

export type HandlerResult = { handled: boolean; detail: string };

/** Routes a verified webhook payload to the right handler. */
export async function handleWebhook({
  topic,
  store,
  payload,
}: {
  topic: WebhookTopic;
  store: Store;
  payload: unknown;
}): Promise<HandlerResult> {
  switch (topic) {
    case "ORDERS_CREATE":
      return handleOrdersCreate(store, payload as ShopifyOrderPayload);
    case "ORDERS_UPDATED":
      return handleOrdersUpdated(store, payload as ShopifyOrderPayload);
    case "ORDERS_CANCELLED":
      return handleOrdersCancelled(store, payload as ShopifyOrderPayload);
    case "FULFILLMENTS_CREATE":
      return handleFulfillmentsCreate(store, payload);
    case "APP_UNINSTALLED":
      return handleAppUninstalled(store);
    default:
      return { handled: false, detail: `Unhandled topic ${topic}.` };
  }
}

/**
 * `orders/create` — the only place an order enters the system.
 *
 * Creates the order, places it in the store's first stage (recorded as a real
 * `shopify_webhook` event) and schedules the delay-based email sequence.
 */
async function handleOrdersCreate(
  store: Store,
  payload: ShopifyOrderPayload,
): Promise<HandlerResult> {
  const tdb = new TenantDb(store.id);
  const fields = mapOrderPayload(payload, store.currency);

  const existing = await findOrderByShopifyId(tdb, fields.shopifyOrderId);
  if (existing) {
    // A replayed create: refresh the mirrored fields, but never re-run the
    // stage placement, which would duplicate the customer's timeline.
    await tdb.update(orders, { ...fields, updatedAt: new Date() }, eq(orders.id, existing.id));
    return { handled: true, detail: `Order ${fields.orderNumber} already existed; fields resynced.` };
  }

  const firstStage = await getFirstStage(tdb);
  if (!firstStage) {
    return {
      handled: false,
      detail: "Store has no stages configured, so the order cannot be placed.",
    };
  }

  const order = await tdb.insertOne(orders, {
    ...fields,
    trackingToken: randomToken(18),
    fulfillmentStatus: "unfulfilled",
  });

  await placeOrderInFirstStage({ tdb, order, firstStage });
  const scheduled = await scheduleOrderSequence({ tdb, order });

  return {
    handled: true,
    detail: `Order ${order.orderNumber} created in "${firstStage.name}"; ${scheduled} delayed email(s) scheduled.`,
  };
}

/**
 * `orders/updated` — resynchronise the mirrored fields only.
 *
 * It deliberately does NOT move the order between stages: delivery progress
 * belongs to the agency, not to an edit made in the Shopify admin.
 */
async function handleOrdersUpdated(
  store: Store,
  payload: ShopifyOrderPayload,
): Promise<HandlerResult> {
  const tdb = new TenantDb(store.id);
  const fields = mapOrderPayload(payload, store.currency);
  const existing = await findOrderByShopifyId(tdb, fields.shopifyOrderId);

  if (!existing) {
    // We can arrive here if the app was installed after the order was placed.
    return handleOrdersCreate(store, payload);
  }

  await tdb.update(
    orders,
    {
      orderNumber: fields.orderNumber,
      customerName: fields.customerName,
      customerEmail: fields.customerEmail,
      customerPhone: fields.customerPhone,
      shippingAddress: fields.shippingAddress,
      lineItems: fields.lineItems,
      total: fields.total,
      currency: fields.currency,
      cancelledAt: fields.cancelledAt,
      updatedAt: new Date(),
    },
    eq(orders.id, existing.id),
  );

  return { handled: true, detail: `Order ${fields.orderNumber} resynced.` };
}

async function handleOrdersCancelled(
  store: Store,
  payload: ShopifyOrderPayload,
): Promise<HandlerResult> {
  const tdb = new TenantDb(store.id);
  const fields = mapOrderPayload(payload, store.currency);
  const existing = await findOrderByShopifyId(tdb, fields.shopifyOrderId);
  if (!existing) return { handled: false, detail: "Unknown order." };

  await tdb.update(
    orders,
    { cancelledAt: fields.cancelledAt ?? new Date(), updatedAt: new Date() },
    eq(orders.id, existing.id),
  );

  const cancelled = await cancelPendingSends({
    tdb,
    orderId: existing.id,
    reason: "Order was cancelled in Shopify.",
  });

  return {
    handled: true,
    detail: `Order ${fields.orderNumber} cancelled; ${cancelled} pending email(s) stopped.`,
  };
}

/**
 * `fulfillments/create` — a fulfillment that did not come from this app
 * (created in the Shopify admin, or by another app). We record the resulting
 * status so the backoffice stays truthful and auto-fulfillment stays idempotent.
 */
async function handleFulfillmentsCreate(
  store: Store,
  payload: unknown,
): Promise<HandlerResult> {
  const body = payload as {
    id?: number | string;
    order_id?: number | string;
    status?: string;
    admin_graphql_api_id?: string;
  };

  if (!body.order_id) return { handled: false, detail: "No order id in payload." };

  const tdb = new TenantDb(store.id);
  const existing = await findOrderByShopifyId(tdb, String(body.order_id));
  if (!existing) return { handled: false, detail: "Unknown order." };

  if (existing.shopifyFulfillmentId) {
    return { handled: true, detail: "Fulfillment already recorded." };
  }

  await tdb.update(
    orders,
    {
      fulfillmentStatus: body.status === "cancelled" ? "unfulfilled" : "fulfilled",
      shopifyFulfillmentId:
        body.admin_graphql_api_id ?? (body.id ? String(body.id) : null),
      fulfilledAt: new Date(),
      fulfillmentError: null,
      updatedAt: new Date(),
    },
    eq(orders.id, existing.id),
  );

  return {
    handled: true,
    detail: `Fulfillment recorded for order ${existing.orderNumber}.`,
  };
}

/** `app/uninstalled` — stop everything and destroy the access token. */
async function handleAppUninstalled(store: Store): Promise<HandlerResult> {
  await db
    .update(stores)
    .set({
      status: "uninstalled",
      uninstalledAt: new Date(),
      // The token is worthless to us now and must not be kept at rest.
      accessToken: null,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, store.id));

  return { handled: true, detail: `Store ${store.shopDomain} marked uninstalled.` };
}

function findOrderByShopifyId(
  tdb: TenantDb,
  shopifyOrderId: string,
): Promise<Order | null> {
  return tdb.findFirst(orders, {
    where: eq(orders.shopifyOrderId, shopifyOrderId),
  });
}
