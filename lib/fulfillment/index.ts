import { and, asc, eq, gte, isNotNull, isNull, lte, ne } from "drizzle-orm";

import {
  db,
  fulfillmentRules,
  orders,
  proofOfDelivery,
  stores,
  type FulfillmentRules,
  type Order,
  type Stage,
} from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { ShopifyAdminClient, toGid } from "@/lib/shopify/admin-api";
import { buildTrackingLink } from "@/lib/tracking/links";

/**
 * Auto-fulfillment.
 *
 * Only orders placed in Shopify at or after the store's `autoFulfillSince` are
 * fulfilled automatically; older orders are left for the merchant to fulfil by
 * hand, so their customers never get a second shipping email.
 *
 * An eligible order is pushed to Shopify, with its tracking link, when:
 *
 *   1. **It arrives** (`fulfillNewOrder`), so the customer has the link from
 *      the start.
 *   2. **Its stage changes** while still unfulfilled (`catchUpFulfillment`,
 *      called from `recordStageTransition`), so a first push that failed is
 *      retried on the next real event.
 *   3. **The catch-up sweep runs** (`runFulfillmentCatchUp`), for orders whose
 *      push failed and that have not moved since.
 *
 * `attemptFulfillment` (the proof-of-delivery gate at a trigger stage) remains
 * for the manual "Retry fulfillment" action on older orders.
 *
 * Nothing here fulfils an order twice.
 */

/** Leaves a just-created order to its own webhook before the sweep touches it. */
const CATCH_UP_GRACE_MS = 10 * 60_000;
/** Upper bound per sweep run, so one run always finishes inside the time limit. */
export const CATCH_UP_BATCH_SIZE = 25;

/**
 * Whether `order` falls under auto-fulfillment: the store has it on, and the
 * order was placed in Shopify at or after the store's start date.
 */
export function isAutoFulfillEligible(
  order: Order,
  rules: FulfillmentRules | null,
): boolean {
  if (!rules || !rules.enabled) return false;
  if (order.cancelledAt) return false;
  return order.orderDate.getTime() >= rules.autoFulfillSince.getTime();
}

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

  return pushFulfillment({
    tdb,
    order,
    notifyCustomer: shouldNotify(order, rules),
    fulfilledAt: proof?.deliveredAt ?? new Date(),
  });
}

/**
 * Fulfils an eligible order in Shopify, with its tracking link. No proof of
 * delivery is involved: the point is that the order in Shopify carries the
 * link to follow the delivery from day one.
 *
 * `manual` is the backoffice retry: it bypasses the start date (that is how
 * older orders are fulfilled by hand) but never emails their customer.
 */
export async function fulfillNewOrder({
  tdb,
  order,
  manual = false,
}: {
  tdb: TenantDb;
  order: Order;
  manual?: boolean;
}): Promise<FulfillmentOutcome> {
  if (order.fulfillmentStatus === "fulfilled" || order.shopifyFulfillmentId) {
    return {
      status: "already-fulfilled",
      fulfillmentId: order.shopifyFulfillmentId,
    };
  }

  if (order.cancelledAt) {
    return { status: "skipped", reason: "The order was cancelled in Shopify." };
  }

  const rules = await tdb.findFirst(fulfillmentRules);
  if (rules && !rules.enabled) {
    return { status: "skipped", reason: "Auto-fulfillment is turned off for this store." };
  }

  if (!manual && !isAutoFulfillEligible(order, rules)) {
    return {
      status: "skipped",
      reason: "The order predates auto-fulfillment; fulfil it by hand.",
    };
  }

  return pushFulfillment({
    tdb,
    order,
    notifyCustomer: shouldNotify(order, rules),
    fulfilledAt: new Date(),
  });
}

/**
 * Retries the push for an eligible order that is still unfulfilled. Returns
 * null when there is nothing to do (already fulfilled, or an older order),
 * so callers can tell "no attempt" from an attempt that was skipped.
 */
export async function catchUpFulfillment({
  tdb,
  order,
}: {
  tdb: TenantDb;
  order: Order;
}): Promise<FulfillmentOutcome | null> {
  if (order.fulfillmentStatus === "fulfilled" || order.shopifyFulfillmentId) {
    return null;
  }
  const rules = await tdb.findFirst(fulfillmentRules);
  if (!isAutoFulfillEligible(order, rules)) return null;
  return fulfillNewOrder({ tdb, order });
}

