"use client";

import { useActionState, useState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { connectStoreAction } from "@/lib/actions/stores";
import type { ActionResult } from "@/lib/actions/result";
import { parseShopInput } from "@/lib/shopify/parse-shop";
import { AuthModePicker, CredentialFields, type AuthMode } from "@/components/shopify/credential-fields";

/**
 * Add-a-store form: the shop, and the Shopify app it will run on.
 *
 * The app is part of adding a store, not a deployment-wide setting, because a
 * single public app cannot be installed on unlimited stores — distributing
 * across stores means distributing across apps. Each store therefore carries
 * its own keys, and nothing here needs a redeploy.
 *
 * The domain preview echoes what was resolved *before* submitting, so a pasted
 * admin URL is visibly the right `*.myshopify.com` host rather than something
 * discovered after an OAuth round trip. The same parser runs again on the
 * server — this preview is a convenience, never the validation.
 */
export function ConnectStoreForm({
  callbackUrl,
  platformAppConfigured,
}: {
  callbackUrl: string;
  /** True while this deployment still has SHOPIFY_API_KEY/SECRET set. */
  platformAppConfigured: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<AuthMode>("oauth");
  const [state, formAction] = useActionState<ActionResult, FormData>(
    connectStoreAction,
    {},
  );

  const preview = raw.trim() ? parseShopInput(raw) : null;

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? (
        <Alert tone={state.ok ? "warning" : "danger"}>{state.message}</Alert>
      ) : null}

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

      <div className="space-y-4 rounded-card border border-ink-200 bg-ink-50/60 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink-900">
            Shopify app for this store
          </p>
          <p className="text-xs text-ink-500">
            Each store runs on its own app, so one app hitting its install limit
            never blocks the next store.
          </p>
        </div>

        <AuthModePicker value={mode} onChange={setMode} />

        <CredentialFields
          mode={mode}
          fieldErrors={state.fieldErrors}
          idPrefix="connect"
          optionalHint={
            platformAppConfigured && mode === "oauth"
              ? "Leave both blank to use the app configured for this deployment."
              : undefined
          }
        />
      </div>

      <SubmitButton
        size="lg"
        disabled={!preview?.ok}
        pendingLabel={mode === "oauth" ? "Opening Shopify…" : "Checking the token…"}
      >
        {mode === "oauth" ? "Connect with Shopify" : "Connect with this token"}
      </SubmitButton>

      {mode === "oauth" ? (
        <p className="text-xs text-ink-500">
          You will be taken to Shopify to approve the app. Approving requires
          admin rights on the store.
        </p>
      ) : (
        <p className="text-xs text-ink-500">
          Nothing opens: the token is checked against Shopify and the store is
          connected straight away.
        </p>
      )}

      {/* Shopify rejects the install before it ever reaches us when this URL is
          not on the app's allowlist, so the merchant sees an error we cannot
          annotate. Showing the exact string here is the only place we can put
          it in front of them beforehand. */}
      {mode === "oauth" ? (
        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer">
            Shopify says the redirect URI is not whitelisted?
          </summary>
          <p className="mt-2">
            Add this to <strong>Allowed redirection URL(s)</strong> in the
            app&rsquo;s Partner dashboard configuration, exactly as written:
          </p>
          <code className="mt-1.5 block break-all rounded-control bg-ink-100 px-2 py-1.5 font-medium text-ink-800">
            {callbackUrl}
          </code>
          <p className="mt-2">
            It is the same URL for every app you add here, so each new app needs
            this line once. An app created inside a store under{" "}
            <em>Develop apps</em> has no such field — use the custom app option
            above for those.
          </p>
        </details>
      ) : null}
    </form>
  );
}
