import type { Store } from "@/lib/db";

/**
 * Which orders the app takes care of.
 *
 * Only orders placed on the day the store was connected, or later, are
 * tracked: imported, emailed and moved by auto-advance. Anything older belongs
 * to the merchant's previous process and is left alone, so connecting the app
 * never sends a burst of emails about orders customers already have.
 *
 * The day boundary is midnight UTC on the day of `installedAt`.
 */
export function trackingStart(store: Pick<Store, "installedAt">): Date | null {
  if (!store.installedAt) return null;
  const start = new Date(store.installedAt);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/** True when the app should handle an order placed at `orderDate`. */
export function isTrackedOrder(
  store: Pick<Store, "installedAt">,
  orderDate: Date,
): boolean {
  const start = trackingStart(store);
  return !start || orderDate.getTime() >= start.getTime();
}
