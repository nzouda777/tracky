"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { retryFulfillmentAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";

export function RetryFulfillmentForm({
  orderId,
  disabled,
}: {
  orderId: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    retryFulfillmentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <SubmitButton
        variant="secondary"
        size="sm"
        disabled={disabled}
        pendingLabel="Retrying…"
      >
        {disabled ? "Already fulfilled" : "Retry fulfillment"}
      </SubmitButton>
    </form>
  );
}
