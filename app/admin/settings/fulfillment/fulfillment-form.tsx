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
        description={`Each new order is marked fulfilled in Shopify with its tracking link as soon as it arrives, and retried on every stage change until it goes through. Orders placed before ${rules ? `${new Date(rules.autoFulfillSince).toISOString().slice(0, 16).replace("T", " ")} UTC` : "this was switched on"} are left for you to fulfil by hand. Turning this off and on again starts from that moment.`}
        defaultChecked={rules?.enabled ?? true}
      />

      <Checkbox
        id="fulfillment-require-proof"
        name="requireDeliveryConfirmation"
        label="Require a confirmed delivery to retry an older order at the trigger stage"
        description={'Only applies to the manual "Retry fulfillment" on orders placed before auto-fulfillment started. The delivery agency records the delivery after the customer signs the paper note.'}
        checked={requireProof}
        onChange={(event) => setRequireProof(event.currentTarget.checked)}
      />

      {!requireProof ? (
        <Alert tone="danger" title="Fulfilment without proof of delivery">
          With this off, retrying an older order at the trigger stage fulfils
          it even if nobody has confirmed the parcel was handed over.
        </Alert>
      ) : null}

      <Checkbox
        id="fulfillment-notify"
        name="notifyCustomerOnFulfillment"
        label="Let Shopify email its own shipping confirmation"
        description="Sent only for orders under auto-fulfillment, never for older ones you fulfil by hand. It includes the tracking link, alongside this app's own stage emails."
        defaultChecked={rules?.notifyCustomerOnFulfillment ?? true}
      />

      <SubmitButton pendingLabel="Saving…">Save rules</SubmitButton>
    </form>
  );
}
