"use client";

import { useActionState } from "react";

import { Alert, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { overrideStageAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";
import type { Stage } from "@/lib/db";

export function OverrideStageForm({
  orderId,
  stages,
  currentStageId,
}: {
  orderId: string;
  stages: Stage[];
  currentStageId: string | null;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    overrideStageAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Field
        label="Move to stage"
        htmlFor="override-stage"
        error={state.fieldErrors?.stageId}
        required
      >
        <Select
          id="override-stage"
          name="stageId"
          defaultValue={currentStageId ?? ""}
          required
        >
          <option value="" disabled>
            Choose a stage…
          </option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
              {stage.id === currentStageId ? " (current)" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Message to the customer"
        htmlFor="override-note"
        hint="Optional. Shown with this event on the tracking page."
      >
        <Textarea id="override-note" name="note" rows={3} />
      </Field>

      <SubmitButton pendingLabel="Updating…">Override stage</SubmitButton>

      <p className="text-xs text-ink-500">
        A stage marked as a fulfillment trigger still needs a confirmed delivery
        before anything is sent to Shopify.
      </p>
    </form>
  );
}
