"use client";

import { useActionState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignDriverAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";

export function AssignDriverForm({
  orderId,
  currentDriver,
  knownDrivers,
}: {
  orderId: string;
  currentDriver: string | null;
  knownDrivers: string[];
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    assignDriverAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Field
        label="Driver name"
        htmlFor="driver-name"
        hint="Leave empty to clear the assignment."
      >
        <Input
          id="driver-name"
          name="driverName"
          defaultValue={currentDriver ?? ""}
          list="known-drivers"
          placeholder="e.g. Dave M."
          autoComplete="off"
        />
      </Field>

      {/* Previously used labels, so dispatch keeps spelling them the same way. */}
      <datalist id="known-drivers">
        {knownDrivers.map((driver) => (
          <option key={driver} value={driver} />
        ))}
      </datalist>

      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Save driver
      </SubmitButton>
    </form>
  );
}
