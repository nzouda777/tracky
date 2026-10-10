import { and, asc, eq, inArray, isNull, lte, max, or } from "drizzle-orm";

import {
  autoAdvanceSettings,
  db,
  orderStageHistory,
  orders,
  stores,
  type AutoAdvanceSettings,
  type Order,
} from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { stepDelayHours } from "@/lib/stages/phases";
import { listStages } from "./stages";
import { recordStageTransition } from "./transitions";

/**
 * Auto-advance: time-based stage progression, opt-in per store.
 *
 * This is the one place where time moves an order, and it exists for brands
 * whose own delivery network guarantees a real stage change within a fixed
 * delay. It only runs while the owner has it switched on, and:
 *
 *   - an order moves one stage at a time, once it has sat at its current stage
 *     long enough since its last recorded event — any agency or admin update
 *     restarts that clock. Sub-stages inside one main stage (phase) follow
 *     each other every `subStageDelayHours`; once the last sub-stage of a
 *     phase is reached, the move into the next main stage waits the store's
 *     `delayHours`;
 *   - the move is recorded at the moment it fell due (last event + delay), not
 *     when the job happened to run, so steps keep their exact spacing counting
 *     from the order date and never drift;
 *   - it never goes past `stopAtStageId` (or the final stage when unset), and
 *     never moves a cancelled order;
 *   - every move is recorded with `source = automatic`, so the history always
 *     shows which steps came from a person and which from the timer;
 *   - no proof of delivery is ever created: reaching the delivered stage this
 *     way does not stand in for the agency's declaration.
 */

export const AUTO_ADVANCE_DEFAULT_DELAY_HOURS = 24;
/** Default time between two sub-stages of the same main stage (phase). */
export const SUB_STAGE_DEFAULT_DELAY_HOURS = 24;
export const AUTO_ADVANCE_MIN_DELAY_HOURS = 1;
export const AUTO_ADVANCE_MAX_DELAY_HOURS = 24 * 30;

/** Upper bound per run, so one run always finishes inside the time limit. */
export const AUTO_ADVANCE_BATCH_SIZE = 50;

export type AutoAdvanceResult = {
  stores: number;
  advanced: number;
  failed: number;
};

/** Advances every due order across all stores that have auto-advance on. */
export async function runAutoAdvance(
  now: Date = new Date(),
): Promise<AutoAdvanceResult> {
  const enabled = await db
    .select({ settings: autoAdvanceSettings })
    .from(autoAdvanceSettings)
    .innerJoin(stores, eq(stores.id, autoAdvanceSettings.storeId))
    .where(
      and(
        eq(autoAdvanceSettings.enabled, true),
        eq(stores.status, "active"),
        // A paused store is frozen: nothing aimed at its customers moves.
        isNull(stores.pausedAt),
      ),
    );

  const result: AutoAdvanceResult = {
    stores: enabled.length,
    advanced: 0,
    failed: 0,
  };

  for (const { settings } of enabled) {
    const budget = AUTO_ADVANCE_BATCH_SIZE - result.advanced - result.failed;
    if (budget <= 0) break;

    const outcome = await advanceStore({ settings, now, limit: budget });
    result.advanced += outcome.advanced;
    result.failed += outcome.failed;
  }

  return result;
}

