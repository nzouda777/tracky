"use client";

import { useActionState } from "react";

import { Alert, Checkbox, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateAutoAdvanceSettingsAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/result";
import type { AutoAdvanceSettings, Stage } from "@/lib/db";

export function AutoAdvanceForm({
  settings,
  stages,
  defaultDelayHours,
  minDelayHours,
  maxDelayHours,
}: {
  settings: AutoAdvanceSettings | null;
  stages: Stage[];
  defaultDelayHours: number;
  minDelayHours: number;
  maxDelayHours: number;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateAutoAdvanceSettingsAction,
    {},
  );

  // The first stage is where orders start, so it can never be a destination.
  const destinations = stages.slice(1);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Checkbox
        id="auto-advance-enabled"
        name="enabled"
        label="Move orders to the next stage automatically"
        description="When on, an order that has had no update for the delay below moves on by one stage. Turn off to go back to agency and admin updates only."
        defaultChecked={settings?.enabled ?? false}
      />

      <Field
        label="Delay (hours)"
        htmlFor="auto-advance-delay"
        hint="Counted from the order's last recorded update. Any agency or admin update restarts it."
      >
        <Input
          id="auto-advance-delay"
          name="delayHours"
          type="number"
          inputMode="numeric"
          min={minDelayHours}
          max={maxDelayHours}
          step={1}
          required
          defaultValue={settings?.delayHours ?? defaultDelayHours}
          className="max-w-32"
        />
      </Field>

      <Field
        label="Stop at stage"
        htmlFor="auto-advance-stop"
        hint="Auto-advance never moves an order beyond this stage. Later stages are left to the agency."
      >
        <Select
          id="auto-advance-stop"
          name="stopAtStageId"
          defaultValue={settings?.stopAtStageId ?? ""}
        >
          <option value="">The final stage (all the way)</option>
          {destinations.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}
