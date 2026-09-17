import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  fulfillmentStatusEnum,
  orderStageHistory,
  orders,
  proofOfDelivery,
  stages,
  users,
  type Order,
  type OrderStageHistory,
  type ProofOfDelivery,
  type Stage,
} from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

export type FulfillmentFilter = (typeof fulfillmentStatusEnum.enumValues)[number];

/**
 * How the list is ordered. An explicit union rather than free-form column
 * names, so a value arriving from the query string can never reach the ORDER
 * BY clause as anything but one of these.
 */
export const ORDER_SORTS = {
  newest: { label: "Newest first", apply: () => desc(orders.orderDate) },
  oldest: { label: "Oldest first", apply: () => asc(orders.orderDate) },
  updated: { label: "Recently updated", apply: () => desc(orders.updatedAt) },
  highest: { label: "Highest value", apply: () => desc(orders.total) },
  lowest: { label: "Lowest value", apply: () => asc(orders.total) },
} as const;

export type OrderSort = keyof typeof ORDER_SORTS;

export function isOrderSort(value: string | undefined): value is OrderSort {
  return Boolean(value && value in ORDER_SORTS);
}

export type OrderListFilters = {
  /** Matches order number, customer name or customer email. */
  search?: string;
  stageId?: string;
  /** Hide orders that have reached a terminal stage. */
  onlyActive?: boolean;
  /** Only orders that have reached a terminal stage. */
  onlyCompleted?: boolean;
  /** Only orders Shopify reports as cancelled. */
  onlyCancelled?: boolean;
  driver?: string;
  /** Orders placed on or after this instant. */
  placedFrom?: Date;
  /** Orders placed on or before this instant. */
  placedTo?: Date;
  fulfillment?: FulfillmentFilter;
  /** true = delivery confirmed by the agency, false = not yet. */
  hasProof?: boolean;
  sort?: OrderSort;
  page?: number;
  perPage?: number;
};

export type OrderListRow = {
  order: Order;
  stage: Stage | null;
  hasProof: boolean;
  lastUpdateAt: Date;
};

/**
 * Builds the WHERE clause shared by the list and the count, so pagination can
 * never disagree with the rows shown. The tenant predicate is added by
 * `tdb.scope`, not here.
 */
function buildFilter(
  filters: OrderListFilters,
  terminalStageIds: string[],
): SQL | undefined {
  const conditions: Array<SQL | undefined> = [];

  if (filters.search?.trim()) {
    const needle = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(orders.orderNumber, needle),
        ilike(orders.customerName, needle),
        ilike(orders.customerEmail, needle),
        ilike(orders.assignedDriverName, needle),
      ),
    );
  }

  if (filters.stageId) {
    conditions.push(eq(orders.currentStageId, filters.stageId));
  }

  if (filters.driver?.trim()) {
    const driver = filters.driver.trim();
    // A sentinel rather than a name, because "no driver yet" is the single
    // most useful thing to filter for on a dispatch screen and an empty value
    // already means "any driver".
    conditions.push(
      driver === UNASSIGNED_DRIVER
        ? or(
            isNull(orders.assignedDriverName),
            eq(orders.assignedDriverName, ""),
          )
        : eq(orders.assignedDriverName, driver),
    );
  }

  // Placed between. Both bounds are inclusive; the caller is responsible for
  // pushing `placedTo` to the end of its day, since it holds the timezone the
  // dates were typed in.
  if (filters.placedFrom) {
    conditions.push(gte(orders.orderDate, filters.placedFrom));
  }
  if (filters.placedTo) {
    conditions.push(lte(orders.orderDate, filters.placedTo));
  }

  if (filters.fulfillment) {
    conditions.push(eq(orders.fulfillmentStatus, filters.fulfillment));
  }

  // Delivery confirmation is a row in another table, so this is an EXISTS
  // rather than a join: the count query and the row query share this clause,
  // and a join in only one of them would let them disagree.
  if (filters.hasProof !== undefined) {
    const proofExists = sql`EXISTS (SELECT 1 FROM ${proofOfDelivery} WHERE ${proofOfDelivery.orderId} = ${orders.id})`;
    conditions.push(
      filters.hasProof ? proofExists : sql`NOT ${proofExists}`,
    );
  }

  // "Active" means not cancelled and not yet in a terminal stage. An order
  // with no stage yet counts as active.
  if (filters.onlyActive) {
    conditions.push(isNull(orders.cancelledAt));
    if (terminalStageIds.length > 0) {
      conditions.push(
        or(
          isNull(orders.currentStageId),
          notInArray(orders.currentStageId, terminalStageIds),
        ),
      );
    }
  }

  if (filters.onlyCompleted && terminalStageIds.length > 0) {
    conditions.push(inArray(orders.currentStageId, terminalStageIds));
  }

  if (filters.onlyCancelled) {
    conditions.push(isNotNull(orders.cancelledAt));
  }

  const present = conditions.filter(Boolean) as SQL[];
  if (present.length === 0) return undefined;
  return and(...present);
}

