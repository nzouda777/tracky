import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { stages } from "@/lib/db";
import { StageManager } from "./stage-manager";
import { NewStageForm } from "./new-stage-form";
import { RestoreDefaultsForm } from "./restore-defaults-form";

export const metadata: Metadata = { title: "Stages" };

export default async function StagesPage() {
  const { tdb } = await requireOwner();
  const allStages = await tdb.findMany(stages, {
    orderBy: asc(stages.position),
  });

  const fulfillmentStages = allStages.filter(
    (stage) => stage.triggersFulfillment,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking stages"
        description="The steps a customer sees on the tracking page. Drag to reorder; everything here is specific to this store."
      />

      {allStages.length === 0 ? (
        <Alert tone="warning" title="No stages yet">
          <p>
            Orders cannot be imported until this store has at least one stage.
            Add one below, or start from the defaults.
          </p>
          <div className="mt-3">
            <RestoreDefaultsForm />
          </div>
        </Alert>
      ) : null}

      {fulfillmentStages.length === 0 && allStages.length > 0 ? (
        <Alert tone="warning" title="No stage triggers fulfillment">
          Mark the stage that means &ldquo;delivered&rdquo; as a fulfillment
          trigger, otherwise orders will never be marked fulfilled in Shopify.
        </Alert>
      ) : null}

      {fulfillmentStages.length > 1 ? (
        <Alert tone="warning" title="More than one fulfillment trigger">
          {fulfillmentStages.map((stage) => stage.name).join(", ")} all trigger
          fulfillment. Only the first one an order reaches will have an effect.
        </Alert>
      ) : null}

      <StageManager stages={allStages} />

      <Card>
        <CardHeader
          title="Add a stage"
          description="New stages are appended at the end; drag them into place afterwards."
        />
        <CardBody>
          <NewStageForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How stages behave" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>
            <strong>Terminal stage</strong> — the end of the journey. The agency
            uses it to mark an order delivered.
          </p>
          <p>
            <strong>Triggers fulfillment</strong> — reaching this stage pushes a
            fulfillment to Shopify, but only once the delivery agency has
            confirmed the delivery with a proof of delivery.
          </p>
          <p>
            <strong>Locks address editing</strong> — from this stage on,
            customers can no longer change their shipping address on the
            tracking page.
          </p>
          <p className="text-ink-500">
            Orders never move between stages on their own. Every step forward
            comes from a Shopify webhook or from a person in this app.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
