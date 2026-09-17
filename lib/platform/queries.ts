import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import {
  emailSends,
  orderStageHistory,
  orders,
  proofOfDelivery,
  stages,
  storeMemberships,
  stores,
  users,
  db,
  type Store,
} from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Cross-tenant read models for the platform panel.
 *
 * **This module intentionally does not use `TenantDb`.** Everywhere else in
 * the app, omitting the tenant filter is a bug; here it is the entire point,
 * which is why these queries live in their own file with this notice rather
 * than being mixed in with per-store code. Every function is callable only
 * behind `requirePlatformAdmin()`.
 *
 * The queries are aggregates and recent-activity lists. None of them return a
 * customer's address, a proof-of-delivery photo, or an order's contents: an
 * operator needs to know that a store is healthy, not to read its customers'
 * personal data.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Platform totals
// ---------------------------------------------------------------------------

export type PlatformTotals = {
  stores: number;
  activeStores: number;
  uninstalledStores: number;
  users: number;
  orders: number;
  ordersLast7: number;
  ordersPrevious7: number;
  deliveriesLast7: number;
  failedFulfillments: number;
  failedEmails: number;
  scheduledEmails: number;
  unprocessedWebhooks: number;
};

export async function getPlatformTotals(): Promise<PlatformTotals> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS);

  const one = async (query: Promise<Array<{ value: number | string }>>) =>
    Number((await query)[0]?.value ?? 0);

  const [
    storeCount,
    activeStores,
    uninstalledStores,
    userCount,
    orderCount,
    ordersLast7,
    ordersPrevious7,
    deliveriesLast7,
    failedFulfillments,
    failedEmails,
    scheduledEmails,
    unprocessedWebhooks,
  ] = await Promise.all([
    one(db.select({ value: count() }).from(stores)),
    one(
      db.select({ value: count() }).from(stores).where(eq(stores.status, "active")),
    ),
    one(
      db
        .select({ value: count() })
        .from(stores)
        .where(eq(stores.status, "uninstalled")),
    ),
    one(db.select({ value: count() }).from(users)),
    one(db.select({ value: count() }).from(orders)),
    one(
      db
        .select({ value: count() })
        .from(orders)
        .where(gte(orders.orderDate, sevenDaysAgo)),
    ),
    one(
      db
        .select({ value: count() })
        .from(orders)
        .where(
          and(
            gte(orders.orderDate, fourteenDaysAgo),
            sql`${orders.orderDate} < ${sevenDaysAgo}`,
          ),
        ),
    ),
    one(
      db
        .select({ value: count() })
        .from(proofOfDelivery)
        .where(gte(proofOfDelivery.deliveredAt, sevenDaysAgo)),
    ),
    one(
      db
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.fulfillmentStatus, "failed")),
    ),
    one(
      db
        .select({ value: count() })
        .from(emailSends)
        .where(eq(emailSends.status, "failed")),
    ),
    one(
      db
        .select({ value: count() })
        .from(emailSends)
        .where(eq(emailSends.status, "scheduled")),
    ),
    one(
      db
        .select({ value: count() })
        .from(sql`webhook_events`)
        .where(sql`error is not null and received_at > ${sevenDaysAgo}`),
    ),
  ]);

  return {
    stores: storeCount,
    activeStores,
    uninstalledStores,
    users: userCount,
    orders: orderCount,
    ordersLast7,
    ordersPrevious7,
    deliveriesLast7,
    failedFulfillments,
    failedEmails,
    scheduledEmails,
    unprocessedWebhooks,
  };
}

// ---------------------------------------------------------------------------
// Per-store overview
// ---------------------------------------------------------------------------

export type PlatformStoreRow = {
  store: Store;
  orders: number;
  ordersLast7: number;
  activeOrders: number;
  stages: number;
  members: number;
  failedFulfillments: number;
  failedEmails: number;
  lastOrderAt: Date | null;
  lastEventAt: Date | null;
  /** Derived health, so the table can be scanned rather than read. */
  health: StoreHealth;
  healthReason: string;
};

