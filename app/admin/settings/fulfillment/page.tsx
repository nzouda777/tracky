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
        As soon as an order arrives from Shopify, it is marked fulfilled there
        with the link to its tracking page, so the order in Shopify shows the
        link from the start. If that fails, it is tried again when the order
        reaches a fulfillment trigger stage below, or with &ldquo;Retry
        fulfillment&rdquo; on the order. No delay, timer or schedule can fulfil
        an order.
      </Alert>

      {triggerStages.length === 0 ? null : (
        <Card>
          <CardHeader title="Fallback trigger stages" />
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
