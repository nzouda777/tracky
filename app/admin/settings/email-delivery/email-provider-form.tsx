"use client";

import { useActionState, useState } from "react";

import { Alert, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateEmailPrimaryProviderAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailProviderName } from "@/lib/email/providers/types";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: EmailProviderName; label: string; description: string }> = [
  {
    value: "resend",
    label: "Resend first, Postal as fallback",
    description: "The default. Postal takes over when Resend hits its rate limit or quota.",
  },
  {
    value: "postal",
    label: "Postal first, Resend as fallback",
    description: "Sends through our own Postal server, keeping Resend's quota in reserve.",
  },
];

export function EmailProviderForm({
  primary,
  configured,
}: {
  primary: EmailProviderName;
  configured: Record<EmailProviderName, boolean>;
}) {
  const [selected, setSelected] = useState(primary);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateEmailPrimaryProviderAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <fieldset className="space-y-3">
        <legend className="sr-only">Main email provider</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-control border px-4 py-3",
              selected === option.value
                ? "border-ink-900 bg-ink-50"
                : "border-line hover:bg-paper",
            )}
          >
            <input
              type="radio"
              name="primaryProvider"
              value={option.value}
              checked={selected === option.value}
              onChange={() => setSelected(option.value)}
              className="mt-1"
            />
            <span className="space-y-0.5">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                {option.label}
                {option.value === primary ? <Badge tone="info">current</Badge> : null}
                {!configured[option.value] ? (
                  <Badge tone="warning">not configured</Badge>
                ) : null}
              </span>
              <span className="block text-xs text-ink-500">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}
