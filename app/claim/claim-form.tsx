"use client";

import { useActionState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { claimStoreAction, type ClaimState } from "./actions";

export function ClaimForm({
  signedInEmail,
  shopDomain,
}: {
  signedInEmail: string | null;
  shopDomain: string;
}) {
  const [state, formAction] = useActionState<ClaimState, FormData>(
    claimStoreAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {signedInEmail ? (
        <Alert tone="info">
          You are signed in as <strong>{signedInEmail}</strong>. Continuing will
          make this account the owner of <strong>{shopDomain}</strong>.
        </Alert>
      ) : (
        <>
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" />
          </Field>

          <Field label="Email address" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 10 characters, with upper and lower case letters and a number."
            required
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field label="Confirm password" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
        </>
      )}

      <SubmitButton className="w-full" size="lg" pendingLabel="Setting up…">
        {signedInEmail ? "Link this store" : "Create owner account"}
      </SubmitButton>
    </form>
  );
}