async function advanceStore({
  settings,
  now,
  limit,
}: {
  settings: AutoAdvanceSettings;
  now: Date;
  limit: number;
}): Promise<{ advanced: number; failed: number }> {
  const tdb = new TenantDb(settings.storeId);
  const allStages = await listStages(tdb);
  if (allStages.length < 2) return { advanced: 0, failed: 0 };

  const stopIndex = resolveStopIndex(allStages, settings.stopAtStageId);
  // An order can move on from any stage before the stop stage, and never from
  // a terminal one.
  const movable = allStages
    .slice(0, stopIndex)
    .filter((stage) => !stage.isTerminal);
  if (movable.length === 0) return { advanced: 0, failed: 0 };

  // Group the movable stages by how long an order waits there.
  const delayByStage = new Map<string, number>();
  const groups = new Map<number, string[]>();
  for (const stage of movable) {
    const index = allStages.indexOf(stage);
    const hours = stepDelayHours(stage, allStages[index + 1], settings);
    delayByStage.set(stage.id, hours);
    groups.set(hours, [...(groups.get(hours) ?? []), stage.id]);
  }

  const due = await findDueOrders({
    tdb,
    groups: [...groups].map(([hours, stageIds]) => ({
      stageIds,
      cutoff: new Date(now.getTime() - hours * 3_600_000),
    })),
    limit,
  });

  let advanced = 0;
  let failed = 0;

  for (const { order, lastEventAt } of due) {
    const index = allStages.findIndex((stage) => stage.id === order.currentStageId);
    const next = allStages[index + 1];
    if (index === -1 || !next) continue;

    const from = allStages[index];
    const delayMs = (delayByStage.get(from.id) ?? settings.delayHours) * 3_600_000;

    // Claim the step atomically: the stage only changes if the order is still
    // where we read it, so an overlapping run or an agency update in between
    // means this run leaves it alone and the step is never taken twice.
    const claimed = await tdb.update(
      orders,
      { currentStageId: next.id, updatedAt: new Date() },
      and(eq(orders.id, order.id), eq(orders.currentStageId, from.id)),
    );
    if (claimed.length === 0) continue;

    try {
      await recordStageTransition({
        tdb,
        order,
        stageId: next.id,
        source: "automatic",
        note: null,
        userId: null,
        // When the step fell due, so the next one counts from here too.
        occurredAt: new Date(lastEventAt.getTime() + delayMs),
      });
      advanced += 1;
    } catch (error) {
      // Put the order back so its stage never runs ahead of its history.
      await tdb
        .update(
          orders,
          { currentStageId: from.id },
          and(eq(orders.id, order.id), eq(orders.currentStageId, next.id)),
        )
        .catch(() => undefined);
      failed += 1;
      console.error(
        `[auto-advance] order ${order.orderNumber} could not be advanced`,
        error,
      );
    }
  }

  return { advanced, failed };
}

/** Index of the last stage auto-advance may move into. */
function resolveStopIndex(
  allStages: Array<{ id: string }>,
  stopAtStageId: string | null,
): number {
  const last = allStages.length - 1;
  if (!stopAtStageId) return last;
  const index = allStages.findIndex((stage) => stage.id === stopAtStageId);
  return index === -1 ? last : index;
}

/**
 * Orders sitting at a stage of one of `groups` whose most recent recorded
 * event is older than that group's `cutoff`, oldest first, with that event's
 * time.
 */
async function findDueOrders({
  tdb,
  groups,
  limit,
}: {
  tdb: TenantDb;
  groups: Array<{ stageIds: string[]; cutoff: Date }>;
  limit: number;
}): Promise<Array<{ order: Order; lastEventAt: Date }>> {
  const lastEvent = tdb.raw
    .select({
      orderId: orderStageHistory.orderId,
      at: max(orderStageHistory.occurredAt).as("last_event_at"),
    })
    .from(orderStageHistory)
    .where(tdb.scope(orderStageHistory))
    .groupBy(orderStageHistory.orderId)
    .as("last_event");

  const rows = await tdb.raw
    .select({ order: orders, lastEventAt: lastEvent.at })
    .from(orders)
    .innerJoin(lastEvent, eq(lastEvent.orderId, orders.id))
    .where(
      tdb.scope(
        orders,
        isNull(orders.cancelledAt),
        or(
          ...groups.map((group) =>
            and(
              inArray(orders.currentStageId, group.stageIds),
              lte(lastEvent.at, group.cutoff),
            ),
          ),
        ),
      ),
    )
    .orderBy(asc(lastEvent.at))
    .limit(limit);

  return rows.map((row) => ({
    order: row.order,
    lastEventAt: toDate(row.lastEventAt),
  }));
}

/**
 * An aggregate read through a subquery may arrive as Postgres text
 * ("2026-10-08 12:00:00.123+00") rather than a Date, depending on the driver.
 */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const text = String(value)
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  return new Date(text);
}
