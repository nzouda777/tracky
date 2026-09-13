import type { Order, Store } from "@/lib/db";

/**
 * The App Proxy sub-path declared in the Shopify app configuration:
 * prefix `apps`, subpath `track-order`. The customer therefore reaches the
 * tracking page at `https://<merchant domain>/apps/track-order`, never on our
 * own domain.
 */
export const APP_PROXY_PREFIX = "apps";
export const APP_PROXY_SUBPATH = "track-order";

/** The public tracking path on the merchant's storefront. */
export function trackingPath(): string {
  return `/${APP_PROXY_PREFIX}/${APP_PROXY_SUBPATH}`;
}

function storefrontOrigin(store: Pick<Store, "shopDomain" | "primaryDomain">) {
  return `https://${store.primaryDomain ?? store.shopDomain}`;
}

/** Deep link to one order's timeline, for emails and the backoffice. */
export function buildTrackingLink(
  store: Pick<Store, "shopDomain" | "primaryDomain">,
  order: Pick<Order, "trackingToken">,
): string {
  const url = new URL(trackingPath(), storefrontOrigin(store));
  url.searchParams.set("token", order.trackingToken);
  return url.toString();
}

/** The bare lookup page, with no order pre-selected. */
export function buildTrackingLookupLink(
  store: Pick<Store, "shopDomain" | "primaryDomain">,
): string {
  return new URL(trackingPath(), storefrontOrigin(store)).toString();
}
