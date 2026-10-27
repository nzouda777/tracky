import type { Order, OrderStageHistory, Stage } from "@/lib/db";
import { optional } from "@/lib/env";
import { buildPhaseTimeline } from "@/lib/orders/stages";
import { phaseOf } from "@/lib/stages/defaults";
import { formatAddressLines, formatCodeAmount } from "@/lib/utils";

export { formatCodeAmount };

/**
 * Order details some designs show beyond the merge variables: the items, the
 * total, the exact time of the order and the address as separate lines — and,
 * when the store's stages and the order's history are known, the progress
 * through the four phases and every recorded update.
 */
export type EmailOrderFacts = {
  items: Array<{
    title: string;
    variant: string;
    quantity: number;
    price: string;
    imageUrl: string | null;
  }>;
  /** `USD 7.98` */
  total: string;
  /** `6/25/2026, 6:43:09 AM` */
  placedAt: string;
  addressLines: string[];
  /**
   * Order Placed → Processing → In Transit → Delivered, each with the date the
   * order first reached it. Empty when the stages were not loaded.
   */
  progress: Array<{
    name: string;
    state: "done" | "now" | "next";
    /** `Sep 24, 2025`, or empty when the phase has not been reached. */
    date: string;
  }>;
  /** Every recorded stage change, newest first. */
  events: Array<{
    title: string;
    /** The note left with the change, if any. */
    detail: string;
    /** `Sep 24, 2025` */
    date: string;
    /** `9:12 AM` */
    time: string;
  }>;
};

/** Time zone order times are shown in. Set EMAIL_TIMEZONE to change it. */
function emailTimeZone(): string {
  return optional("EMAIL_TIMEZONE", "Australia/Sydney");
}

function formatIn(value: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return value.toLocaleString("en-US", { timeZone: emailTimeZone(), ...options });
  } catch {
    return value.toLocaleString("en-US", { timeZone: "UTC", ...options });
  }
}

/** `6/25/2026, 6:43:09 AM` */
export function formatOrderTimestamp(value: Date): string {
  return formatIn(value, {});
}

/** `Sep 24, 2025` */
function formatDay(value: Date): string {
  return formatIn(value, { month: "short", day: "numeric", year: "numeric" });
}

/** `9:12 AM` */
function formatTime(value: Date): string {
  return formatIn(value, { hour: "numeric", minute: "2-digit" });
}

export function buildOrderFacts(
  order: Pick<
    Order,
    | "lineItems"
    | "total"
    | "currency"
    | "orderDate"
    | "shippingAddress"
    | "currentStageId"
  >,
  journey?: {
    stages: Stage[];
    /** The order's history, in any order. */
    history: Pick<OrderStageHistory, "stageId" | "occurredAt" | "note">[];
  },
): EmailOrderFacts {
  const stageById = new Map(journey?.stages.map((stage) => [stage.id, stage]));
  const history = [...(journey?.history ?? [])].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );

  // The date of each phase is the first time the order entered any of its
  // stages; "placed" falls back to the order date itself.
  const reachedAt = new Map<string, Date>();
  for (const event of [...history].reverse()) {
    const stage = stageById.get(event.stageId);
    if (stage && !reachedAt.has(phaseOf(stage))) {
      reachedAt.set(phaseOf(stage), event.occurredAt);
    }
  }
  if (!reachedAt.has("placed")) reachedAt.set("placed", order.orderDate);

  const progress = journey?.stages.length
    ? buildPhaseTimeline(journey.stages, order.currentStageId).map(
        ({ stage, state }) => {
          const done = state === "complete" || (state === "current" && stage.isTerminal);
          const reached = state !== "upcoming";
          const at = reached ? reachedAt.get(stage.phase) : undefined;
          return {
            name: stage.name,
            state: done ? ("done" as const) : reached ? ("now" as const) : ("next" as const),
            date: at ? formatDay(at) : "",
          };
        },
      )
    : [];

  return {
    items: order.lineItems.map((item) => ({
      title: item.title,
      variant: item.variantTitle ?? "",
      quantity: item.quantity,
      price: formatCodeAmount(item.price, order.currency),
      imageUrl: item.imageUrl?.trim() || null,
    })),
    total: formatCodeAmount(order.total, order.currency),
    placedAt: formatOrderTimestamp(order.orderDate),
    addressLines: formatAddressLines(order.shippingAddress),
    progress,
    events: history.flatMap((event) => {
      const stage = stageById.get(event.stageId);
      if (!stage) return [];
      return [
        {
          title: stage.name,
          detail: event.note?.trim() ?? "",
          date: formatDay(event.occurredAt),
          time: formatTime(event.occurredAt),
        },
      ];
    }),
  };
}

/** Example facts for previews, matching the sample merge variables. */
export const SAMPLE_ORDER_FACTS: EmailOrderFacts = {
  items: [
    { title: "Linen Throw Blanket", variant: "Sand", quantity: 1, price: "AUD 89.00", imageUrl: null },
    { title: "Ceramic Vase", variant: "Matte white", quantity: 2, price: "AUD 34.50", imageUrl: null },
  ],
  total: "AUD 158.00",
  placedAt: "10/5/2025, 9:42:17 AM",
  addressLines: [
    "Sarah Jenkins",
    "12 Bourke St",
    "Melbourne VIC 3000",
    "Australia",
  ],
  progress: [
    { name: "Order Placed", state: "done", date: "Oct 5, 2025" },
    { name: "Processing", state: "done", date: "Oct 5, 2025" },
    { name: "In Transit", state: "now", date: "Oct 6, 2025" },
    { name: "Delivered", state: "next", date: "" },
  ],
  events: [
    { title: "Out for Delivery", detail: "Melbourne VIC", date: "Oct 7, 2025", time: "9:12 AM" },
    { title: "Arrived at local depot", detail: "Melbourne VIC", date: "Oct 7, 2025", time: "7:34 AM" },
    { title: "In Transit", detail: "Sydney NSW", date: "Oct 6, 2025", time: "10:21 PM" },
    { title: "Order Confirmed", detail: "", date: "Oct 5, 2025", time: "9:42 AM" },
  ],
};
