import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  emailSends,
  emailSequenceSteps,
  emailTemplates,
  orderStageHistory,
  orders,
  proofOfDelivery,
  stages,
  users,
  type Stage,
  type StageEventSource,
} from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

/**
 * Read models for the backoffice dashboard.
 *
 * Everything here is derived from recorded facts — orders mirrored from
 * Shopify and events in `order_stage_history`. Nothing is projected, forecast
 * or interpolated: a dashboard that invents a number is worse than no
 * dashboard, and the whole product rests on only showing what happened.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

async function countWhere(tdb: TenantDb, where?: SQL): Promise<number> {
  const [row] = await tdb.raw
    .select({ value: count() })
    .from(orders)
    .where(tdb.scope(orders, where));
  return Number(row?.value ?? 0);
}

/** `current_stage_id is null OR current_stage_id not in (terminal…)`. */
function notTerminalClause(terminalIds: string[]): SQL | undefined {
  if (terminalIds.length === 0) return undefined;
  return sql`(${orders.currentStageId} is null or ${notInArray(
    orders.currentStageId,
    terminalIds,
  )})` as SQL;
}

// ---------------------------------------------------------------------------
// Headline metrics
// ---------------------------------------------------------------------------

export type DashboardMetrics = {
  totalOrders: number;
  activeOrders: number;
  awaitingConfirmation: number;
  deliveredLast7: number;
  deliveredPrevious7: number;
  unassigned: number;
  fulfilled: number;
  /** Orders whose customer has no email address, so nothing can be sent. */
  withoutEmail: number;
};

export async function getDashboardMetrics(
  tdb: TenantDb,
  allStages: Stage[],
): Promise<DashboardMetrics> {
  const terminalIds = allStages.filter((s) => s.isTerminal).map((s) => s.id);
  const activeClause = and(
    isNull(orders.cancelledAt),
    notTerminalClause(terminalIds),
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS);

  // Deliveries are counted from proof_of_delivery — the record the agency
  // actually created — not from a stage, which an admin could have overridden.
  const deliveredBetween = async (from: Date, to?: Date) => {
    const [row] = await tdb.raw
      .select({ value: count() })
      .from(proofOfDelivery)
      .where(
        tdb.scope(
          proofOfDelivery,
          to
            ? and(
                gte(proofOfDelivery.deliveredAt, from),
                lt(proofOfDelivery.deliveredAt, to),
              )
            : gte(proofOfDelivery.deliveredAt, from),
        ),
      );
    return Number(row?.value ?? 0);
  };

  const [
    totalOrders,
    activeOrders,
    unassigned,
    fulfilled,
    withoutEmail,
    deliveredLast7,
    deliveredPrevious7,
    awaitingConfirmation,
  ] = await Promise.all([
    countWhere(tdb),
    countWhere(tdb, activeClause),
    countWhere(tdb, and(activeClause, isNull(orders.assignedDriverName))),
    countWhere(tdb, eq(orders.fulfillmentStatus, "fulfilled")),
    countWhere(
      tdb,
      and(isNull(orders.customerEmail), isNull(orders.cancelledAt)),
    ),
    deliveredBetween(sevenDaysAgo),
    deliveredBetween(fourteenDaysAgo, sevenDaysAgo),
    countActiveWithoutProof(tdb, activeClause),
  ]);

  return {
    totalOrders,
    activeOrders,
    awaitingConfirmation,
    deliveredLast7,
    deliveredPrevious7,
    unassigned,
    fulfilled,
    withoutEmail,
  };
}

/** Active orders the agency has not yet confirmed as delivered. */
async function countActiveWithoutProof(
  tdb: TenantDb,
  activeClause: SQL | undefined,
): Promise<number> {
  const [row] = await tdb.raw
    .select({ value: count() })
    .from(orders)
    .leftJoin(proofOfDelivery, eq(proofOfDelivery.orderId, orders.id))
    .where(tdb.scope(orders, and(isNull(proofOfDelivery.id), activeClause)));
  return Number(row?.value ?? 0);
}

// ---------------------------------------------------------------------------
// Stage distribution — the delivery pipeline
// ---------------------------------------------------------------------------

export type StageBucket = { stage: Stage; total: number; share: number };

/**
 * How many orders sit in each stage, in pipeline order.
 *
 * A single series (a count) across an ordered set of categories, so it is
 * plotted as one-hue horizontal bars. `share` is relative to the busiest
 * stage, which is what makes bar lengths comparable.
 */
