import {
  isOrderSort,
  type FulfillmentFilter,
  type OrderListFilters,
} from "./queries";

/**
 * The orders list's filter state, as it travels in the URL.
 *
 * Parsing lives here, in one pure function, rather than in the page: the page
 * and the filter bar have to agree on exactly what `?status=cancelled&from=…`
 * means, and two readings of the same query string is how a filter bar ends up
 * showing one thing while the table shows another. It also means every value
 * reaching a SQL clause has been through a whitelist — nothing from the query
 * string is trusted further than this file.
 */

export type OrderSearchParams = {
  q?: string;
  stage?: string;
  status?: string;
  fulfillment?: string;
  driver?: string;
  from?: string;
  to?: string;
  proof?: string;
  sort?: string;
  per?: string;
  page?: string;
};

export const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All orders" },
  { value: "active", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const FULFILLMENT_OPTIONS: Array<{
  value: "" | FulfillmentFilter;
  label: string;
}> = [
  { value: "", label: "Any fulfillment" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "partial", label: "Partially fulfilled" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "failed", label: "Fulfillment failed" },
];

export const PROOF_OPTIONS = [
  { value: "", label: "Any delivery" },
  { value: "yes", label: "Delivery confirmed" },
  { value: "no", label: "Not confirmed" },
] as const;

export const PER_PAGE_OPTIONS = [25, 50, 100] as const;

const FULFILLMENT_VALUES = new Set<string>(
  FULFILLMENT_OPTIONS.map((option) => option.value).filter(Boolean),
);

/** `YYYY-MM-DD`, the value an `<input type="date">` produces. */
const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A day boundary, read as UTC.
 *
 * The date arrives as a bare day with no zone, and orders are stored as
 * instants. Reading both ends in UTC keeps the range exactly as wide as it
 * looks — a day is 24 hours, the same 24 hours for the count and the rows —
 * which matters more here than matching a viewer's local midnight, since the
 * same filtered URL is shared between an admin and an agency in different
 * places.
 */
function dayStart(value: string | undefined): Date | undefined {
  if (!value || !DATE_INPUT.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dayEnd(value: string | undefined): Date | undefined {
  if (!value || !DATE_INPUT.test(value)) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseOrderFilters(
  params: OrderSearchParams,
): OrderListFilters {
  const status = params.status;

  // A backwards range filters everything out and reads as a bug rather than a
  // typo, so the two ends are swapped instead.
  let placedFrom = dayStart(params.from);
  let placedTo = dayEnd(params.to);
  if (placedFrom && placedTo && placedFrom > placedTo) {
    [placedFrom, placedTo] = [dayStart(params.to), dayEnd(params.from)];
  }

  return {
    search: params.q?.trim() || undefined,
    stageId: params.stage || undefined,
    onlyActive: status === "active",
    onlyCompleted: status === "completed",
    onlyCancelled: status === "cancelled",
    driver: params.driver?.trim() || undefined,
    placedFrom,
    placedTo,
    fulfillment:
      params.fulfillment && FULFILLMENT_VALUES.has(params.fulfillment)
        ? (params.fulfillment as FulfillmentFilter)
        : undefined,
    hasProof:
      params.proof === "yes" ? true : params.proof === "no" ? false : undefined,
    sort: isOrderSort(params.sort) ? params.sort : undefined,
    perPage: parsePerPage(params.per),
    page: Math.max(1, Number(params.page ?? 1) || 1),
  };
}

function parsePerPage(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : undefined;
}

/** How many filters are narrowing the list, for the "Clear" affordance. */
export function countActiveFilters(params: OrderSearchParams): number {
  const narrowing: Array<string | undefined> = [
    params.q?.trim(),
    params.stage,
    params.status,
    params.fulfillment,
    params.driver,
    params.from,
    params.to,
    params.proof,
  ];
  return narrowing.filter(Boolean).length;
}

/** `from`/`to` for a preset, as the date input spells them. */
export function presetRange(days: number): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}
