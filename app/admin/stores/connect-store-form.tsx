"use client";

import { useActionState, useState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { connectStoreAction } from "@/lib/actions/stores";
import type { ActionResult } from "@/lib/actions/result";
import { parseShopInput } from "@/lib/shopify/parse-shop";

/**
 * Add-a-store field.
 *
 * It echoes the domain it resolved *before* submitting, so the merchant can see
 * that their pasted admin URL became the right `*.myshopify.com` host rather
 * than finding out after an OAuth round trip. The same parser runs again on the
 * server — this preview is a convenience, never the validation.
 */
export function ConnectStoreForm() {
  const [raw, setRaw] = useState("");
  const [state, formAction] = useActionState<ActionResult, FormData>(
    connectStoreAction,
    {},
  );

  const preview = raw.trim() ? parseShopInput(raw) : null;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field
        label="Store address"
        htmlFor="connect-shop"
        error={state.fieldErrors?.shop}
        hint="Any of these work: acme-supply, acme-supply.myshopify.com, or admin.shopify.com/store/acme-supply"
        required
      >
        <Input
          id="connect-shop"
          name="shop"
          value={raw}
          onChange={(event) => setRaw(event.currentTarget.value)}
          placeholder="acme-supply.myshopify.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          required
        />
      </Field>

      {preview ? (
        preview.ok ? (
          <p className="flex flex-wrap items-baseline gap-1.5 text-xs text-ink-600">
            <span>Will connect</span>
            <code className="rounded bg-ink-100 px-1.5 py-0.5 font-medium text-ink-800">
              {preview.shopDomain}
            </code>
          </p>
        ) : (
          <p className="text-xs text-amber-700">{preview.reason}</p>
        )
      ) : null}

      <SubmitButton
        size="lg"
        disabled={!preview?.ok}
        pendingLabel="Opening Shopify…"
      >
        Connect with Shopify
      </SubmitButton>

      <p className="text-xs text-ink-500">
        You will be taken to Shopify to approve the app. Approving requires admin
        rights on the store.
      </p>
    </form>
  );
}
