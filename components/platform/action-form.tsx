"use client";

import { useActionState, useState } from "react";

import { Alert, Button, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/actions/result";

type Action = (
  previous: ActionResult,
  formData: FormData,
) => Promise<ActionResult>;

/**
 * A single operator command, with its confirmation step.
 *
 * Every action in `/platform` reaches across a tenant boundary, so none of
 * them fire on one click. Pressing the button opens an inline panel that
 * states what will happen, collects the reason that goes into the audit log,
 * and — for the destructive ones — requires the target to be typed out.
 *
 * The confirmation lives here rather than in a `window.confirm` so it can
 * carry that context; a native dialog cannot explain what "disconnect" means.
 */
export function PlatformActionForm({
  action,
  label,
  title,
  description,
  hidden,
  variant = "secondary",
  size = "sm",
  requireReason,
  confirmPhrase,
  confirmLabel,
  disabled,
}: {
  action: Action;
  /** Text on the trigger button. */
  label: string;
  /** Heading of the confirmation panel. */
  title: string;
  description: string;
  /** Fields submitted with the action, e.g. the target id. */
  hidden: Record<string, string>;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  requireReason?: boolean;
  /** When set, the operator must type this exactly to proceed. */
  confirmPhrase?: string;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.ok) {
        setOpen(false);
        setTyped("");
      }
      return result;
    },
    {},
  );

  if (!open) {
    return (
      <div className="space-y-1.5">
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
        {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      </div>
    );
  }

  const phraseMatches = !confirmPhrase || typed === confirmPhrase;

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-ink-300 bg-ink-50 p-3"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="mt-0.5 text-xs text-ink-600">{description}</p>
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {requireReason ? (
        <div className="space-y-1">
          <label
            htmlFor={`reason-${label}`}
            className="block text-xs font-medium text-ink-800"
          >
            Reason (recorded in the audit log)
          </label>
          <Textarea
            id={`reason-${label}`}
            name="reason"
            rows={2}
            className="text-sm"
            required
          />
          {state.fieldErrors?.reason ? (
            <p className="text-xs font-medium text-red-600">
              {state.fieldErrors.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {confirmPhrase ? (
        <div className="space-y-1">
          <label
            htmlFor={`confirm-${label}`}
            className="block text-xs font-medium text-ink-800"
          >
            {confirmLabel ?? "Type"}{" "}
            <code className="rounded bg-white px-1 py-0.5 text-[11px]">
              {confirmPhrase}
            </code>{" "}
            to confirm
          </label>
          <Input
            id={`confirm-${label}`}
            name="confirm"
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
            autoComplete="off"
            spellCheck={false}
            className="text-sm"
          />
          {state.fieldErrors?.confirm ? (
            <p className="text-xs font-medium text-red-600">
              {state.fieldErrors.confirm}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <SubmitButton
          variant={variant === "ghost" ? "secondary" : variant}
          size="sm"
          disabled={!phraseMatches}
          pendingLabel="Working…"
        >
          {label}
        </SubmitButton>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="text-xs font-medium text-ink-600 underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
