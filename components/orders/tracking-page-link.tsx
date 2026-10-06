import type { ReactNode } from "react";

import { IconExternal } from "@/components/icons";
import type { Order, Store } from "@/lib/db";
import { buildTrackingLink } from "@/lib/tracking/links";

/**
 * Opens an order's customer tracking page — the same link the customer gets
 * in their emails and on the Shopify order — in a new tab.
 */
export function TrackingPageLink({
  store,
  order,
  className,
  children,
}: {
  store: Pick<Store, "shopDomain" | "primaryDomain">;
  order: Pick<Order, "trackingToken" | "orderNumber">;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={buildTrackingLink(store, order)}
      target="_blank"
      rel="noreferrer"
      title={`Open the tracking page for order ${order.orderNumber}`}
      className={className}
    >
      {children ?? order.orderNumber}
      <IconExternal className="ml-1 inline size-3 align-baseline text-ink-400" />
      <span className="sr-only"> (opens the tracking page in a new tab)</span>
    </a>
  );
}