export async function getPlatformStores(): Promise<PlatformStoreRow[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);

  const allStores = await db.select().from(stores).orderBy(desc(stores.createdAt));

  // One grouped query per metric rather than a query per store: the panel must
  // stay fast as the number of tenants grows.
  const [
    orderCounts,
    recentCounts,
    activeCounts,
    stageCounts,
    memberCounts,
    fulfillmentFailures,
    emailFailures,
    lastOrders,
    lastEvents,
  ] = await Promise.all([
    db
      .select({ storeId: orders.storeId, value: count() })
      .from(orders)
      .groupBy(orders.storeId),
    db
      .select({ storeId: orders.storeId, value: count() })
      .from(orders)
      .where(gte(orders.orderDate, sevenDaysAgo))
      .groupBy(orders.storeId),
    db
      .select({ storeId: orders.storeId, value: count() })
      .from(orders)
      .where(isNull(orders.cancelledAt))
      .groupBy(orders.storeId),
    db
      .select({ storeId: stages.storeId, value: count() })
      .from(stages)
      .groupBy(stages.storeId),
    db
      .select({ storeId: storeMemberships.storeId, value: count() })
      .from(storeMemberships)
      .where(eq(storeMemberships.status, "active"))
      .groupBy(storeMemberships.storeId),
    db
      .select({ storeId: orders.storeId, value: count() })
      .from(orders)
      .where(eq(orders.fulfillmentStatus, "failed"))
      .groupBy(orders.storeId),
    db
      .select({ storeId: emailSends.storeId, value: count() })
      .from(emailSends)
      .where(eq(emailSends.status, "failed"))
      .groupBy(emailSends.storeId),
    db
      .select({
        storeId: orders.storeId,
        value: sql<Date>`max(${orders.orderDate})`,
      })
      .from(orders)
      .groupBy(orders.storeId),
    db
      .select({
        storeId: orderStageHistory.storeId,
        value: sql<Date>`max(${orderStageHistory.occurredAt})`,
      })
      .from(orderStageHistory)
      .groupBy(orderStageHistory.storeId),
  ]);

  const toMap = <T>(rows: Array<{ storeId: string; value: T }>) =>
    new Map(rows.map((row) => [row.storeId, row.value]));

  const byOrders = toMap(orderCounts);
  const byRecent = toMap(recentCounts);
  const byActive = toMap(activeCounts);
  const byStages = toMap(stageCounts);
  const byMembers = toMap(memberCounts);
  const byFulfillment = toMap(fulfillmentFailures);
  const byEmails = toMap(emailFailures);
  const byLastOrder = toMap(lastOrders);
  const byLastEvent = toMap(lastEvents);

  return allStores.map((store) => {
    const stageCount = Number(byStages.get(store.id) ?? 0);
    const failedFulfillments = Number(byFulfillment.get(store.id) ?? 0);
    const failedEmails = Number(byEmails.get(store.id) ?? 0);

    const { health, healthReason } = assessStoreHealth({
      store,
      stageCount,
      failedFulfillments,
      failedEmails,
    });

    return {
      store,
      orders: Number(byOrders.get(store.id) ?? 0),
      ordersLast7: Number(byRecent.get(store.id) ?? 0),
      activeOrders: Number(byActive.get(store.id) ?? 0),
      stages: stageCount,
      members: Number(byMembers.get(store.id) ?? 0),
      failedFulfillments,
      failedEmails,
      lastOrderAt: (byLastOrder.get(store.id) as Date | undefined) ?? null,
      lastEventAt: (byLastEvent.get(store.id) as Date | undefined) ?? null,
      health,
      healthReason,
    };
  });
}

export type StoreHealth = "healthy" | "attention" | "broken";

