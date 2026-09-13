import type { Order, Stage, Store } from "@/lib/db";
import { formatAddressOneLine, formatDate } from "@/lib/utils";

/**
 * Merge variables available in email subjects and bodies.
 * Kept as data so the template editor can show the exact list, with examples.
 */
export const MERGE_VARIABLES = [
  {
    token: "customer_name",
    label: "Customer name",
    example: "Sarah Jenkins",
  },
  { token: "order_number", label: "Order number", example: "#1042" },
  { token: "order_date", label: "Order date", example: "5 Oct 2025" },
  {
    token: "tracking_link",
    label: "Tracking link",
    example: "https://store.com/apps/track-order?token=…",
  },
  {
    token: "current_stage",
    label: "Current stage",
    example: "Out for Delivery",
  },
  { token: "store_name", label: "Store name", example: "Northside Supply" },
  {
    token: "shipping_address",
    label: "Shipping address",
    example: "12 Bourke St, Melbourne VIC 3000, Australia",
  },
] as const;

export type MergeToken = (typeof MERGE_VARIABLES)[number]["token"];
export type MergeContext = Record<MergeToken, string>;

/** Escapes a value before it is spliced into an HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildMergeContext({
  order,
  store,
  stage,
  trackingLink,
}: {
  order: Pick<
    Order,
    "orderNumber" | "orderDate" | "customerName" | "shippingAddress"
  >;
  store: Pick<Store, "name" | "shopDomain">;
  stage: Pick<Stage, "name"> | null;
  trackingLink: string;
}): MergeContext {
  return {
    customer_name: order.customerName ?? "there",
    order_number: order.orderNumber,
    order_date: formatDate(order.orderDate),
    tracking_link: trackingLink,
    current_stage: stage?.name ?? "Order received",
    store_name: store.name ?? store.shopDomain,
    shipping_address: formatAddressOneLine(order.shippingAddress),
  };
}

/**
 * Replaces `{{token}}` occurrences. Unknown tokens are left untouched so a typo
 * is visible in the preview instead of silently disappearing.
 *
 * @param escape `true` for HTML bodies, `false` for plain-text subjects.
 */
export function applyMergeFields(
  input: string,
  context: MergeContext,
  { escape = true }: { escape?: boolean } = {},
): string {
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, rawToken) => {
    const token = String(rawToken).toLowerCase() as MergeToken;
    if (!(token in context)) return match;
    const value = context[token] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

/** Merge tokens used in a string that are not part of MERGE_VARIABLES. */
export function findUnknownMergeTokens(input: string): string[] {
  const known = new Set<string>(MERGE_VARIABLES.map((entry) => entry.token));
  const found = new Set<string>();
  for (const match of input.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
    const token = match[1].toLowerCase();
    if (!known.has(token)) found.add(token);
  }
  return [...found];
}

/** Example context for the template editor's live preview. */
export function sampleMergeContext(storeName: string): MergeContext {
  const context = Object.fromEntries(
    MERGE_VARIABLES.map((entry) => [entry.token, entry.example]),
  ) as MergeContext;
  return { ...context, store_name: storeName };
}
