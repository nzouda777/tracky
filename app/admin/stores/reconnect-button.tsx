"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { reconnectStoreAction } from "@/lib/actions/stores";
import type { ActionResult } from "@/lib/actions/result";

/** Re-runs the install flow for a store, to refresh a revoked token or scopes. */
export function ReconnectButton({
  storeId,
  shopDomain,
  subtle,
}: {
  storeId: string;
  shopDomain: string;
  subtle?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    reconnectStoreAction,
    {},
  );

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="storeId" value={storeId} />
        <SubmitButton
          variant={subtle ? "ghost" : "secondary"}
          size="sm"
          pendingLabel="Opening Shopify…"
          aria-label={`Reconnect ${shopDomain}`}
        >
          Reconnect
        </SubmitButton>
      </form>
      {state.error ? (
        <Alert tone="danger" className="text-xs">
          {state.error}
        </Alert>
      ) : null}
    </div>
  );
}
