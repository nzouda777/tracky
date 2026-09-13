import { desc, eq } from "drizzle-orm";

import { randomToken } from "@/lib/crypto/secrets";
import { orders, type Order, type Store } from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { scheduleOrderSequence } from "@/lib/email/scheduler";
import { getFirstStage } from "@/lib/orders/stages";
import { recordStageTransition } from "@/lib/orders/transitions";
import { ShopifyAdminClient } from "./admin-api";
import { mapOrderPayload, type ShopifyOrderPayload } from "./orders";

/**
 * Manual order sync — the backfill for everything webhooks did not deliver.
 *
 * Webhooks remain the primary path: they are instant and they are what the
 * product is built around. This exists because they are not guaranteed:
 *
 *   - orders placed **before** the app was installed are never sent at all;
 *   - a webhook can be missed during an outage, a bad deploy, or a period when
 *     the endpoint was returning errors — Shopify retries for 48 hours, then
 *     gives up for good;
 *   - a store can be reconnected after a spell of being uninstalled.
 *
 * What it deliberately does NOT do is re-run delivery progress. An order that
 * already exists has its mirrored fields refreshed and nothing else: its stage,
 * its history and its proof of delivery are owned by the agency and by real
 * events, and a sync must never overwrite them.
 *
 * New orders are placed in the first stage and recorded with
 * `source = shopify_sync`, so the timeline stays honest about how the app
 * learned of the order.
 */

export type SyncOptions = {
  /** How far back to look. Shopify caps unscoped reads at 60 days. */
  sinceDays?: number;
  /** Hard cap on orders pulled in one run, to stay inside a request budget. */
  maxOrders?: number;
  /** The admin who pressed the button; recorded on the import event. */
  userId?: string | null;
};

export type SyncResult = {
  examined: number;
  imported: number;
  updated: number;
  skipped: number;
  emailsScheduled: number;
  /** Per-order problems that did not stop the run. */
  problems: string[];
  /** True when Shopify had more pages than `maxOrders` allowed. */
  truncated: boolean;
};

const PAGE_SIZE = 50;
const DEFAULT_MAX = 250;
const DEFAULT_SINCE_DAYS = 60;

export async function syncOrdersFromShopify({
  store,
  options = {},
}: {
  store: Store;
  options?: SyncOptions;
}): Promise<SyncResult> {
  const result: SyncResult = {
    examined: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    emailsScheduled: 0,
    problems: [],
    truncated: false,
  };

  if (store.status !== "active" || !store.accessToken) {
    result.problems.push("This store is not connected to Shopify.");
    return result;
  }

  const tdb = new TenantDb(store.id);
  const firstStage = await getFirstStage(tdb);
  if (!firstStage) {
    result.problems.push(
      "This store has no tracking stages, so orders cannot be placed. Set up stages first.",
    );
    return result;
  }

  const client = ShopifyAdminClient.forStore(store);
  const maxOrders = Math.min(options.maxOrders ?? DEFAULT_MAX, 1000);
  const sinceDays = options.sinceDays ?? DEFAULT_SINCE_DAYS;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  let pageInfo: string | null = null;

  while (result.examined < maxOrders) {
    const limit = Math.min(PAGE_SIZE, maxOrders - result.examined);

    // The REST orders endpoint is used rather than GraphQL because it exposes
    // exactly the payload shape the webhook handler already maps, so imported
    // and webhook-delivered orders cannot end up subtly different.
    //
    // Shopify rejects a paged request that also carries filters, so once we
    // hold a cursor it is the only parameter besides `limit`.
    const query = pageInfo
      ? `?limit=${limit}&page_info=${encodeURIComponent(pageInfo)}`
      : `?limit=${limit}&status=any&created_at_min=${encodeURIComponent(since.toISOString())}`;

    let page: { data: { orders?: ShopifyOrderPayload[] }; nextPageInfo: string | null };
    try {
      page = await client.restWithPaging<{ orders?: ShopifyOrderPayload[] }>(
        "GET",
        `/orders.json${query}`,
      );
    } catch (error) {
      result.problems.push(
        `Shopify request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      break;
    }

    const batch = page.data.orders ?? [];
    if (batch.length === 0) break;

    for (const payload of batch) {
      result.examined += 1;
      try {
        const outcome = await importOne({
          tdb,
          store,
          payload,
          firstStageId: firstStage.id,
          userId: options.userId ?? null,
        });

        if (outcome.kind === "imported") {
          result.imported += 1;
          result.emailsScheduled += outcome.emailsScheduled;
        } else if (outcome.kind === "updated") {
          result.updated += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.skipped += 1;
        result.problems.push(
          `Order ${payload.name ?? payload.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Follow Shopify's cursor. No next link means we reached the end.
    pageInfo = page.nextPageInfo;
    if (!pageInfo) break;

    // More pages exist but the budget is spent — say so rather than letting
    // the caller believe the store is fully synced.
    if (result.examined >= maxOrders) {
      result.truncated = true;
      break;
    }
  }

  return result;
}

type ImportOutcome =
  | { kind: "imported"; emailsScheduled: number }
  | { kind: "updated" }
  | { kind: "skipped" };

async function importOne({
  tdb,
  store,
  payload,
  firstStageId,
  userId,
}: {
  tdb: TenantDb;
  store: Store;
  payload: ShopifyOrderPayload;
  firstStageId: string;
  userId: string | null;
}): Promise<ImportOutcome> {
  const fields = mapOrderPayload(payload, store.currency);

  const existing: Order | null = await tdb.findFirst(orders, {
    where: eq(orders.shopifyOrderId, fields.shopifyOrderId),
  });

  if (existing) {
    // Refresh only what Shopify owns. Stage, history, driver, proof of
    // delivery and fulfillment state belong to this app and to the agency.
    await tdb.updateById(orders, existing.id, {
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
    });
    return { kind: "updated" };
  }

  const order = await tdb.insertOne(orders, {
    ...fields,
    trackingToken: randomToken(18),
    fulfillmentStatus: "unfulfilled",
  });

  await recordStageTransition({
    tdb,
    order,
    stageId: firstStageId,
    source: "shopify_sync",
    note: null,
    userId,
    // The real Shopify order date, not the moment we happened to import it.
    occurredAt: order.orderDate,
  });

  const emailsScheduled = await scheduleOrderSequence({ tdb, order });

  return { kind: "imported", emailsScheduled };
}

/** The most recent order we hold, shown next to the sync button as context. */
export async function getLastSyncedOrderDate(
  tdb: TenantDb,
): Promise<Date | null> {
  const [row] = await tdb.raw
    .select({ orderDate: orders.orderDate })
    .from(orders)
    .where(tdb.scope(orders))
    .orderBy(desc(orders.orderDate))
    .limit(1);
  return row?.orderDate ?? null;
}
