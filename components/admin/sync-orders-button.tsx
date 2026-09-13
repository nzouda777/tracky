"use client";

import { useActionState, useState } from "react";

import { Alert, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { syncOrdersAction } from "@/lib/actions/sync";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Manual order sync.
 *
 * Two shapes: `compact` is the button that sits in the Orders toolbar, and the
 * full form carries the time window and an explanation of when to reach for
 * it. Both call the same action.
 */
export function SyncOrdersButton({
  compact,
  lastOrderLabel,
}: {
  compact?: boolean;
  lastOrderLabel?: string | null;
}) {
  const [days, setDays] = useState("7");
  const [state, formAction] = useActionState<ActionResult, FormData>(
    syncOrdersAction,
    {},
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="sinceDays" value="7" />
          <SubmitButton
            variant="secondary"
            size="sm"
            pendingLabel="Syncing…"
            title="Pull recent orders from Shopify, in case a webhook was missed"
          >
            Sync orders
          </SubmitButton>
        </form>
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <p className="text-sm text-ink-600">
        Orders normally arrive the instant Shopify sends a webhook. Use this
        when that did not happen — orders placed before you installed the app,
        a webhook missed during an outage, or a store you have just
        reconnected.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor="sync-since"
            className="block text-sm font-medium text-ink-800"
          >
            Look back
          </label>
          <Select
            id="sync-since"
            name="sinceDays"
            value={days}
            onChange={(event) => setDays(event.currentTarget.value)}
            className="w-44"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
          </Select>
        </div>

        <SubmitButton pendingLabel="Syncing…">Sync now</SubmitButton>
      </div>

      <p className="text-xs text-ink-500">
        {lastOrderLabel
          ? `Most recent order held: ${lastOrderLabel}. `
          : "No orders held yet. "}
        Existing orders only have their Shopify details refreshed — their
        stage, history and delivery confirmation are never overwritten.
        Shopify does not return orders older than 60 days.
      </p>
    </form>
  );
}
