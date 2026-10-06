"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createHoomaTemplateSetAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";

/** Adds the four ready-made Hooma templates to the store. */
export function HoomaSetForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    createHoomaTemplateSetAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      <p className="text-sm text-ink-600">
        Order confirmation (green tick), Processing, Out for delivery (blue
        parcel) and Delivered, all in the Hooma design. They are added inactive;
        every text, colour and section can be edited.
      </p>
      <SubmitButton pendingLabel="Adding…">Add the Hooma templates</SubmitButton>
    </form>
  );
}
