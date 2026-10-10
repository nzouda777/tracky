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
  defaultSubStageDelayHours,
  minDelayHours,
  maxDelayHours,
  emailsStartDate,
}: {
  settings: AutoAdvanceSettings | null;
  stages: Stage[];
  defaultDelayHours: number;
  defaultSubStageDelayHours: number;
  minDelayHours: number;
  maxDelayHours: number;
  /** The email start date currently in effect, as YYYY-MM-DD. */
  emailsStartDate: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateAutoAdvanceSettingsAction,
    {},
  );

  // The first stage is where orders start, so it can never be a destination.
  const destinations = stages.slice(1);

  return (
    <form action={formAction} className="space-y-8">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <fieldset className="space-y-5">
        <legend className="mb-3 text-sm font-semibold text-ink-900">
          Progression
        </legend>

        <Checkbox
          id="auto-advance-enabled"
          name="enabled"
          label="Move orders to the next stage automatically"
          description="When on, orders move along their stages on the delays below. Turn off to go back to agency and admin updates only."
          defaultChecked={settings?.enabled ?? false}
        />

        <Field
          label="Between sub-stages (hours)"
          htmlFor="auto-advance-sub-delay"
          hint="Time between two sub-stages of the same main stage, e.g. In Transit → Customs Processing."
        >
          <Input
            id="auto-advance-sub-delay"
            name="subStageDelayHours"
            type="number"
            inputMode="numeric"
            min={minDelayHours}
            max={maxDelayHours}
            step={1}
            required
            defaultValue={settings?.subStageDelayHours ?? defaultSubStageDelayHours}
            className="max-w-32"
          />
        </Field>

        <Field
          label="Before the next main stage (hours)"
          htmlFor="auto-advance-delay"
          hint="Once the last sub-stage of a main stage is reached, the order waits this long before entering the next main stage (Processing → In Transit → Delivered)."
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
      </fieldset>

      <fieldset className="space-y-5 border-t border-ink-200 pt-6">
        <legend className="mb-3 text-sm font-semibold text-ink-900">
          Emails
        </legend>

        <Checkbox
          id="emails-main-stages-only"
          name="emailsMainStagesOnly"
          label="Only email when an order enters a main stage"
          description="Emails attached to a main stage go out once, as the order enters it. Emails attached to sub-stages are not sent. Untick to send an email on any stage it is attached to."
          defaultChecked={settings?.emailsMainStagesOnly ?? true}
        />

        <Field
          label="Email orders placed from"
          htmlFor="emails-since"
          hint="Orders placed before this date still move along their stages, but their customers get no email. Clear it to use the day the store was connected."
        >
          <Input
            id="emails-since"
            name="emailsSince"
            type="date"
            defaultValue={emailsStartDate}
            className="max-w-48"
          />
        </Field>
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}
