"use client";

import { useActionState } from "react";

import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignDriverAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";

/** Driver assignment, sized for the phone. Drivers are labels, not accounts. */
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
        label="Driver"
        htmlFor="agency-driver-name"
        hint="Leave empty to unassign."
      >
        <Input
          id="agency-driver-name"
          name="driverName"
          className="h-12 text-base"
          defaultValue={currentDriver ?? ""}
          list="agency-known-drivers"
          placeholder="Driver name"
          autoComplete="off"
        />
      </Field>

      <datalist id="agency-known-drivers">
        {knownDrivers.map((driver) => (
          <option key={driver} value={driver} />
        ))}
      </datalist>

      <SubmitButton
        variant="secondary"
        size="lg"
        className="w-full"
        pendingLabel="Saving…"
      >
        Save driver
      </SubmitButton>
    </form>
  );
}