export async function listOrders(
  tdb: TenantDb,
  filters: OrderListFilters = {},
): Promise<{ rows: OrderListRow[]; total: number; page: number; perPage: number }> {
  const perPage = Math.min(Math.max(filters.perPage ?? 25, 5), 100);
  const page = Math.max(filters.page ?? 1, 1);

  const allStages = await tdb.findMany(stages, { orderBy: asc(stages.position) });
  const terminalStageIds = allStages
    .filter((stage) => stage.isTerminal)
    .map((stage) => stage.id);
  const stageById = new Map(allStages.map((stage) => [stage.id, stage]));

  const where = buildFilter(filters, terminalStageIds);

  const [{ value: total }] = await tdb.raw
    .select({ value: count() })
    .from(orders)
    .where(tdb.scope(orders, where));

  const sortBy = ORDER_SORTS[filters.sort ?? "newest"] ?? ORDER_SORTS.newest;

  const rows = await tdb.raw
    .select({
      order: orders,
      proofId: proofOfDelivery.id,
    })
    .from(orders)
    .leftJoin(proofOfDelivery, eq(proofOfDelivery.orderId, orders.id))
    .where(tdb.scope(orders, where))
    // `orders.id` breaks ties, so paging cannot show the same row twice or
    // skip one when many orders share a timestamp or a total.
    .orderBy(sortBy.apply(), desc(orders.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return {
    rows: rows.map((row) => ({
      order: row.order,
      stage: row.order.currentStageId
        ? (stageById.get(row.order.currentStageId) ?? null)
        : null,
      hasProof: row.proofId !== null,
      lastUpdateAt: row.order.updatedAt,
    })),
    total: Number(total),
    page,
    perPage,
  };
}

export type HistoryEntry = {
  event: OrderStageHistory;
  stage: Stage | null;
  actorName: string | null;
  actorEmail: string | null;
};

export type OrderDetail = {
  order: Order;
  stage: Stage | null;
  allStages: Stage[];
  history: HistoryEntry[];
  proof: ProofOfDelivery | null;
  proofAuthor: { name: string | null; email: string } | null;
};

/** Everything the backoffice and agency order screens need, in one read. */
export async function getOrderDetail(
  tdb: TenantDb,
  orderId: string,
): Promise<OrderDetail | null> {
  const order = await tdb.findById(orders, orderId);
  if (!order) return null;

  const allStages = await tdb.findMany(stages, {
    orderBy: asc(stages.position),
  });
  const stageById = new Map(allStages.map((stage) => [stage.id, stage]));

  const historyRows = await tdb.raw
    .select({ event: orderStageHistory, actor: users })
    .from(orderStageHistory)
    .leftJoin(users, eq(users.id, orderStageHistory.createdByUserId))
    .where(
      tdb.scope(orderStageHistory, eq(orderStageHistory.orderId, orderId)),
    )
    .orderBy(desc(orderStageHistory.occurredAt));

  const proof = await tdb.findFirst(proofOfDelivery, {
    where: eq(proofOfDelivery.orderId, orderId),
  });

  let proofAuthor: OrderDetail["proofAuthor"] = null;
  if (proof?.markedDeliveredByUserId) {
    const [author] = await tdb.raw
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, proof.markedDeliveredByUserId))
      .limit(1);
    proofAuthor = author ?? null;
  }

  return {
    order,
    stage: order.currentStageId
      ? (stageById.get(order.currentStageId) ?? null)
      : null,
    allStages,
    history: historyRows.map((row) => ({
      event: row.event,
      stage: stageById.get(row.event.stageId) ?? null,
      actorName: row.actor?.name ?? null,
      actorEmail: row.actor?.email ?? null,
    })),
    proof: proof ?? null,
    proofAuthor,
  };
}

/** Sentinel for "no driver assigned", distinguishable from "any driver". */
export const UNASSIGNED_DRIVER = "__unassigned__";

/** Distinct driver labels already used in this store, for the assign dropdown. */
export async function listDriverNames(tdb: TenantDb): Promise<string[]> {
  const rows = await tdb.raw
    .selectDistinct({ name: orders.assignedDriverName })
    .from(orders)
    .where(tdb.scope(orders));

  return rows
    .map((row) => row.name)
    .filter((name): name is string => Boolean(name?.trim()))
    .sort((a, b) => a.localeCompare(b));
}

/** Counts per stage for the backoffice overview. */
export async function countOrdersByStage(
  tdb: TenantDb,
): Promise<Array<{ stage: Stage; total: number }>> {
  const allStages = await tdb.findMany(stages, {
    orderBy: asc(stages.position),
  });

  const rows = await tdb.raw
    .select({ stageId: orders.currentStageId, value: count() })
    .from(orders)
    .where(tdb.scope(orders))
    .groupBy(orders.currentStageId);

  const totals = new Map(rows.map((row) => [row.stageId, Number(row.value)]));
  return allStages.map((stage) => ({
    stage,
    total: totals.get(stage.id) ?? 0,
  }));
}
