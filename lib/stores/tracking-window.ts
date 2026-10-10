import type { Store } from "@/lib/db";

/**
 * Which orders the app may email.
 *
 * Every order is imported and moves along its stages, but only orders placed
 * on the day the store was connected, or later, get customer emails. Older
 * orders stay silent, so connecting the app never sends a burst of emails
 * about orders customers already have.
 *
 * The day boundary is midnight UTC on the day of `installedAt`.
 */
export function trackingStart(store: Pick<Store, "installedAt">): Date | null {
  if (!store.installedAt) return null;
  const start = new Date(store.installedAt);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/** True when the customer of an order placed at `orderDate` may be emailed. */
export function mayEmailOrder(
  store: Pick<Store, "installedAt">,
  orderDate: Date,
): boolean {
  const start = trackingStart(store);
  return !start || orderDate.getTime() >= start.getTime();
}
