"use client";

import { useActionState, useRef } from "react";

import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createStageAction } from "@/lib/actions/stages";
import type { ActionResult } from "@/lib/actions/result";
import { STAGE_ICONS } from "@/lib/stages/defaults";

export function NewStageForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (previous, formData) => {
      const result = await createStageAction(previous, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor="new-stage-name"
          error={state.fieldErrors?.name}
          required
        >
          <Input
            id="new-stage-name"
            name="name"
            placeholder="e.g. At local depot"
            required
          />
        </Field>

        <Field label="Colour" htmlFor="new-stage-color">
          <Input
            id="new-stage-color"
            name="color"
            type="color"
            defaultValue="#2563eb"
            className="h-10 w-20 p-1"
          />
        </Field>
      </div>

      <Field
        label="Customer-facing description"
        htmlFor="new-stage-description"
        hint="Optional. Shown under this stage on the tracking page."
      >
        <Textarea id="new-stage-description" name="description" rows={2} />
      </Field>

      <Field label="Icon" htmlFor="new-stage-icon">
        <Select id="new-stage-icon" name="icon" defaultValue="circle">
          {STAGE_ICONS.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink-800">Behaviour</legend>
        <Checkbox id="new-isTerminal" name="isTerminal" label="Terminal stage" />
        <Checkbox
          id="new-triggersFulfillment"
          name="triggersFulfillment"
          label="Triggers Shopify fulfillment"
          description="Only fires once the delivery agency has confirmed the delivery."
        />
        <Checkbox
          id="new-locksAddressEditing"
          name="locksAddressEditing"
          label="Locks address editing"
        />
      </fieldset>

      <SubmitButton pendingLabel="Adding…">Add stage</SubmitButton>
    </form>
  );
}
