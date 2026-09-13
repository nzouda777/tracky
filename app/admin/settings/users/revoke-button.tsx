"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { revokeMembershipAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/result";

export function RevokeButton({
  membershipId,
  email,
}: {
  membershipId: string;
  email: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    revokeMembershipAction,
    {},
  );

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="membershipId" value={membershipId} />
        <SubmitButton
          variant="danger"
          size="sm"
          pendingLabel="Removing…"
          aria-label={`Revoke access for ${email}`}
        >
          Revoke
        </SubmitButton>
      </form>
      {state.error ? (
        <Alert tone="danger" className="text-xs">
          {state.error}
        </Alert>
      ) : null}
    </div>
  );
}
