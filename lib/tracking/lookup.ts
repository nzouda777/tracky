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
 * Four ways in, in descending order of how much they prove:
 *   - `token`: the opaque per-order token used in emails;
 *   - `orderNumber` + `email`: both must match;
 *   - `email` alone, when the caller opts in with `allowEmailOnly`;
 *   - `orderNumber` alone, when the caller opts in with `allowOrderNumberOnly`.
 *     Order numbers are sequential and guessable, so a surface that opts in
 *     must restrict what it renders — see `LookupAccess`.
 *
 * Both opt-ins are required arguments rather than defaults precisely so that
 * relaxing the rule is a decision a route has to make in writing.
 */
export async function findPublicOrder({
  tdb,
  token,
  orderNumber,
  email,
  allowOrderNumberOnly = false,
  allowEmailOnly = false,
}: {
  tdb: TenantDb;
  token?: string | null;
  orderNumber?: string | null;
  email?: string | null;
  allowOrderNumberOnly?: boolean;
  allowEmailOnly?: boolean;
}): Promise<Order | null> {
  if (token?.trim()) {
    return tdb.findFirst(orders, {
      where: eq(orders.trackingToken, token.trim()),
    });
  }

  const number = orderNumber?.trim();
  const mail = email?.trim().toLowerCase();

  // Email alone. One address can have many orders, so this answers with the
  // most recent — the one a customer asking "where is my order" means. The
  // others stay reachable through the link in their own confirmation email.
  if (!number) {
    if (!mail || !allowEmailOnly) return null;
    return tdb.findFirst(orders, {
      where: eq(sql`lower(${orders.customerEmail})`, mail),
      orderBy: desc(orders.orderDate),
    });
  }

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
  /**
   * The email on the order, alone.
   *
   * Weaker than `verified`: it proves only that the visitor knows an address,
   * not that they hold anything the merchant sent them. It is nonetheless
   * treated as sufficient below, because a store that turns this on has
   * decided that asking for an order number costs more customers than the
   * exposure costs it. Kept as its own level rather than folded into
   * `verified` so that decision stays visible, and reversible in one line.
   */
  | "email"
  /** Order number alone. Guessable, so treated as unproven. */
  | "order-number";

/**
 * Whether an access level is enough to reveal personal details — the delivery
 * address, the full name, and the address-change form.
 *
 * This single predicate is what every surface reads, so tightening
 * email-only lookups back down is a matter of removing one case here.
 */
export function isVerifiedAccess(access: LookupAccess): boolean {
  return access === "token" || access === "verified" || access === "email";
}

/**
 * Turns the query string into a lookup attempt and the form's next step.
 *
 * Four ways in:
 *
 *   ?token=…                   the personal link from an email
 *   ?order=…&email=…           the classic pair, still honoured so old links work
 *   ?q=…  then ?q=…&confirm=…  the one-field-at-a-time form
 *   ?q=…                       one detail alone — `email-only` / `order-only`
 *
 * `mode` is what separates the customer surfaces:
 *
 *   two-factor  `q` alone never searches; it only decides which question to
 *               ask next, so the form never reveals what exists.
 *   email-only  an email alone searches and opens the most recent order.
 *   order-only  an order number alone searches, and the resulting access level
 *               tells the page to withhold personal details.
 *
 * `?verify=1` forces `two-factor` behaviour, which is how a customer looking
 * at a withheld address asks for the full view.
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

/**
 * How much a customer has to present to open their own order.
 *
 * Both customer surfaces read this, so the trade-off is made once instead of
 * drifting between the page on the merchant's domain and the hosted one.
 *
 * `email-only` asks for the address used at checkout and nothing else. It is
 * the least friction a tracking page can have, and the reason to think twice:
 * an email address is not a secret, so anyone who knows a customer's address
 * can see that customer's latest order — name, delivery address and items —
 * and learn that the address shops here at all. A store that would rather not
 * make that trade sets `two-factor`, which asks for the order number as well;
 * everything else in this file already supports it.
 */
export const CUSTOMER_LOOKUP_MODE: LookupMode = "email-only";

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

  const single = typed ?? cleanOrder ?? cleanEmail;

  if (effectiveMode === "email-only") {
    if (!single) return blank;

    // An order number on its own proves nothing here and this surface has not
    // opted into showing anything for one, so ask for the address instead of
    // silently finding nothing.
    if (classifyLookup(single) !== "email") {
      return {
        ...blank,
        inputError:
          "Enter the email address you used at checkout, and we will show your latest order.",
      };
    }

    return { ...blank, email: single, attempted: true, access: "email" };
  }

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
