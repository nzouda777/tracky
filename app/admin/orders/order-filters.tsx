"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input, Select } from "@/components/ui";
import type { Stage } from "@/lib/db";
import {
  FULFILLMENT_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PER_PAGE_OPTIONS,
  PROOF_OPTIONS,
  presetRange,
} from "@/lib/orders/filters";
import { ORDER_SORTS, UNASSIGNED_DRIVER } from "@/lib/orders/queries";

/**
 * Filters for the orders list.
 *
 * All of it lives in the URL rather than in component state, so a filtered
 * list can be shared with the agency, bookmarked, and reloaded — and so the
 * filtering happens in SQL over every order, not in the browser over one page
 * of them. Changing any control resets to page 1, since the row that was on
 * page 3 is rarely on page 3 of a different query.
 */
export function OrderFilters({
  stages,
  drivers,
  activeCount,
}: {
  stages: Stage[];
  /** Driver labels already used in this store, for the dropdown. */
  drivers: string[];
  /** How many filters are currently narrowing the list. */
  activeCount: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const queryFromUrl = params.get("q") ?? "";
  const [search, setSearch] = useState(queryFromUrl);

  // Keep the input in step with the URL (back button, cleared filters) by
  // adjusting state during render instead of in an effect.
  const [lastQuery, setLastQuery] = useState(queryFromUrl);
  if (queryFromUrl !== lastQuery) {
    setLastQuery(queryFromUrl);
    setSearch(queryFromUrl);
  }

  function apply(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    query.delete("page");
    router.push(`/admin/orders?${query.toString()}`);
  }

  const value = (key: string) => params.get(key) ?? "";

  // The date range is the filter people reach for first, so it stays open once
  // it is in use rather than hiding what is narrowing the list.
  const rangeInUse = Boolean(value("from") || value("to"));
  const [showMore, setShowMore] = useState(
    rangeInUse ||
      Boolean(
        value("fulfillment") || value("driver") || value("proof") || value("sort"),
      ),
  );

  return (
    <Card className="p-4">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: search });
        }}
      >
        {/* Row 1 — search and the two filters used on every visit. */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1 space-y-1.5">
            <label
              htmlFor="order-search"
              className="block text-sm font-medium text-ink-800"
            >
              Search
            </label>
            <Input
              id="order-search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Order number, customer, email or driver"
            />
          </div>

          <Labelled label="Stage" htmlFor="order-stage">
            <Select
              id="order-stage"
              value={value("stage")}
              onChange={(event) => apply({ stage: event.currentTarget.value })}
            >
              <option value="">All stages</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Status" htmlFor="order-status">
            <Select
              id="order-status"
              value={value("status")}
              onChange={(event) => apply({ status: event.currentTarget.value })}
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Labelled>

          <Button type="submit" variant="secondary">
            Search
          </Button>

          <Button
            type="button"
            variant="ghost"
            aria-expanded={showMore}
            onClick={() => setShowMore((open) => !open)}
          >
            {showMore ? "Fewer filters" : "More filters"}
          </Button>

          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/admin/orders")}
            >
              Clear {activeCount}
            </Button>
          ) : null}
        </div>

        {showMore ? (
          <div className="space-y-4 border-t border-ink-100 pt-4">
            {/* Row 2 — the date range, plus shortcuts for the windows
                people actually ask for. */}
            <div className="flex flex-wrap items-end gap-3">
              <Labelled label="Placed from" htmlFor="order-from">
                <Input
                  id="order-from"
                  type="date"
                  value={value("from")}
                  max={value("to") || undefined}
                  onChange={(event) => apply({ from: event.currentTarget.value })}
                />
              </Labelled>

              <Labelled label="Placed to" htmlFor="order-to">
                <Input
                  id="order-to"
                  type="date"
                  value={value("to")}
                  min={value("from") || undefined}
                  onChange={(event) => apply({ to: event.currentTarget.value })}
                />
              </Labelled>

              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                {[
                  { label: "Today", days: 1 },
                  { label: "7 days", days: 7 },
                  { label: "30 days", days: 30 },
                  { label: "90 days", days: 90 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => apply(presetRange(preset.days))}
                  >
                    {preset.label}
                  </Button>
                ))}
                {rangeInUse ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => apply({ from: "", to: "" })}
                  >
                    Any date
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Row 3 — the rest, and how the result is presented. */}
            <div className="flex flex-wrap items-end gap-3">
              <Labelled label="Fulfillment" htmlFor="order-fulfillment">
                <Select
                  id="order-fulfillment"
                  value={value("fulfillment")}
                  onChange={(event) =>
                    apply({ fulfillment: event.currentTarget.value })
                  }
                >
                  {FULFILLMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Labelled>

              <Labelled label="Driver" htmlFor="order-driver">
                <Select
                  id="order-driver"
                  value={value("driver")}
                  onChange={(event) => apply({ driver: event.currentTarget.value })}
                >
                  <option value="">Any driver</option>
                  <option value={UNASSIGNED_DRIVER}>Not assigned</option>
                  {drivers.map((driver) => (
                    <option key={driver} value={driver}>
                      {driver}
                    </option>
                  ))}
                </Select>
              </Labelled>

              <Labelled label="Delivery" htmlFor="order-proof">
                <Select
                  id="order-proof"
                  value={value("proof")}
                  onChange={(event) => apply({ proof: event.currentTarget.value })}
                >
                  {PROOF_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Labelled>

              <Labelled label="Sort by" htmlFor="order-sort">
                <Select
                  id="order-sort"
                  value={value("sort") || "newest"}
                  onChange={(event) => apply({ sort: event.currentTarget.value })}
                >
                  {Object.entries(ORDER_SORTS).map(([key, option]) => (
                    <option key={key} value={key}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Labelled>

              <Labelled label="Per page" htmlFor="order-per">
                <Select
                  id="order-per"
                  value={value("per") || "25"}
                  onChange={(event) => apply({ per: event.currentTarget.value })}
                  className="w-24"
                >
                  {PER_PAGE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </Labelled>
            </div>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function Labelled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-800"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
