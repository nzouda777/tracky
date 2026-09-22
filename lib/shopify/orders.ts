import type { LineItem, ShippingAddress } from "@/lib/db";

/**
 * The subset of the Shopify order webhook payload this app consumes.
 * Everything is optional because webhook payloads vary by plan, channel and
 * API version; the mapper below tolerates missing pieces rather than rejecting
 * an order we could still track.
 */
export type ShopifyOrderPayload = {
  id: number | string;
  name?: string | null;
  order_number?: number | string | null;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  cancelled_at?: string | null;
  currency?: string | null;
  current_total_price?: string | null;
  total_price?: string | null;
  fulfillment_status?: string | null;
  /** `paid`, `pending`, `partially_paid`, `refunded`, `voided`, … */
  financial_status?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: Record<string, unknown> | null;
  billing_address?: Record<string, unknown> | null;
  line_items?: Array<Record<string, unknown>> | null;
};

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") return String(value);
  return null;
}

export function mapShippingAddress(
  raw: Record<string, unknown> | null | undefined,
): ShippingAddress | null {
  if (!raw) return null;
  return {
    name:
      text(raw.name) ??
      ([text(raw.first_name), text(raw.last_name)].filter(Boolean).join(" ") ||
        null),
    company: text(raw.company),
    address1: text(raw.address1),
    address2: text(raw.address2),
    city: text(raw.city),
    province: text(raw.province),
    provinceCode: text(raw.province_code),
    country: text(raw.country),
    countryCode: text(raw.country_code),
    zip: text(raw.zip),
    phone: text(raw.phone),
  };
}

export function mapLineItems(
  raw: Array<Record<string, unknown>> | null | undefined,
): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    id: text(item.id),
    title: text(item.title) ?? text(item.name) ?? "Item",
    variantTitle: text(item.variant_title),
    quantity: Number(item.quantity ?? 1) || 1,
    price: text(item.price),
    sku: text(item.sku),
    imageUrl: null,
  }));
}

export function customerNameFrom(payload: ShopifyOrderPayload): string | null {
  const fromCustomer = [
    text(payload.customer?.first_name),
    text(payload.customer?.last_name),
  ]
    .filter(Boolean)
    .join(" ");
  if (fromCustomer) return fromCustomer;

  const shipping = mapShippingAddress(payload.shipping_address);
  return shipping?.name ?? null;
}

export function customerEmailFrom(
  payload: ShopifyOrderPayload,
): string | null {
  const email =
    text(payload.email) ??
    text(payload.contact_email) ??
    text(payload.customer?.email);
  return email ? email.toLowerCase() : null;
}

/** `#1042` if Shopify gave us a name, otherwise the raw order number. */
export function orderNumberFrom(payload: ShopifyOrderPayload): string {
  return (
    text(payload.name) ??
    text(payload.order_number) ??
    `#${String(payload.id)}`
  );
}

export function orderDateFrom(payload: ShopifyOrderPayload): Date {
  const raw = text(payload.created_at) ?? text(payload.processed_at);
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** The fields we mirror from Shopify, ready to insert or update. */
export type MappedOrderFields = {
  shopifyOrderId: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: ShippingAddress | null;
  lineItems: LineItem[];
  orderDate: Date;
  total: string | null;
  currency: string;
  cancelledAt: Date | null;
};

export function mapOrderPayload(
  payload: ShopifyOrderPayload,
  fallbackCurrency = "AUD",
): MappedOrderFields {
  const cancelledRaw = text(payload.cancelled_at);
  const cancelledAt = cancelledRaw ? new Date(cancelledRaw) : null;

  return {
    shopifyOrderId: String(payload.id),
    orderNumber: orderNumberFrom(payload),
    customerName: customerNameFrom(payload),
    customerEmail: customerEmailFrom(payload),
    customerPhone: text(payload.phone) ?? text(payload.customer?.phone),
    shippingAddress: mapShippingAddress(
      payload.shipping_address ?? payload.billing_address,
    ),
    lineItems: mapLineItems(payload.line_items),
    orderDate: orderDateFrom(payload),
    total: text(payload.current_total_price) ?? text(payload.total_price),
    currency: text(payload.currency) ?? fallbackCurrency,
    cancelledAt:
      cancelledAt && !Number.isNaN(cancelledAt.getTime()) ? cancelledAt : null,
  };
}
