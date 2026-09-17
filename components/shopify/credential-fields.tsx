"use client";

import { Field, Input } from "@/components/ui";

/**
 * The credential half of every "which Shopify app does this store run on?"
 * form — used when adding a store and again when rotating its keys, so the two
 * never drift apart in wording or in the names they post.
 */

export type AuthMode = "oauth" | "custom";

const MODES: Array<{
  value: AuthMode;
  title: string;
  description: string;
}> = [
  {
    value: "oauth",
    title: "Partner app",
    description:
      "Created in your Shopify Partner dashboard. The merchant approves it; Shopify issues the token.",
  },
  {
    value: "custom",
    title: "Custom app",
    description:
      "Created inside the store under Settings → Apps → Develop apps. You paste its Admin API token.",
  },
];

export function AuthModePicker({
  value,
  onChange,
}: {
  value: AuthMode;
  onChange: (value: AuthMode) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Kind of Shopify app</legend>
      <input type="hidden" name="authMode" value={value} />

      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((mode) => {
          const selected = mode.value === value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              aria-pressed={selected}
              className={`rounded-card border px-3 py-2.5 text-left transition ${
                selected
                  ? "border-ink-900 bg-white shadow-sm"
                  : "border-ink-200 bg-white/50 hover:border-ink-300"
              }`}
            >
              <span className="block text-sm font-medium text-ink-900">
                {mode.title}
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                {mode.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CredentialFields({
  mode,
  fieldErrors,
  idPrefix,
  optionalHint,
  secretPlaceholder,
  tokenHint,
}: {
  mode: AuthMode;
  fieldErrors?: Record<string, string>;
  /** Keeps ids unique when two of these appear on one page. */
  idPrefix: string;
  /** Shown under the key fields when they may legitimately be left blank. */
  optionalHint?: string;
  /** e.g. "Leave blank to keep the current secret." */
  secretPlaceholder?: string;
  tokenHint?: string;
}) {
  const oauth = mode === "oauth";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={oauth ? "Client ID" : "API key"}
          htmlFor={`${idPrefix}-api-key`}
          error={fieldErrors?.apiKey}
          hint={optionalHint}
        >
          <Input
            id={`${idPrefix}-api-key`}
            name="apiKey"
            placeholder="0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>

        <Field
          label={oauth ? "Client secret" : "API secret key"}
          htmlFor={`${idPrefix}-api-secret`}
          error={fieldErrors?.apiSecret}
          hint={
            secretPlaceholder ??
            "Verifies every webhook and tracking-page request from this store."
          }
        >
          <Input
            id={`${idPrefix}-api-secret`}
            name="apiSecret"
            type="password"
            placeholder="••••••••••••••••••••"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>
      </div>

      {!oauth ? (
        <Field
          label="Admin API access token"
          htmlFor={`${idPrefix}-access-token`}
          error={fieldErrors?.accessToken}
          hint={
            tokenHint ??
            "Revealed once, on the app's API credentials tab. It is stored encrypted."
          }
        >
          <Input
            id={`${idPrefix}-access-token`}
            name="accessToken"
            type="password"
            placeholder="shpat_••••••••••••••••••••"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>
      ) : null}

      <details className="text-xs text-ink-500">
        <summary className="cursor-pointer">
          This app uses different scopes or API version
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Scopes"
            htmlFor={`${idPrefix}-scopes`}
            error={fieldErrors?.scopes}
            hint={
              oauth
                ? "Requested at install. Must match the app's configuration."
                : "Recorded for reference; a custom app's scopes are set in its own admin."
            }
          >
            <Input
              id={`${idPrefix}-scopes`}
              name="scopes"
              placeholder="read_orders,write_orders,read_fulfillments,write_fulfillments"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Admin API version"
            htmlFor={`${idPrefix}-api-version`}
            error={fieldErrors?.apiVersion}
            hint="Leave blank to use the platform default."
          >
            <Input
              id={`${idPrefix}-api-version`}
              name="apiVersion"
              placeholder="2025-07"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