/**
 * Sweeps every store for eligible orders whose push has not gone through yet
 * (a Shopify error, a store that was paused, a missed webhook) and retries
 * them, least recently tried first.
 */
export async function runFulfillmentCatchUp(
  now: Date = new Date(),
): Promise<{ stores: number; attempted: number; fulfilled: number; failed: number }> {
  const enabled = await db
    .select({ rules: fulfillmentRules })
    .from(fulfillmentRules)
    .innerJoin(stores, eq(stores.id, fulfillmentRules.storeId))
    .where(
      and(
        eq(fulfillmentRules.enabled, true),
        eq(stores.status, "active"),
        // A paused store is frozen: nothing aimed outward moves.
        isNull(stores.pausedAt),
        isNotNull(stores.accessToken),
      ),
    );

  const result = { stores: enabled.length, attempted: 0, fulfilled: 0, failed: 0 };
  const graceCutoff = new Date(now.getTime() - CATCH_UP_GRACE_MS);

  for (const { rules } of enabled) {
    const budget = CATCH_UP_BATCH_SIZE - result.attempted;
    if (budget <= 0) break;

    const tdb = new TenantDb(rules.storeId);
    const due = await tdb.raw
      .select({ order: orders })
      .from(orders)
      .where(
        tdb.scope(
          orders,
          isNull(orders.cancelledAt),
          ne(orders.fulfillmentStatus, "fulfilled"),
          isNull(orders.shopifyFulfillmentId),
          gte(orders.orderDate, rules.autoFulfillSince),
          lte(orders.updatedAt, graceCutoff),
        ),
      )
      .orderBy(asc(orders.updatedAt))
      .limit(budget);

    for (const { order } of due) {
      result.attempted += 1;
      const outcome = await fulfillNewOrder({ tdb, order });
      if (outcome.status === "fulfilled" || outcome.status === "already-fulfilled") {
        result.fulfilled += 1;
      } else if (outcome.status === "failed") {
        result.failed += 1;
      }
    }
  }

  return result;
}

/** Shopify's shipping email goes only to orders under auto-fulfillment. */
function shouldNotify(order: Order, rules: FulfillmentRules | null): boolean {
  return (
    isAutoFulfillEligible(order, rules) &&
    (rules?.notifyCustomerOnFulfillment ?? false)
  );
}

/**
 * The Shopify write itself, shared by both triggers: fulfils every open
 * fulfillment order with the tracking link attached, and mirrors the result
 * onto the local order.
 */
async function pushFulfillment({
  tdb,
  order,
  notifyCustomer,
  fulfilledAt,
}: {
  tdb: TenantDb;
  order: Order;
  notifyCustomer: boolean;
  fulfilledAt: Date;
}): Promise<FulfillmentOutcome> {
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

  // A pause stops everything aimed outward, and a fulfillment is a write into
  // the merchant's own Shopify admin.
  if (store.pausedAt) {
    return { status: "skipped", reason: "This store is paused." };
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
        notifyCustomer,
        // Our own last-mile service, and the link to the order's tracking
        // page; Shopify shows both on the order and in its shipping email.
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
        fulfilledAt,
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
 * backoffice as a "Retry fulfillment" action. An order under auto-fulfillment
 * repeats its normal push; an older one goes through `attemptFulfillment` and
 * its proof-of-delivery rule at a trigger stage, or a manual push (no customer
 * email) anywhere else.
 */
export async function retryFulfillment({
  tdb,
  order,
  stage,
}: {
  tdb: TenantDb;
  order: Order;
  stage: Stage | null;
}): Promise<FulfillmentOutcome> {
  await tdb.update(
    orders,
    { fulfillmentStatus: "unfulfilled", fulfillmentError: null },
    eq(orders.id, order.id),
  );
  const refreshed = (await tdb.findById(orders, order.id)) ?? order;
  const rules = await tdb.findFirst(fulfillmentRules);
  if (isAutoFulfillEligible(refreshed, rules)) {
    return fulfillNewOrder({ tdb, order: refreshed });
  }
  return stage?.triggersFulfillment
    ? attemptFulfillment({ tdb, order: refreshed, stage })
    : fulfillNewOrder({ tdb, order: refreshed, manual: true });
}
