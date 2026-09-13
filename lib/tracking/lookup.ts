import { and, asc, desc, eq, or, sql } from "drizzle-orm";

import {
  brandingSettings,
  orderStageHistory,
  orders,
  proofOfDelivery,
  stages,
  type BrandingSettings,
  type Order,
  type OrderStageHistory,
  type ProofOfDelivery,
  type Stage,
} from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { buildTimeline, isAddressEditable, type TimelineEntry } from "@/lib/orders/stages";
import { classifyLookup, type LookupStep } from "@/components/tracking/lookup-form";

export type PublicOrderView = {
  order: Order;
  stage: Stage | null;
  timeline: TimelineEntry[];
  /** Every recorded event, newest first — what the customer is shown. */
  events: Array<{ event: OrderStageHistory; stage: Stage | null }>;
  lastUpdate: { event: OrderStageHistory; stage: Stage | null } | null;
  proof: ProofOfDelivery | null;
  canEditAddress: boolean;
};

/**
 * Looks an order up for the public tracking page.
 *
 * Two ways in, both deliberately narrow:
 *   - `token`: the opaque per-order token used in emails;
 *   - `orderNumber` + `email`: both must match, so an order number alone is
 *     never enough to read someone else's order.
 */
export async function findPublicOrder({
  tdb,
  token,
  orderNumber,
  email,
}: {
  tdb: TenantDb;
  token?: string | null;
  orderNumber?: string | null;
  email?: string | null;
}): Promise<Order | null> {
  if (token?.trim()) {
    return tdb.findFirst(orders, {
      where: eq(orders.trackingToken, token.trim()),
    });
  }

  const number = orderNumber?.trim();
  const mail = email?.trim().toLowerCase();
  if (!number || !mail) return null;

  // Customers type "1042", "#1042" or "1042 " — all should work.
  const normalized = number.replace(/^#/, "");

  return tdb.findFirst(orders, {
    where: and(
      eq(sql`lower(${orders.customerEmail})`, mail),
      or(
        eq(orders.orderNumber, number),
        eq(orders.orderNumber, `#${normalized}`),
        eq(orders.orderNumber, normalized),
      ),
    ),
  });
}

/** Assembles everything the public page renders for one order. */
export async function buildPublicOrderView({
  tdb,
  order,
  branding,
}: {
  tdb: TenantDb;
  order: Order;
  branding: BrandingSettings | null;
}): Promise<PublicOrderView> {
  // Three independent reads. They used to run one after another, which on a
  // serverless Postgres driver means three sequential network round trips in
  // the customer's critical path for no reason — nothing here depends on
  // anything else.
  const [allStages, history, proof] = await Promise.all([
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
    tdb.findMany(orderStageHistory, {
      where: eq(orderStageHistory.orderId, order.id),
      orderBy: desc(orderStageHistory.occurredAt),
    }),
    tdb.findFirst(proofOfDelivery, {
      where: eq(proofOfDelivery.orderId, order.id),
    }),
  ]);

  const stageById = new Map(allStages.map((stage) => [stage.id, stage]));

  // Ordering is done by Postgres above rather than in JS, so a long history
  // does not get sorted twice.
  const events = history.map((event) => ({
    event,
    stage: stageById.get(event.stageId) ?? null,
  }));

  return {
    order,
    stage: order.currentStageId
      ? (stageById.get(order.currentStageId) ?? null)
      : null,
    timeline: buildTimeline(allStages, order.currentStageId),
    events,
    lastUpdate: events[0] ?? null,
    proof: proof ?? null,
    canEditAddress:
      !order.cancelledAt &&
      isAddressEditable({
        allStages,
        currentStageId: order.currentStageId,
        allowedByBranding: branding?.showAddressEditing ?? true,
      }),
  };
}

export async function getBranding(
  tdb: TenantDb,
): Promise<BrandingSettings | null> {
  return tdb.findFirst(brandingSettings);
}

/**
 * Turns the query string into a lookup attempt and the form's next step.
 *
 * Three ways in, all resolving to the same rule — the token on its own, or the
 * order number *and* the email together:
 *
 *   ?token=…                 the personal link from an email
 *   ?order=…&email=…         the classic pair, still honoured so old links work
 *   ?q=…  then ?q=…&confirm=…  the one-field-at-a-time form
 *
 * `q` alone never performs a lookup: it only decides which question to ask
 * next. That is what keeps an order number from being enough on its own.
 */
export type LookupRequest = {
  token: string | null;
  orderNumber: string | null;
  email: string | null;
  /** Whether we have enough to search at all. */
  attempted: boolean;
  /** What the form should render. */
  formStep: LookupStep;
};

export function resolveLookupParams({
  token,
  order,
  email,
  q,
  confirm,
}: {
  token?: string | null;
  order?: string | null;
  email?: string | null;
  q?: string | null;
  confirm?: string | null;
}): LookupRequest {
  const cleanToken = token?.trim() || null;
  const typed = q?.trim() || null;
  const answer = confirm?.trim() || null;

  // The two-step form, once both halves are in hand.
  if (typed && answer) {
    const kind = classifyLookup(typed);
    const pair =
      kind === "email"
        ? { orderNumber: answer, email: typed }
        : { orderNumber: typed, email: answer };

    return {
      token: null,
      ...pair,
      attempted: true,
      formStep: { step: "confirm", value: typed, kind },
    };
  }

  // Step one answered: ask for the other half, search nothing yet.
  if (typed) {
    return {
      token: null,
      orderNumber: null,
      email: null,
      attempted: false,
      formStep: { step: "confirm", value: typed, kind: classifyLookup(typed) },
    };
  }

  const cleanOrder = order?.trim() || null;
  const cleanEmail = email?.trim() || null;

  return {
    token: cleanToken,
    orderNumber: cleanOrder,
    email: cleanEmail,
    attempted: Boolean(cleanToken || (cleanOrder && cleanEmail)),
    formStep: { step: "identify" },
  };
}
