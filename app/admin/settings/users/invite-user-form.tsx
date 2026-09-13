"use client";

import { useActionState, useRef } from "react";

import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { inviteUserAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/result";

export function InviteUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (previous, formData) => {
      const result = await inviteUserAction(previous, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? (
        <Alert tone="success">
          <span className="break-all">{state.message}</span>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email address"
          htmlFor="invite-email"
          error={state.fieldErrors?.email}
          required
        >
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>

        <Field label="Name" htmlFor="invite-name" hint="Optional.">
          <Input id="invite-name" name="name" />
        </Field>
      </div>

      <Field
        label="Role"
        htmlFor="invite-role"
        error={state.fieldErrors?.role}
        required
      >
        <Select id="invite-role" name="role" defaultValue="agency">
          <option value="agency">Agency — dispatch and deliveries</option>
          <option value="owner">Owner — full access to this store</option>
        </Select>
      </Field>

      <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
    </form>
  );
}
