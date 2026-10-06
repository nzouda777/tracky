import type { Order } from "@/lib/db";
import { optional } from "@/lib/env";
import { formatAddressLines } from "@/lib/utils";

/**
 * Order details some designs show beyond the merge variables: the items, the
 * total, the exact time of the order and the address as separate lines.
 */
export type EmailOrderFacts = {
  items: Array<{
    title: string;
    variant: string;
    quantity: number;
    price: string;
  }>;
  /** `USD 7.98` */
  total: string;
  /** `6/25/2026, 6:43:09 AM` */
  placedAt: string;
  addressLines: string[];
};

/** Time zone order times are shown in. Set EMAIL_TIMEZONE to change it. */
function emailTimeZone(): string {
  return optional("EMAIL_TIMEZONE", "Australia/Sydney");
}

/** `USD 7.98` — the currency code, then the amount. */
export function formatCodeAmount(
  amount: string | number | null | undefined,
  currency: string,
): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const value = Number(amount);
  if (Number.isNaN(value)) return "";
  return `${currency} ${value.toFixed(2)}`.trim();
}

/** `6/25/2026, 6:43:09 AM` */
export function formatOrderTimestamp(value: Date): string {
  try {
    return value.toLocaleString("en-US", { timeZone: emailTimeZone() });
  } catch {
    return value.toLocaleString("en-US", { timeZone: "UTC" });
  }
}

export function buildOrderFacts(
  order: Pick<
    Order,
    "lineItems" | "total" | "currency" | "orderDate" | "shippingAddress"
  >,
): EmailOrderFacts {
  return {
    items: order.lineItems.map((item) => ({
      title: item.title,
      variant: item.variantTitle ?? "",
      quantity: item.quantity,
      price: formatCodeAmount(item.price, order.currency),
    })),
    total: formatCodeAmount(order.total, order.currency),
    placedAt: formatOrderTimestamp(order.orderDate),
    addressLines: formatAddressLines(order.shippingAddress),
  };
}

/** Example facts for previews, matching the sample merge variables. */
export const SAMPLE_ORDER_FACTS: EmailOrderFacts = {
  items: [
    { title: "Linen Throw Blanket", variant: "Sand", quantity: 1, price: "AUD 89.00" },
    { title: "Ceramic Vase", variant: "Matte white", quantity: 2, price: "AUD 34.50" },
  ],
  total: "AUD 158.00",
  placedAt: "10/5/2025, 9:42:17 AM",
  addressLines: [
    "Sarah Jenkins",
    "12 Bourke St",
    "Melbourne VIC 3000",
    "Australia",
  ],
};
