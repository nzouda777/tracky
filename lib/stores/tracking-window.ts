import type { AutoAdvanceSettings, Store } from "@/lib/db";

/**
 * Which orders the app may email.
 *
 * Every order is imported and moves along its stages, but only orders placed
 * on or after the store's email start date get customer emails. Older orders
 * stay silent, so connecting the app never sends a burst of emails about
 * orders customers already have.
 *
 * The start date is set by the owner (Settings → Progression & emails). When
 * unset it is midnight UTC on the day the store was connected.
 */
export function emailsStart(
  store: Pick<Store, "installedAt">,
  settings: Pick<AutoAdvanceSettings, "emailsSince"> | null,
): Date | null {
  if (settings?.emailsSince) return settings.emailsSince;
  if (!store.installedAt) return null;
  const start = new Date(store.installedAt);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/** True when the customer of an order placed at `orderDate` may be emailed. */
export function mayEmailOrder(
  store: Pick<Store, "installedAt">,
  settings: Pick<AutoAdvanceSettings, "emailsSince"> | null,
  orderDate: Date,
): boolean {
  const start = emailsStart(store, settings);
  return !start || orderDate.getTime() >= start.getTime();
}
