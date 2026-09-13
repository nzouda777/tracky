"use client";

import { useActionState, useRef } from "react";

import { Alert, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createTemplateAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";

const STARTER_BODY = `<p>Hi {{customer_name}},</p>
<p>Here is an update on order <strong>{{order_number}}</strong>.</p>
<p>Current status: {{current_stage}}</p>
<p><a href="{{tracking_link}}">Track your order</a></p>
<p>— {{store_name}}</p>`;

export function NewTemplateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (previous, formData) => {
      const result = await createTemplateAction(previous, formData);
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
          label="Template name"
          htmlFor="template-name"
          hint="Internal only — customers never see it."
          error={state.fieldErrors?.name}
          required
        >
          <Input id="template-name" name="name" required />
        </Field>

        <Field
          label="Preview text"
          htmlFor="template-preview-text"
          hint="The snippet shown next to the subject in an inbox."
        >
          <Input id="template-preview-text" name="previewText" />
        </Field>
      </div>

      <Field
        label="Subject"
        htmlFor="template-subject"
        error={state.fieldErrors?.subject}
        required
      >
        <Input
          id="template-subject"
          name="subject"
          defaultValue="Update on order {{order_number}}"
          required
        />
      </Field>

      <Field
        label="Body"
        htmlFor="template-body"
        hint="HTML with merge variables. It is wrapped in your store's branding when sent."
        error={state.fieldErrors?.body}
        required
      >
        <Textarea
          id="template-body"
          name="body"
          rows={8}
          defaultValue={STARTER_BODY}
          className="font-mono text-xs"
          required
        />
      </Field>

      <Checkbox
        id="template-active"
        name="isActive"
        label="Active"
        description="Inactive templates are never sent, by a sequence or by hand."
        defaultChecked
      />

      <SubmitButton pendingLabel="Creating…">Create template</SubmitButton>
    </form>
  );
}
