"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { seedDefaultStagesAction } from "@/lib/actions/stages";
import type { ActionResult } from "@/lib/actions/result";

/** Offered only when a store has no stages at all, so nothing can be clobbered. */
export function RestoreDefaultsForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async () => seedDefaultStagesAction(),
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <SubmitButton variant="secondary" size="sm" pendingLabel="Restoring…">
        Restore the default stages
      </SubmitButton>
    </form>
  );
}
