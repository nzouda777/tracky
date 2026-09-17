"use client";

import { useActionState, useState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  AuthModePicker,
  CredentialFields,
  type AuthMode,
} from "@/components/shopify/credential-fields";
import { setStoreCredentialsAction } from "@/lib/actions/platform";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Operator-side replacement of the Shopify app a store runs on.
 *
 * Distinct from the owner's own form only in reach and in the audit row it
 * leaves — which is why the reason field is here and not there.
 */
export function PlatformStoreCredentialsForm({
  storeId,
  shopDomain,
  currentMode,
}: {
  storeId: string;
  shopDomain: string;
  currentMode: AuthMode;
}) {
  const [mode, setMode] = useState<AuthMode>(currentMode);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    setStoreCredentialsAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <AuthModePicker value={mode} onChange={setMode} />

      <CredentialFields
        mode={mode}
        fieldErrors={state.fieldErrors}
        idPrefix={`platform-${storeId}`}
        tokenHint="Only needed when the token itself changed."
      />

      <Field
        label="Reason"
        htmlFor={`platform-${storeId}-reason`}
        error={state.fieldErrors?.reason}
        hint="Recorded in the audit log next to your email."
      >
        <Input
          id={`platform-${storeId}-reason`}
          name="reason"
          placeholder="Rotating a leaked secret / moving off an app at its install limit"
          autoComplete="off"
        />
      </Field>

      <SubmitButton size="sm" pendingLabel="Saving…">
        Replace app keys
      </SubmitButton>

      <p className="text-xs text-ink-500">
        The secret key is what every webhook and tracking-page request from{" "}
        {shopDomain} is verified against. Replacing it takes effect on the next
        request.
      </p>
    </form>
  );
}
