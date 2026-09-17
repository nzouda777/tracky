"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateStoreCredentialsAction } from "@/lib/actions/stores";
import type { ActionResult } from "@/lib/actions/result";
import { AuthModePicker, CredentialFields, type AuthMode } from "@/components/shopify/credential-fields";

/**
 * Moves one store onto a different Shopify app, or rotates the keys of the one
 * it is on.
 *
 * The two reasons this exists: a secret leaked, or the app this store sits on
 * has reached its install ceiling and the store has to move to another. Both
 * are per store, which is exactly why the keys live on the store row rather
 * than in the deployment's environment.
 */
export function StoreCredentialsForm({
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
    updateStoreCredentialsAction,
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
        idPrefix={`rotate-${storeId}`}
        tokenHint="Only needed when the token itself changed. The store reconnects as soon as Shopify accepts it."
      />

      <SubmitButton size="sm" pendingLabel="Saving…">
        Save app keys
      </SubmitButton>

      <p className="text-xs text-ink-500">
        {mode === "oauth"
          ? `Switching ${shopDomain} to another Partner app does not move its token. Use Reconnect afterwards so Shopify issues one for the new app.`
          : `The token is checked against ${shopDomain} before anything is saved.`}
      </p>
    </form>
  );
}
