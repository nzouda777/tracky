"use client";

import { useActionState } from "react";

import { Alert, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { retryEmailSendAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailSend } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

type Row = { send: EmailSend; templateName: string | null };

const TONES = {
  sent: "success",
  scheduled: "info",
  failed: "danger",
  skipped: "neutral",
} as const;

export function EmailLog({ sends }: { sends: Row[] }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    retryEmailSendAction,
    {},
  );

  if (sends.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No email has been scheduled for this order yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <ul className="divide-y divide-ink-100">
        {sends.map(({ send, templateName }) => (
          <li key={send.id} className="flex flex-wrap items-start gap-3 py-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink-900">
                  {templateName ?? "Deleted template"}
                </p>
                <Badge tone={TONES[send.status]}>{send.status}</Badge>
                {send.sequenceStepId === null ? (
                  <Badge tone="neutral">manual</Badge>
                ) : null}
              </div>
              <p className="text-xs text-ink-500">
                To {send.toEmail} ·{" "}
                {send.sentAt
                  ? `sent ${formatDateTime(send.sentAt)}`
                  : `due ${formatDateTime(send.scheduledFor)}`}
              </p>
              {send.error ? (
                <p className="text-xs text-red-600">{send.error}</p>
              ) : null}
            </div>

            {send.status === "failed" || send.status === "skipped" ? (
              <form action={formAction}>
                <input type="hidden" name="sendId" value={send.id} />
                <SubmitButton variant="secondary" size="sm" pendingLabel="Sending…">
                  Send now
                </SubmitButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
