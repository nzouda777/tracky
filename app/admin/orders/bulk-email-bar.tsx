"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Alert, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendTemplateToOrdersAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailTemplate } from "@/lib/db";

/**
 * Wraps the orders table in a form so the row checkboxes (named `orderIds`)
 * drive a bulk send, and keeps a live count of the selection.
 *
 * Sending one email is the same action with a single row ticked, which keeps
 * one code path — and one `email_sends` log shape — for both.
 */
export function BulkEmailBar({
  templates,
  orderIds,
  children,
}: {
  templates: EmailTemplate[];
  orderIds: string[];
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [state, formAction] = useActionState<ActionResult, FormData>(
    sendTemplateToOrdersAction,
    {},
  );

  // Recount whenever the rows change (filters, pagination, a completed send).
  useEffect(() => {
    setSelected(countSelected(formRef.current));
  }, [orderIds]);

  function toggleAll(checked: boolean) {
    const form = formRef.current;
    if (!form) return;
    for (const input of boxes(form)) input.checked = checked;
    setSelected(countSelected(form));
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={() => setSelected(countSelected(formRef.current))}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            className="size-4 rounded border-ink-300"
            onChange={(event) => toggleAll(event.currentTarget.checked)}
            aria-label="Select all orders on this page"
          />
          Select all
        </label>

        <span className="text-sm text-ink-500">
          {selected === 0
            ? "No orders selected"
            : `${selected} order${selected === 1 ? "" : "s"} selected`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor="bulk-template" className="sr-only">
            Email template
          </label>
          <Select
            id="bulk-template"
            name="templateId"
            className="max-w-60"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Choose an email template…
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          <SubmitButton
            size="sm"
            disabled={selected === 0 || templates.length === 0}
            pendingLabel="Sending…"
          >
            Send email
          </SubmitButton>
        </div>
      </div>

      {state.error ? (
        <div className="px-4 pt-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
      {state.ok ? (
        <div className="px-4 pt-3">
          <Alert tone="success">{state.message}</Alert>
        </div>
      ) : null}
      {templates.length === 0 ? (
        <div className="px-4 pt-3">
          <Alert tone="warning">
            No active email templates yet. Create one under Email templates to
            send mail from here.
          </Alert>
        </div>
      ) : null}

      {children}
    </form>
  );
}

function boxes(form: HTMLFormElement): HTMLInputElement[] {
  return Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="orderIds"]'),
  );
}

function countSelected(form: HTMLFormElement | null): number {
  if (!form) return 0;
  return boxes(form).filter((input) => input.checked).length;
}
