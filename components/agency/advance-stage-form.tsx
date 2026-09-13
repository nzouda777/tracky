"use client";

import { useActionState } from "react";

import { Alert, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { advanceStageAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";
import type { Stage } from "@/lib/db";

export function AdvanceStageForm({
  orderId,
  stages,
  currentStageId,
  disabled,
}: {
  orderId: string;
  stages: Stage[];
  currentStageId: string | null;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    advanceStageAction,
    {},
  );

  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);
  const nextStage = currentIndex >= 0 ? stages[currentIndex + 1] : stages[0];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Field
        label="New status"
        htmlFor="advance-stage"
        error={state.fieldErrors?.stageId}
        required
      >
        <Select
          id="advance-stage"
          name="stageId"
          className="h-12 text-base"
          defaultValue={nextStage?.id ?? ""}
          required
          disabled={disabled}
        >
          <option value="" disabled>
            Choose a status…
          </option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
              {stage.id === currentStageId ? " (current)" : ""}
              {stage.isTerminal ? " — use Mark as delivered" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Message to the customer"
        htmlFor="advance-note"
        hint="Optional. Shown on their tracking page with this update."
      >
        <Textarea
          id="advance-note"
          name="note"
          rows={3}
          className="text-base"
          placeholder="e.g. Running about 30 minutes behind, still arriving today."
          disabled={disabled}
        />
      </Field>

      <SubmitButton
        size="lg"
        className="w-full"
        disabled={disabled}
        pendingLabel="Updating…"
      >
        Save update
      </SubmitButton>
    </form>
  );
}
