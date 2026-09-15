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
import {
  classifyLookup,
  type LookupMode,
  type LookupStep,
} from "@/components/tracking/lookup-form";

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
 * Three ways in, in descending order of how much they prove:
 *   - `token`: the opaque per-order token used in emails;
 *   - `orderNumber` + `email`: both must match;
 *   - `orderNumber` alone, and **only** when the caller opts in with
 *     `allowOrderNumberOnly`. Order numbers are sequential and guessable, so a
 *     surface that opts in must restrict what it renders — see `LookupAccess`.
 *
 * The opt-in is a required argument rather than a default precisely so that
 * relaxing the rule is a decision a route has to make in writing.
 */
export async function findPublicOrder({
  tdb,
  token,
  orderNumber,
  email,
  allowOrderNumberOnly = false,
}: {
  tdb: TenantDb;
  token?: string | null;
  orderNumber?: string | null;
  email?: string | null;
  allowOrderNumberOnly?: boolean;
}): Promise<Order | null> {
  if (token?.trim()) {
    return tdb.findFirst(orders, {
      where: eq(orders.trackingToken, token.trim()),
    });
  }

  const number = orderNumber?.trim();
  const mail = email?.trim().toLowerCase();
  if (!number) return null;
  if (!mail && !allowOrderNumberOnly) return null;

  // Customers type "1042", "#1042" or "1042 " — all should work.
  const normalized = number.replace(/^#/, "");

  const matchesNumber = or(
    eq(orders.orderNumber, number),
    eq(orders.orderNumber, `#${normalized}`),
    eq(orders.orderNumber, normalized),
  );

  return tdb.findFirst(orders, {
    where: mail
      ? and(eq(sql`lower(${orders.customerEmail})`, mail), matchesNumber)
      : matchesNumber,
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
 * How strongly the visitor proved the order is theirs.
 *
 * The page renders from this, not from the fact that a row was found: an order
 * opened with a guessable order number shows the delivery progress and holds
 * back everything else.
 */
export type LookupAccess =
  /** Nothing presented yet, or nothing matched. */
  | "none"
  /** The per-order token from an email link — only the customer has it. */
  | "token"
  /** Order number *and* the email on the order. */
  | "verified"
  /** Order number alone. Guessable, so treated as unproven. */
  | "order-number";

/** Whether an access level is enough to reveal personal details. */
export function isVerifiedAccess(access: LookupAccess): boolean {
  return access === "token" || access === "verified";
}

/**
 * Turns the query string into a lookup attempt and the form's next step.
 *
 * Four ways in:
 *
 *   ?token=…                   the personal link from an email
 *   ?order=…&email=…           the classic pair, still honoured so old links work
 *   ?q=…  then ?q=…&confirm=…  the one-field-at-a-time form
 *   ?q=…                       order number alone — `order-only` mode only
 *
 * `mode` is what separates the two customer surfaces. On `two-factor` (the
 * Shopify App Proxy page) `q` alone never searches; it only decides which
 * question to ask next. On `order-only` (the hosted page) `q` alone searches,
 * and the resulting access level tells the page to withhold personal details.
 *
 * `?verify=1` forces `two-factor` behaviour on an `order-only` surface, which
 * is how a customer looking at a withheld address asks for the full view.
 */
export type LookupRequest = {
  token: string | null;
  orderNumber: string | null;
  email: string | null;
  /** Whether we have enough to search at all. */
  attempted: boolean;
  /** What that search, if it matches, entitles the visitor to see. */
  access: LookupAccess;
  /** What the form should render. */
  formStep: LookupStep;
  /** Set when the visitor typed something this surface cannot use. */
  inputError: string | null;
};

export function resolveLookupParams({
  token,
  order,
  email,
  q,
  confirm,
  verify,
  mode = "two-factor",
}: {
  token?: string | null;
  order?: string | null;
  email?: string | null;
  q?: string | null;
  confirm?: string | null;
  verify?: string | null;
  mode?: LookupMode;
}): LookupRequest {
  const cleanToken = token?.trim() || null;
  const typed = q?.trim() || null;
  const answer = confirm?.trim() || null;
  const cleanOrder = order?.trim() || null;
  const cleanEmail = email?.trim() || null;

  // A visitor who asked for the full view gets the two-factor form even on a
  // surface that would otherwise settle for an order number.
  const effectiveMode: LookupMode = verify?.trim() ? "two-factor" : mode;

  const blank: LookupRequest = {
    token: null,
    orderNumber: null,
    email: null,
    attempted: false,
    access: "none",
    formStep: { step: "identify" },
    inputError: null,
  };

  // The emailed link outranks everything: it is the strongest proof we have,
  // and it is what the address-change route redirects back with.
  if (cleanToken) {
    return { ...blank, token: cleanToken, attempted: true, access: "token" };
  }

  // The two-step form, once both halves are in hand.
  if (typed && answer) {
    const kind = classifyLookup(typed);
    const pair =
      kind === "email"
        ? { orderNumber: answer, email: typed }
        : { orderNumber: typed, email: answer };

    return {
      ...blank,
      ...pair,
      attempted: true,
      access: "verified",
      formStep: { step: "confirm", value: typed, kind },
    };
  }

  // The classic pair, from an older link.
  if (cleanOrder && cleanEmail) {
    return {
      ...blank,
      orderNumber: cleanOrder,
      email: cleanEmail,
      attempted: true,
      access: "verified",
    };
  }

  const single = typed ?? cleanOrder;

  if (effectiveMode === "order-only") {
    if (!single) return blank;

    // An email on its own stays refused: it would match whichever order came
    // back first, and it would confirm to a stranger that an address shops here.
    if (classifyLookup(single) === "email") {
      return {
        ...blank,
        inputError:
          "Enter your order number — it is at the top of your order confirmation email.",
      };
    }

    return {
      ...blank,
      orderNumber: single,
      attempted: true,
      access: "order-number",
    };
  }

  // Two-factor: step one answered, so ask for the other half and search nothing.
  if (typed) {
    return {
      ...blank,
      formStep: { step: "confirm", value: typed, kind: classifyLookup(typed) },
    };
  }

  return blank;
}
