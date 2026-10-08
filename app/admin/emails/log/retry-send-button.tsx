"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { retryEmailSendAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";

/** Re-dispatches one failed or skipped send, reporting the outcome inline. */
export function RetrySendButton({ sendId }: { sendId: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    retryEmailSendAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="sendId" value={sendId} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…">
        Send now
      </SubmitButton>
      {state.error ? (
        <p className="max-w-56 text-right text-xs text-red-600">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-xs text-emerald-700">{state.message}</p>
      ) : null}
    </form>
  );
}
