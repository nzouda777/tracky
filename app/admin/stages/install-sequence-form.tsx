"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { installFullSequenceAction } from "@/lib/actions/stages";
import type { ActionResult } from "@/lib/actions/result";
import { DEFAULT_STAGES } from "@/lib/stages/defaults";

/**
 * Installs the full default delivery sequence on a store that already has
 * stages. Existing stages keep their ids (and so their history); custom ones
 * are left alone.
 */
export function InstallSequenceForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async () => installFullSequenceAction(),
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <SubmitButton variant="secondary" size="sm" pendingLabel="Installing…">
        Install the full {DEFAULT_STAGES.length}-step sequence
      </SubmitButton>
    </form>
  );
}
