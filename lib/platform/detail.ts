import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import {
  db,
  emailSends,
  emailTemplates,
  orderStageHistory,
  orders,
  proofOfDelivery,
  stages,
  storeMemberships,
  stores,
  users,
  type Store,
} from "@/lib/db";
import { assessStoreHealth, type StoreHealth } from "./queries";

/**
 * Drill-down read models for the platform panel.
 *
 * Like `queries.ts`, this crosses tenant boundaries on purpose and is only
 * ever reachable behind `requirePlatformAdmin()`. Also like `queries.ts`, it
 * is strictly read-only — every write lives in `lib/actions/platform.ts`,
 * where it is audited.
 *
 * These return counts, health and membership lists. They never return an
 * order's contents, a customer's address, or a proof-of-delivery photo: an
 * operator needs to know a store is healthy, not to read its customers' data.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const one = async (
  query: Promise<Array<{ value: number | string }>>,
): Promise<number> => Number((await query)[0]?.value ?? 0);

// ---------------------------------------------------------------------------
// Platform-wide volume
// ---------------------------------------------------------------------------

export type PlatformDailyPoint = { date: Date; total: number };

/** Orders per day across every store, zero-filled so quiet days stay visible. */
export async function getPlatformDailyVolume(
  days = 14,
): Promise<PlatformDailyPoint[]> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setTime(from.getTime() - (days - 1) * DAY_MS);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.orderDate}), 'YYYY-MM-DD')`,
      value: count(),
    })
    .from(orders)
    .where(gte(orders.orderDate, from))
    .groupBy(sql`date_trunc('day', ${orders.orderDate})`);

  const totals = new Map(rows.map((row) => [row.day, Number(row.value)]));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from.getTime() + index * DAY_MS);
    return { date, total: totals.get(date.toISOString().slice(0, 10)) ?? 0 };
  });
}

export type BusiestStore = { store: Store; orders: number; share: number };

/** Busiest stores over the trailing week, for the leaderboard widget. */
export async function getBusiestStores(limit = 5): Promise<BusiestStore[]> {
  const since = new Date(Date.now() - 7 * DAY_MS);

  const rows = await db
    .select({ store: stores, value: count(orders.id) })
    .from(stores)
    .leftJoin(
      orders,
      and(eq(orders.storeId, stores.id), gte(orders.orderDate, since)),
    )
    .groupBy(stores.id)
    .orderBy(desc(count(orders.id)))
    .limit(limit);

  const peak = Math.max(1, ...rows.map((row) => Number(row.value)));

  return rows.map((row) => ({
    store: row.store,
    orders: Number(row.value),
    share: Number(row.value) / peak,
  }));
}

// ---------------------------------------------------------------------------
// One store
// ---------------------------------------------------------------------------

export type StoreMemberRow = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: "owner" | "agency";
  status: string;
  isPlatformAdmin: boolean;
  disabledAt: Date | null;
};

export type PlatformStoreDetail = {
  store: Store;
  metrics: {
    orders: number;
    ordersLast7: number;
    activeOrders: number;
    delivered: number;
    failedFulfillments: number;
    failedEmails: number;
    scheduledEmails: number;
    stages: number;
    templates: number;
  };
  members: StoreMemberRow[];
  lastOrderAt: Date | null;
  lastEventAt: Date | null;
  health: StoreHealth;
  healthReason: string;
};

export async function getPlatformStoreDetail(
  storeId: string,
): Promise<PlatformStoreDetail | null> {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) return null;

  const since = new Date(Date.now() - 7 * DAY_MS);

  const [
    orderCount,
    ordersLast7,
    activeOrders,
    delivered,
    failedFulfillments,
    failedEmails,
    scheduledEmails,
    stageCount,
    templateCount,
    members,
    lastOrder,
    lastEvent,
  ] = await Promise.all([
    one(db.select({ value: count() }).from(orders).where(eq(orders.storeId, storeId))),
    one(
      db
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), gte(orders.orderDate, since))),
    ),
    one(
      db
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), isNull(orders.cancelledAt))),
    ),
    one(
      db
        .select({ value: count() })
        .from(proofOfDelivery)
        .where(eq(proofOfDelivery.storeId, storeId)),
    ),
    one(
      db
        .select({ value: count() })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, storeId),
            eq(orders.fulfillmentStatus, "failed"),
          ),
        ),
    ),
    one(
      db
        .select({ value: count() })
        .from(emailSends)
        .where(
          and(eq(emailSends.storeId, storeId), eq(emailSends.status, "failed")),
        ),
    ),
    one(
      db
        .select({ value: count() })
        .from(emailSends)
        .where(
          and(
            eq(emailSends.storeId, storeId),
            eq(emailSends.status, "scheduled"),
          ),
        ),
    ),
    one(
      db.select({ value: count() }).from(stages).where(eq(stages.storeId, storeId)),
    ),
    one(
      db
        .select({ value: count() })
        .from(emailTemplates)
        .where(eq(emailTemplates.storeId, storeId)),
    ),
    db
      .select({
        membershipId: storeMemberships.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: storeMemberships.role,
        status: storeMemberships.status,
        isPlatformAdmin: users.isPlatformAdmin,
        disabledAt: users.disabledAt,
      })
      .from(storeMemberships)
      .innerJoin(users, eq(users.id, storeMemberships.userId))
      .where(eq(storeMemberships.storeId, storeId)),
    db
      .select({ value: orders.orderDate })
      .from(orders)
      .where(eq(orders.storeId, storeId))
      .orderBy(desc(orders.orderDate))
      .limit(1),
    db
      .select({ value: orderStageHistory.occurredAt })
      .from(orderStageHistory)
      .where(eq(orderStageHistory.storeId, storeId))
      .orderBy(desc(orderStageHistory.occurredAt))
      .limit(1),
  ]);

  const { health, healthReason } = assessStoreHealth({
    store,
    stageCount,
    failedFulfillments,
    failedEmails,
  });

  return {
    store,
    metrics: {
      orders: orderCount,
      ordersLast7,
      activeOrders,
      delivered,
      failedFulfillments,
      failedEmails,
      scheduledEmails,
      stages: stageCount,
      templates: templateCount,
    },
    members,
    lastOrderAt: lastOrder[0]?.value ?? null,
    lastEventAt: lastEvent[0]?.value ?? null,
    health,
    healthReason,
  };
}

// ---------------------------------------------------------------------------
// One account
// ---------------------------------------------------------------------------

export type PlatformUserDetail = {
  user: {
    id: string;
    email: string;
    name: string | null;
    isPlatformAdmin: boolean;
    disabledAt: Date | null;
    disabledReason: string | null;
    hasPassword: boolean;
    createdAt: Date;
  };
  memberships: Array<{
    membershipId: string;
    storeId: string;
    shopDomain: string;
    storeName: string | null;
    role: "owner" | "agency";
    status: string;
  }>;
};

export async function getPlatformUserDetail(
  userId: string,
): Promise<PlatformUserDetail | null> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return null;

  const memberships = await db
    .select({
      membershipId: storeMemberships.id,
      storeId: stores.id,
      shopDomain: stores.shopDomain,
      storeName: stores.name,
      role: storeMemberships.role,
      status: storeMemberships.status,
    })
    .from(storeMemberships)
    .innerJoin(stores, eq(stores.id, storeMemberships.storeId))
    .where(eq(storeMemberships.userId, userId));

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      isPlatformAdmin: row.isPlatformAdmin,
      disabledAt: row.disabledAt,
      disabledReason: row.disabledReason,
      // Only whether one exists; the hash never leaves the database layer.
      hasPassword: Boolean(row.passwordHash),
      createdAt: row.createdAt,
    },
    memberships,
  };
}
