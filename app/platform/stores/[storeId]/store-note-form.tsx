"use client";

import { useActionState } from "react";

import { Alert, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateStoreNoteAction } from "@/lib/actions/platform";
import type { ActionResult } from "@/lib/actions/result";

export function StoreNoteForm({
  storeId,
  note,
}: {
  storeId: string;
  note: string | null;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateStoreNoteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Textarea
        name="internalNote"
        rows={3}
        defaultValue={note ?? ""}
        placeholder="Context for whoever picks this store up next — a support thread, a billing arrangement, a known quirk."
      />

      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Save note
      </SubmitButton>
    </form>
  );
}
