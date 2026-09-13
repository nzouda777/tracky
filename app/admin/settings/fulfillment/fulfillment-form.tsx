"use client";

import { useActionState, useState } from "react";

import { Alert, Checkbox } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateFulfillmentRulesAction } from "@/lib/actions/settings";
import type { ActionResult } from "@/lib/actions/result";
import type { FulfillmentRules } from "@/lib/db";

export function FulfillmentForm({ rules }: { rules: FulfillmentRules | null }) {
  const [requireProof, setRequireProof] = useState(
    rules?.requireDeliveryConfirmation ?? true,
  );
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateFulfillmentRulesAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Checkbox
        id="fulfillment-enabled"
        name="enabled"
        label="Fulfil orders in Shopify automatically"
        description="Turn off to keep tracking in this app without touching Shopify fulfillment."
        defaultChecked={rules?.enabled ?? true}
      />

      <Checkbox
        id="fulfillment-require-proof"
        name="requireDeliveryConfirmation"
        label="Require a confirmed delivery before fulfilling"
        description="Strongly recommended. The delivery agency records the delivery after the customer signs the paper note."
        checked={requireProof}
        onChange={(event) => setRequireProof(event.currentTarget.checked)}
      />

      {!requireProof ? (
        <Alert tone="danger" title="Fulfilment without proof of delivery">
          With this off, reaching the trigger stage fulfils the order in Shopify
          even if nobody has confirmed the parcel was handed over. Only do this
          if you fulfil by some other verified process.
        </Alert>
      ) : null}

      <Checkbox
        id="fulfillment-notify"
        name="notifyCustomerOnFulfillment"
        label="Let Shopify email its own shipping confirmation"
        description="Off by default, because this app already emails the customer at every stage."
        defaultChecked={rules?.notifyCustomerOnFulfillment ?? false}
      />

      <SubmitButton pendingLabel="Saving…">Save rules</SubmitButton>
    </form>
  );
}
