"use client";

import { useActionState, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { fulfillAllOpenOrdersAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Fulfils every open order in Shopify. A write into the merchant's own admin
 * that cannot be undone from here, so it asks once more before running.
 */
export function FulfillAllButton({ openCount }: { openCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async () => {
      const result = await fulfillAllOpenOrdersAction();
      setConfirming(false);
      return result;
    },
    {},
  );

  const label = `Fulfil all open orders (${openCount})`;

  return (
    <div className="space-y-2">
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-700">
            Mark {openCount} order{openCount === 1 ? "" : "s"} fulfilled in Shopify?
          </span>
          <SubmitButton size="sm" pendingLabel="Fulfilling…">
            Yes, fulfil them
          </SubmitButton>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          disabled={openCount === 0}
          onClick={() => setConfirming(true)}
          title="Push a Shopify fulfillment, with its tracking link, for every order not fulfilled yet"
        >
          {openCount === 0 ? "All orders fulfilled" : label}
        </Button>
      )}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
    </div>
  );
}
