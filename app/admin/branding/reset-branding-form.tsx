"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetBrandingAction } from "@/lib/actions/branding";
import type { ActionResult } from "@/lib/actions/result";

/** Puts this store's branding back to the shipped defaults. */
export function ResetBrandingForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async () => resetBrandingAction(),
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <SubmitButton variant="secondary" size="sm" pendingLabel="Resetting…">
        Reset to defaults
      </SubmitButton>
      <p className="text-xs text-ink-500">
        Colours, copy and FAQ go back to the shipped defaults. Your logo file is
        not deleted, but the page stops using it.
      </p>
    </form>
  );
}
