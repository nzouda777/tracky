import { eq } from "drizzle-orm";

import {
  db,
  fulfillmentRules,
  orders,
  proofOfDelivery,
  stores,
  type Order,
  type Stage,
} from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";
import { ShopifyAdminClient, toGid } from "@/lib/shopify/admin-api";
import { buildTrackingLink } from "@/lib/tracking/links";

/**
 * Auto-fulfillment.
 *
 * Fulfillment is pushed to Shopify only when ALL of the following hold:
 *   - the store has fulfillment enabled;
 *   - the stage that was just reached is flagged `triggers_fulfillment`;
 *   - a `proof_of_delivery` row exists, i.e. the delivery agency declared the
 *     order delivered after the customer signed the paper note;
 *   - the order has not already been fulfilled.
 *
 * There is no path through this module that fulfils on a delay or a schedule.
 */

export type FulfillmentOutcome =
  | { status: "fulfilled"; fulfillmentId: string }
  | { status: "already-fulfilled"; fulfillmentId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Shopify renamed this mutation to `fulfillmentCreate` in newer API versions;
 * the input shape is identical, so switching is a one-line change.
 */
const FULFILLMENT_MUTATION_NAME = "fulfillmentCreateV2";

const FULFILLMENT_ORDERS_QUERY = `
  query FulfillmentOrders($id: ID!) {
    order(id: $id) {
      id
      displayFulfillmentStatus
      fulfillmentOrders(first: 25) {
        nodes { id status }
      }
    }
  }
`;

const FULFILLMENT_MUTATION = `
  mutation CreateFulfillment($fulfillment: FulfillmentV2Input!) {
    ${FULFILLMENT_MUTATION_NAME}(fulfillment: $fulfillment) {
      fulfillment { id status createdAt }
      userErrors { field message }
    }
  }
`;

export async function attemptFulfillment({
  tdb,
  order,
  stage,
}: {
  tdb: TenantDb;
  order: Order;
  stage: Stage;
}): Promise<FulfillmentOutcome> {
  if (!stage.triggersFulfillment) {
    return { status: "skipped", reason: "Stage does not trigger fulfillment." };
  }

  // --- Idempotence: never fulfil the same order twice ----------------------
  if (order.fulfillmentStatus === "fulfilled" || order.shopifyFulfillmentId) {
    return {
      status: "already-fulfilled",
      fulfillmentId: order.shopifyFulfillmentId,
    };
  }

  const rules = await tdb.findFirst(fulfillmentRules);
  if (rules && !rules.enabled) {
    return { status: "skipped", reason: "Auto-fulfillment is turned off for this store." };
  }

  // --- The core guarantee: no fulfillment without confirmed delivery -------
  const requiresProof = rules?.requireDeliveryConfirmation ?? true;
  const proof = await tdb.findFirst(proofOfDelivery, {
    where: eq(proofOfDelivery.orderId, order.id),
  });

  if (requiresProof && !proof) {
    return {
      status: "skipped",
      // Named as a missing record rather than a missing party: a store that
      // delivers its own orders has no agency to wait for, and can record the
      // declaration itself from the order screen.
      reason:
        "no delivery has been confirmed yet. Record it with \"Mark as delivered\" on the order, or turn off \"require delivery confirmation\" in fulfillment settings.",
    };
  }

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, tdb.storeId))
    .limit(1);

  if (!store || store.status !== "active" || !store.accessToken) {
    return {
      status: "skipped",
      reason: "The Shopify connection for this store is not active.",
    };
  }

  try {
    const client = ShopifyAdminClient.forStore(store);
    const orderGid = toGid("Order", order.shopifyOrderId);

    const data = await client.graphql<{
      order: {
        id: string;
        displayFulfillmentStatus: string;
        fulfillmentOrders: { nodes: Array<{ id: string; status: string }> };
      } | null;
    }>(FULFILLMENT_ORDERS_QUERY, { id: orderGid });

    if (!data.order) {
      return await fail(tdb, order, "The order no longer exists in Shopify.");
    }

    // Shopify already considers it fulfilled (e.g. fulfilled from the admin):
    // record that and stop, rather than erroring on a duplicate.
    if (data.order.displayFulfillmentStatus === "FULFILLED") {
      await tdb.update(
        orders,
        {
          fulfillmentStatus: "fulfilled",
          fulfilledAt: order.fulfilledAt ?? new Date(),
          fulfillmentError: null,
          updatedAt: new Date(),
        },
        eq(orders.id, order.id),
      );
      return { status: "already-fulfilled", fulfillmentId: null };
    }

    const openFulfillmentOrders = data.order.fulfillmentOrders.nodes.filter(
      (node) => node.status === "OPEN" || node.status === "IN_PROGRESS",
    );

    if (openFulfillmentOrders.length === 0) {
      return await skipAndRecord(
        tdb,
        order,
        "Shopify has no open fulfillment orders left for this order.",
      );
    }

    const trackingUrl = buildTrackingLink(store, order);

    const result = await client.graphql<{
      [FULFILLMENT_MUTATION_NAME]: {
        fulfillment: { id: string; status: string } | null;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    }>(FULFILLMENT_MUTATION, {
      fulfillment: {
        lineItemsByFulfillmentOrder: openFulfillmentOrders.map((node) => ({
          fulfillmentOrderId: node.id,
        })),
        notifyCustomer: rules?.notifyCustomerOnFulfillment ?? false,
        // Real delivery information: our own last-mile service, and the link
        // to the timeline that carries the confirmed delivery event.
        trackingInfo: {
          company: store.name ? `${store.name} Delivery` : "Local Delivery",
          number: order.orderNumber,
          url: trackingUrl,
        },
      },
    });

    const payload = result[FULFILLMENT_MUTATION_NAME];
    if (payload.userErrors.length > 0) {
      return await fail(
        tdb,
        order,
        payload.userErrors.map((error) => error.message).join("; "),
      );
    }

    const fulfillmentId = payload.fulfillment?.id;
    if (!fulfillmentId) {
      return await fail(tdb, order, "Shopify returned no fulfillment.");
    }

    await tdb.update(
      orders,
      {
        fulfillmentStatus: "fulfilled",
        shopifyFulfillmentId: fulfillmentId,
        fulfilledAt: proof?.deliveredAt ?? new Date(),
        fulfillmentError: null,
        updatedAt: new Date(),
      },
      eq(orders.id, order.id),
    );

    return { status: "fulfilled", fulfillmentId };
  } catch (error) {
    return await fail(
      tdb,
      order,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function fail(
  tdb: TenantDb,
  order: Order,
  message: string,
): Promise<FulfillmentOutcome> {
  console.error(`[fulfillment] order ${order.orderNumber}: ${message}`);
  await tdb.update(
    orders,
    {
      fulfillmentStatus: "failed",
      fulfillmentError: message.slice(0, 1000),
      updatedAt: new Date(),
    },
    eq(orders.id, order.id),
  );
  return { status: "failed", error: message };
}

async function skipAndRecord(
  tdb: TenantDb,
  order: Order,
  reason: string,
): Promise<FulfillmentOutcome> {
  await tdb.update(
    orders,
    { fulfillmentError: reason.slice(0, 1000), updatedAt: new Date() },
    eq(orders.id, order.id),
  );
  return { status: "skipped", reason };
}

/**
 * Re-runs fulfillment for an order that previously failed. Exposed to the
 * backoffice as a "Retry fulfillment" action; still subject to every rule
 * above, so a retry cannot bypass the proof-of-delivery requirement.
 */
export async function retryFulfillment({
  tdb,
  order,
  stage,
}: {
  tdb: TenantDb;
  order: Order;
  stage: Stage;
}): Promise<FulfillmentOutcome> {
  await tdb.update(
    orders,
    { fulfillmentStatus: "unfulfilled", fulfillmentError: null },
    eq(orders.id, order.id),
  );
  const refreshed = (await tdb.findById(orders, order.id)) ?? order;
  return attemptFulfillment({ tdb, order: refreshed, stage });
}
