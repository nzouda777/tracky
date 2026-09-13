"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input, Select } from "@/components/ui";
import type { Stage } from "@/lib/db";

/** Search + stage + driver filters, stacked for narrow screens. */
export function AgencyFilters({
  stages,
  drivers,
  basePath,
}: {
  stages: Stage[];
  drivers: string[];
  basePath: string;
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
    router.push(`${basePath}?${query.toString()}`);
  }

  const hasFilters =
    Boolean(params.get("q")) ||
    Boolean(params.get("stage")) ||
    Boolean(params.get("driver"));

  return (
    <Card className="p-4">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: search });
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="agency-search" className="block text-sm font-medium text-ink-800">
            Search
          </label>
          <Input
            id="agency-search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Order number, customer or address"
            className="h-12 text-base"
            inputMode="search"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="agency-stage" className="block text-sm font-medium text-ink-800">
              Stage
            </label>
            <Select
              id="agency-stage"
              className="h-12 text-base"
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
            <label htmlFor="agency-driver" className="block text-sm font-medium text-ink-800">
              Driver
            </label>
            <Select
              id="agency-driver"
              className="h-12 text-base"
              value={params.get("driver") ?? ""}
              onChange={(event) => apply({ driver: event.currentTarget.value })}
            >
              <option value="">All drivers</option>
              {drivers.map((driver) => (
                <option key={driver} value={driver}>
                  {driver}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="secondary" size="lg" className="flex-1">
            Search
          </Button>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => router.push(basePath)}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