export function assessStoreHealth({
  store,
  stageCount,
  failedFulfillments,
  failedEmails,
}: {
  store: Store;
  stageCount: number;
  failedFulfillments: number;
  failedEmails: number;
}): { health: StoreHealth; healthReason: string } {
  // A suspension is a decision, not a fault — it is reported ahead of
  // everything else so an operator is never left wondering why a store looks
  // quiet.
  if (store.suspendedAt) {
    return {
      health: "attention",
      healthReason: store.suspendedReason
        ? `Suspended by an operator — ${store.suspendedReason}`
        : "Suspended by an operator",
    };
  }
  // Credentials were entered but the merchant never finished approving. The
  // row exists only so the OAuth callback can find out which app the shop
  // belongs to, so it is half-finished rather than broken.
  if (store.status === "pending") {
    return {
      health: "attention",
      healthReason: "Install started but never approved in Shopify",
    };
  }
  if (store.status !== "active") {
    return { health: "broken", healthReason: "App uninstalled from Shopify" };
  }
  // No keys of its own and no platform-wide fallback means every webhook and
  // tracking-page request from this store now fails to verify.
  if (!store.apiKey && !env.shopify.fallbackConfigured) {
    return {
      health: "broken",
      healthReason: "No Shopify app keys — webhooks cannot be verified",
    };
  }
  if (stageCount === 0) {
    return {
      health: "broken",
      healthReason: "No tracking stages — orders cannot be imported",
    };
  }
  if (failedFulfillments > 0) {
    return {
      health: "attention",
      healthReason: `${failedFulfillments} fulfillment${failedFulfillments === 1 ? "" : "s"} rejected by Shopify`,
    };
  }
  if (failedEmails > 0) {
    return {
      health: "attention",
      healthReason: `${failedEmails} email${failedEmails === 1 ? "" : "s"} failed to send`,
    };
  }
  return { health: "healthy", healthReason: "No problems detected" };
}

// ---------------------------------------------------------------------------
// Cross-store activity and accounts
// ---------------------------------------------------------------------------

export type PlatformActivity = {
  id: string;
  storeName: string;
  orderNumber: string;
  stageName: string | null;
  source: string;
  occurredAt: Date;
};

export async function getPlatformActivity(
  limit = 15,
): Promise<PlatformActivity[]> {
  const rows = await db
    .select({
      id: orderStageHistory.id,
      storeName: stores.name,
      shopDomain: stores.shopDomain,
      orderNumber: orders.orderNumber,
      stageName: stages.name,
      source: orderStageHistory.source,
      occurredAt: orderStageHistory.occurredAt,
    })
    .from(orderStageHistory)
    .innerJoin(orders, eq(orders.id, orderStageHistory.orderId))
    .innerJoin(stores, eq(stores.id, orderStageHistory.storeId))
    .leftJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .orderBy(desc(orderStageHistory.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    storeName: row.storeName ?? row.shopDomain,
    orderNumber: row.orderNumber,
    stageName: row.stageName,
    source: row.source,
    occurredAt: row.occurredAt,
  }));
}

export type PlatformUserRow = {
  id: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  disabledAt: Date | null;
  storeCount: number;
  hasPassword: boolean;
  createdAt: Date;
};

export async function getPlatformUsers(
  limit = 100,
): Promise<PlatformUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isPlatformAdmin: users.isPlatformAdmin,
      disabledAt: users.disabledAt,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
      storeCount: sql<number>`(
        select count(*) from store_memberships m
        where m.user_id = ${users.id} and m.status = 'active'
      )`,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    isPlatformAdmin: row.isPlatformAdmin,
    disabledAt: row.disabledAt,
    storeCount: Number(row.storeCount ?? 0),
    // The hash itself never leaves the database layer; only whether one exists.
    hasPassword: Boolean(row.passwordHash),
    createdAt: row.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Webhook health
// ---------------------------------------------------------------------------

export type WebhookHealthRow = {
  topic: string;
  received: number;
  failed: number;
  lastReceivedAt: Date | null;
};

export async function getWebhookHealth(
  days = 7,
): Promise<WebhookHealthRow[]> {
  const since = new Date(Date.now() - days * DAY_MS);

  const rows = await db.execute<{
    topic: string;
    received: string;
    failed: string;
    last_received_at: Date | null;
  }>(sql`
    select
      topic,
      count(*)                              as received,
      count(*) filter (where error is not null) as failed,
      max(received_at)                      as last_received_at
    from webhook_events
    where received_at > ${since}
    group by topic
    order by count(*) desc
  `);

  return (rows.rows ?? []).map((row) => ({
    topic: row.topic,
    received: Number(row.received),
    failed: Number(row.failed),
    lastReceivedAt: row.last_received_at ? new Date(row.last_received_at) : null,
  }));
}
