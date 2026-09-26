"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { setStorePausedAction } from "@/lib/actions/stores";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Holds a store without disconnecting it.
 *
 * The label says which way the click goes, never the current state: a button
 * reading "Paused" is ambiguous about whether pressing it pauses or resumes.
 */
export function PauseStoreButton({
  storeId,
  shopDomain,
  paused,
}: {
  storeId: string;
  shopDomain: string;
  paused: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    setStorePausedAction,
    {},
  );

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="paused" value={paused ? "false" : "true"} />
        <SubmitButton
          variant={paused ? "primary" : "secondary"}
          size="sm"
          pendingLabel={paused ? "Resuming…" : "Pausing…"}
          aria-label={
            paused ? `Resume ${shopDomain}` : `Pause ${shopDomain}`
          }
        >
          {paused ? "Resume store" : "Pause store"}
        </SubmitButton>
      </form>
      {state.error ? (
        <Alert tone="danger" className="text-xs">
          {state.error}
        </Alert>
      ) : null}
      {state.ok && state.message ? (
        <Alert tone="success" className="text-xs">
          {state.message}
        </Alert>
      ) : null}
    </div>
  );
}