export async function getStageDistribution(
  tdb: TenantDb,
  allStages: Stage[],
): Promise<{ buckets: StageBucket[]; noStage: number }> {
  const rows = await tdb.raw
    .select({ stageId: orders.currentStageId, value: count() })
    .from(orders)
    .where(tdb.scope(orders, isNull(orders.cancelledAt)))
    .groupBy(orders.currentStageId);

  const totals = new Map(rows.map((r) => [r.stageId, Number(r.value)]));
  const peak = Math.max(1, ...allStages.map((s) => totals.get(s.id) ?? 0));

  return {
    buckets: allStages.map((stage) => {
      const total = totals.get(stage.id) ?? 0;
      return { stage, total, share: total / peak };
    }),
    noStage: totals.get(null) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Daily order volume — the stat-tile sparkline
// ---------------------------------------------------------------------------

export type DailyPoint = { date: Date; total: number };

/** Orders per day over the trailing `days`, zero-filled so gaps stay visible. */
export async function getDailyOrderVolume(
  tdb: TenantDb,
  days = 14,
): Promise<DailyPoint[]> {
  const from = startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));

  const rows = await tdb.raw
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.orderDate}), 'YYYY-MM-DD')`,
      value: count(),
    })
    .from(orders)
    .where(tdb.scope(orders, gte(orders.orderDate, from)))
    .groupBy(sql`date_trunc('day', ${orders.orderDate})`);

  const totals = new Map(rows.map((r) => [r.day, Number(r.value)]));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from.getTime() + index * DAY_MS);
    return { date, total: totals.get(date.toISOString().slice(0, 10)) ?? 0 };
  });
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------

export type Severity = "critical" | "serious" | "warning" | "info";

export type AttentionItem = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  count?: number;
  href?: string;
  linkLabel?: string;
};

const STALE_AFTER_DAYS = 3;

/**
 * The list the owner should act on, worst first.
 *
 * Configuration problems come first because they silently stop the whole
 * pipeline; per-order problems follow. An empty list is a meaningful result,
 * not a gap — the panel says so in words.
 */
export async function getAttentionItems(
  tdb: TenantDb,
  allStages: Stage[],
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const terminalIds = allStages.filter((s) => s.isTerminal).map((s) => s.id);

  const [
    failedFulfillment,
    deliveredNotFulfilled,
    failedEmails,
    staleOrders,
    activeTemplates,
    activeSteps,
  ] = await Promise.all([
    countWhere(tdb, eq(orders.fulfillmentStatus, "failed")),
    countDeliveredNotFulfilled(tdb),
    countFailedEmails(tdb),
    countStaleOrders(tdb, terminalIds),
    countActiveTemplates(tdb),
    countActiveSequenceSteps(tdb),
  ]);

  // --- Configuration ------------------------------------------------------

  if (allStages.length === 0) {
    items.push({
      id: "no-stages",
      severity: "critical",
      title: "No tracking stages",
      detail:
        "Orders cannot be imported from Shopify until this store has at least one stage.",
      href: "/admin/stages",
      linkLabel: "Set up stages",
    });
  } else if (!allStages.some((s) => s.triggersFulfillment)) {
    items.push({
      id: "no-fulfillment-stage",
      severity: "critical",
      title: "No stage triggers fulfillment",
      detail:
        "Orders will never be marked fulfilled in Shopify. Mark the stage that means delivered.",
      href: "/admin/stages",
      linkLabel: "Edit stages",
    });
  }

  if (activeTemplates === 0) {
    items.push({
      id: "no-templates",
      severity: "warning",
      title: "No active email templates",
      detail: "Customers will not receive any updates about their order.",
      href: "/admin/emails/templates",
      linkLabel: "Create a template",
    });
  } else if (activeSteps === 0) {
    items.push({
      id: "no-sequence",
      severity: "warning",
      title: "No active email sequence",
      detail:
        "Templates exist but nothing is scheduled to send them. Attach one to a stage.",
      href: "/admin/emails/sequence",
      linkLabel: "Build the sequence",
    });
  }

  // --- Orders -------------------------------------------------------------

  if (failedFulfillment > 0) {
    items.push({
      id: "failed-fulfillment",
      severity: "critical",
      title: "Fulfillment failed in Shopify",
      detail:
        "Shopify rejected these fulfillments. Open an order to see the reason and retry.",
      count: failedFulfillment,
      href: "/admin/orders?fulfillment=failed",
      linkLabel: "Review orders",
    });
  }

  if (deliveredNotFulfilled > 0) {
    items.push({
      id: "delivered-not-fulfilled",
      severity: "serious",
      title: "Delivered but not fulfilled",
      detail:
        "The agency confirmed delivery, but Shopify was never told. Check your fulfillment rules.",
      count: deliveredNotFulfilled,
      href: "/admin/settings/fulfillment",
      linkLabel: "Fulfillment rules",
    });
  }

  if (failedEmails > 0) {
    items.push({
      id: "failed-emails",
      severity: "warning",
      title: "Emails failed to send",
      detail:
        "Each order's email log shows the provider's reason and a resend button.",
      count: failedEmails,
      href: "/admin/orders",
      linkLabel: "Open orders",
    });
  }

  if (staleOrders > 0) {
    items.push({
      id: "stale-orders",
      severity: "warning",
      title: `No update for over ${STALE_AFTER_DAYS} days`,
      detail:
        "These orders are still in progress but nobody has recorded an event recently.",
      count: staleOrders,
      href: "/admin/orders?status=active",
      linkLabel: "Review orders",
    });
  }

  return items;
}

async function countDeliveredNotFulfilled(tdb: TenantDb): Promise<number> {
  const [row] = await tdb.raw
    .select({ value: count() })
    .from(proofOfDelivery)
    .innerJoin(orders, eq(orders.id, proofOfDelivery.orderId))
    .where(
      tdb.scope(
        proofOfDelivery,
        and(
          isNull(orders.shopifyFulfillmentId),
          notInArray(orders.fulfillmentStatus, ["fulfilled"]),
        ),
      ),
    );
  return Number(row?.value ?? 0);
}

async function countFailedEmails(tdb: TenantDb): Promise<number> {
  const [row] = await tdb.raw
    .select({ value: count() })
    .from(emailSends)
    .where(tdb.scope(emailSends, eq(emailSends.status, "failed")));
  return Number(row?.value ?? 0);
}

async function countActiveTemplates(tdb: TenantDb): Promise<number> {
  const [row] = await tdb.raw
    .select({ value: count() })
    .from(emailTemplates)
    .where(tdb.scope(emailTemplates, eq(emailTemplates.isActive, true)));
  return Number(row?.value ?? 0);
}

async function countActiveSequenceSteps(tdb: TenantDb): Promise<number> {
  const [row] = await tdb.raw
    .select({ value: count() })
    .from(emailSequenceSteps)
    .where(tdb.scope(emailSequenceSteps, eq(emailSequenceSteps.isActive, true)));
  return Number(row?.value ?? 0);
}

/**
 * In-progress orders with no recorded event for a while.
 *
 * Because progress is event-driven, silence is the only signal that something
 * has been forgotten — no timer would have moved it along in the meantime.
 */
async function countStaleOrders(
  tdb: TenantDb,
  terminalIds: string[],
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * DAY_MS);

  const lastEvent = tdb.raw
    .select({
      orderId: orderStageHistory.orderId,
      lastAt: sql<Date>`max(${orderStageHistory.occurredAt})`.as("last_at"),
    })
    .from(orderStageHistory)
    .where(tdb.scope(orderStageHistory))
    .groupBy(orderStageHistory.orderId)
    .as("last_event");

  const [row] = await tdb.raw
    .select({ value: count() })
    .from(orders)
    .leftJoin(lastEvent, eq(lastEvent.orderId, orders.id))
    .where(
      tdb.scope(
        orders,
        and(
          isNull(orders.cancelledAt),
          notTerminalClause(terminalIds),
          sql`coalesce(${lastEvent.lastAt}, ${orders.createdAt}) < ${cutoff}`,
        ),
      ),
    );
  return Number(row?.value ?? 0);
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export type ActivityEntry = {
  id: string;
  orderId: string;
  orderNumber: string;
  stageName: string | null;
  stageColor: string | null;
  source: StageEventSource;
  actor: string | null;
  note: string | null;
  occurredAt: Date;
};

/**
 * The most recent real events across the store, newest first.
 *
 * This is `order_stage_history` verbatim — the same rows that build a
 * customer's timeline — so the dashboard and the customer can never disagree.
 */
export async function getRecentActivity(
  tdb: TenantDb,
  limit = 12,
): Promise<ActivityEntry[]> {
  const rows = await tdb.raw
    .select({
      id: orderStageHistory.id,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      stageName: stages.name,
      stageColor: stages.color,
      source: orderStageHistory.source,
      note: orderStageHistory.note,
      occurredAt: orderStageHistory.occurredAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(orderStageHistory)
    .innerJoin(orders, eq(orders.id, orderStageHistory.orderId))
    .leftJoin(stages, eq(stages.id, orderStageHistory.stageId))
    .leftJoin(users, eq(users.id, orderStageHistory.createdByUserId))
    .where(tdb.scope(orderStageHistory))
    .orderBy(desc(orderStageHistory.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    stageName: row.stageName,
    stageColor: row.stageColor,
    source: row.source,
    actor: row.actorName ?? row.actorEmail ?? null,
    note: row.note,
    occurredAt: row.occurredAt,
  }));
}

// ---------------------------------------------------------------------------
// Driver workload — what an owner overseeing the agency wants to see
// ---------------------------------------------------------------------------

export type DriverLoad = { driver: string; active: number };

export async function getDriverWorkload(
  tdb: TenantDb,
  allStages: Stage[],
): Promise<DriverLoad[]> {
  const terminalIds = allStages.filter((s) => s.isTerminal).map((s) => s.id);

  const rows = await tdb.raw
    .select({ driver: orders.assignedDriverName, value: count() })
    .from(orders)
    .where(
      tdb.scope(
        orders,
        and(
          isNotNull(orders.assignedDriverName),
          isNull(orders.cancelledAt),
          notTerminalClause(terminalIds),
        ),
      ),
    )
    .groupBy(orders.assignedDriverName)
    .orderBy(desc(count()))
    .limit(6);

  return rows
    .filter((row): row is { driver: string; value: number } => Boolean(row.driver))
    .map((row) => ({ driver: row.driver, active: Number(row.value) }));
}

/** Stage list in pipeline order — every dashboard read needs it. */
export function getOrderedStages(tdb: TenantDb): Promise<Stage[]> {
  return tdb.findMany(stages, { orderBy: asc(stages.position) });
}
