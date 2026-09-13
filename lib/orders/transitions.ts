import { eq } from "drizzle-orm";

import {
  orderStageHistory,
  orders,
  proofOfDelivery,
  type Order,
  type OrderStageHistory,
  type Stage,
  type StageEventSource,
} from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";
import { attemptFulfillment } from "@/lib/fulfillment";
import { scheduleStageEmails } from "@/lib/email/scheduler";
import { getStageById } from "./stages";

/**
 * The single writer for order progress.
 *
 * Two rules are enforced here rather than trusted to call sites:
 *
 *  1. **Only real events move an order.** `source` is one of
 *     `shopify_webhook` | `agency` | `admin`; there is no timer source, and no
 *     scheduler anywhere in this codebase calls this function. Delays exist
 *     solely to schedule email (see lib/email/scheduler.ts).
 *  2. **Every transition is recorded before it is reflected.** The row in
 *     `order_stage_history` is written first and is what the public timeline
 *     reads, so the customer only ever sees events that actually happened.
 */
export type StageTransitionInput = {
  tdb: TenantDb;
  order: Order;
  stageId: string;
  source: StageEventSource;
  /** Message shown to the customer alongside this event. */
  note?: string | null;
  /** The authenticated human behind the event; null for Shopify webhooks. */
  userId?: string | null;
  /** Defaults to now. Set when backfilling a known real timestamp. */
  occurredAt?: Date;
};

export type StageTransitionResult = {
  order: Order;
  stage: Stage;
  event: OrderStageHistory;
  /** Null when the stage does not trigger fulfillment, or it was skipped. */
  fulfillment: Awaited<ReturnType<typeof attemptFulfillment>> | null;
  emailsScheduled: number;
};

export class StageTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StageTransitionError";
  }
}

export async function recordStageTransition({
  tdb,
  order,
  stageId,
  source,
  note = null,
  userId = null,
  occurredAt = new Date(),
}: StageTransitionInput): Promise<StageTransitionResult> {
  // The stage is looked up through the tenant client, so a stage id belonging
  // to another store simply does not resolve.
  const stage = await getStageById(tdb, stageId);
  if (!stage) {
    throw new StageTransitionError(
      "That stage does not exist in this store.",
    );
  }

  const event = await tdb.insertOne(orderStageHistory, {
    orderId: order.id,
    stageId: stage.id,
    occurredAt,
    note: note?.trim() ? note.trim() : null,
    createdByUserId: userId,
    source,
  });

  const [updated] = await tdb.update(
    orders,
    { currentStageId: stage.id, updatedAt: new Date() },
    eq(orders.id, order.id),
  );
  const nextOrder = updated ?? order;

  // Email scheduling and fulfillment are consequences of a real event; if
  // either fails the transition itself still stands, and the failure is
  // reported on the order rather than swallowed.
  const emailsScheduled = await scheduleStageEmails({
    tdb,
    order: nextOrder,
    stage,
  }).catch((error) => {
    console.error("[transitions] failed to schedule stage emails", error);
    return 0;
  });

  const fulfillment = stage.triggersFulfillment
    ? await attemptFulfillment({ tdb, order: nextOrder, stage })
    : null;

  // attemptFulfillment may have written fulfillment fields; re-read so callers
  // see the final state.
  const finalOrder = fulfillment
    ? ((await tdb.findById(orders, order.id)) ?? nextOrder)
    : nextOrder;

  return { order: finalOrder, stage, event, fulfillment, emailsScheduled };
}

/**
 * Places a newly imported order into the store's first stage.
 *
 * This is itself an event: it is triggered by the `orders/create` webhook, and
 * is recorded with `source = shopify_webhook`.
 */
export async function placeOrderInFirstStage({
  tdb,
  order,
  firstStage,
  note,
}: {
  tdb: TenantDb;
  order: Order;
  firstStage: Stage;
  note?: string | null;
}): Promise<StageTransitionResult> {
  return recordStageTransition({
    tdb,
    order,
    stageId: firstStage.id,
    source: "shopify_webhook",
    note: note ?? null,
    userId: null,
    // Use the real Shopify order timestamp, not the moment we processed it.
    occurredAt: order.orderDate,
  });
}

/** Full event feed for an order, newest first. */
export async function listOrderHistory(
  tdb: TenantDb,
  orderId: string,
): Promise<Array<OrderStageHistory>> {
  const rows = await tdb.findMany(orderStageHistory, {
    where: eq(orderStageHistory.orderId, orderId),
  });
  return rows.sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );
}

/** The most recent real event, used for the "last update" block. */
export async function latestOrderEvent(
  tdb: TenantDb,
  orderId: string,
): Promise<OrderStageHistory | null> {
  const history = await listOrderHistory(tdb, orderId);
  return history[0] ?? null;
}

export function getProofOfDelivery(tdb: TenantDb, orderId: string) {
  return tdb.findFirst(proofOfDelivery, {
    where: eq(proofOfDelivery.orderId, orderId),
  });
}
