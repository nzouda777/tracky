"use client";

import { useActionState, useRef } from "react";

import { Alert, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSequenceStepAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailTemplate, Stage } from "@/lib/db";
import { TriggerFields } from "./trigger-fields";

export function NewStepForm({
  templates,
  stages,
}: {
  templates: EmailTemplate[];
  stages: Stage[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (previous, formData) => {
      const result = await createSequenceStepAction(previous, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Field
        label="Template"
        htmlFor="new-step-template"
        error={state.fieldErrors?.templateId}
        required
      >
        <Select id="new-step-template" name="templateId" defaultValue="" required>
          <option value="" disabled>
            Choose a template…
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
              {template.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </Select>
      </Field>

      <TriggerFields
        idPrefix="new-step"
        stages={stages}
        errors={state.fieldErrors}
      />

      <SubmitButton disabled={templates.length === 0} pendingLabel="Adding…">
        Add step
      </SubmitButton>
    </form>
  );
}
