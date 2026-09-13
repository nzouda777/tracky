import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { fulfillmentRules, stages } from "@/lib/db";
import { FulfillmentForm } from "./fulfillment-form";

export const metadata: Metadata = { title: "Fulfillment" };

export default async function FulfillmentSettingsPage() {
  const { tdb } = await requireOwner();

  const [rules, allStages] = await Promise.all([
    tdb.findFirst(fulfillmentRules),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
  ]);

  const triggerStages = allStages.filter((stage) => stage.triggersFulfillment);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment"
        description="When this app marks an order fulfilled in Shopify."
      />

      <Alert tone="info" title="How fulfillment is decided">
        An order is fulfilled in Shopify only when it reaches a stage flagged as
        a fulfillment trigger <strong>and</strong> the delivery agency has
        recorded a proof of delivery. No delay, timer or schedule can fulfil an
        order.
      </Alert>

      {triggerStages.length === 0 ? (
        <Alert tone="warning" title="No stage triggers fulfillment">
          Nothing will ever be fulfilled until you mark a stage as a fulfillment
          trigger on the Stages screen.
        </Alert>
      ) : (
        <Card>
          <CardHeader title="Trigger stages" />
          <CardBody>
            <ul className="space-y-1 text-sm text-ink-700">
              {triggerStages.map((stage) => (
                <li key={stage.id}>
                  <span className="font-medium">{stage.name}</span>
                  {stage.isTerminal ? " · terminal stage" : ""}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Rules" />
        <CardBody>
          <FulfillmentForm rules={rules} />
        </CardBody>
      </Card>
    </div>
  );
}
