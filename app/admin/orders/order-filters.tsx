"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input, Select } from "@/components/ui";
import type { Stage } from "@/lib/db";

/**
 * Search and stage filters. Kept in the URL so a filtered list can be shared,
 * bookmarked and reloaded — and so the server does the filtering.
 */
export function OrderFilters({ stages }: { stages: Stage[] }) {
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

  const hasFilters =
    Boolean(params.get("q")) ||
    Boolean(params.get("stage")) ||
    Boolean(params.get("status"));

  return (
    <Card className="p-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: search });
        }}
      >
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

        <div className="space-y-1.5">
          <label
            htmlFor="order-stage"
            className="block text-sm font-medium text-ink-800"
          >
            Stage
          </label>
          <Select
            id="order-stage"
            value={params.get("stage") ?? ""}
            onChange={(event) => apply({ stage: event.currentTarget.value })}
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="order-status"
            className="block text-sm font-medium text-ink-800"
          >
            Status
          </label>
          <Select
            id="order-status"
            value={params.get("status") ?? ""}
            onChange={(event) => apply({ status: event.currentTarget.value })}
          >
            <option value="">All orders</option>
            <option value="active">In progress</option>
            <option value="completed">Completed</option>
          </Select>
        </div>

        <Button type="submit" variant="secondary">
          Search
        </Button>

        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/admin/orders")}
          >
            Clear
          </Button>
        ) : null}
      </form>
    </Card>
  );
}
