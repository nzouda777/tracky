"use client";

import { useActionState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInviteAction, type InviteState } from "./actions";

export function InviteForm({
  token,
  hasPassword,
}: {
  token: string;
  hasPassword: boolean;
}) {
  const [state, formAction] = useActionState<InviteState, FormData>(
    acceptInviteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {hasPassword ? (
        <Field
          label="Your Tracky password"
          htmlFor="invite-password"
          hint="You already have an account, so confirm it is you."
          required
        >
          <Input
            id="invite-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
      ) : (
        <>
          <Field
            label="Choose a password"
            htmlFor="invite-password"
            hint="At least 10 characters, with upper and lower case letters and a number."
            required
          >
            <Input
              id="invite-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm password" htmlFor="invite-confirm" required>
            <Input
              id="invite-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
        </>
      )}

      <SubmitButton className="w-full" size="lg" pendingLabel="Joining…">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
