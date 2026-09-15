import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { emailSequenceSteps, emailTemplates, stages } from "@/lib/db";
import { SequenceBuilder } from "./sequence-builder";
import { NewStepForm } from "./new-step-form";

export const metadata: Metadata = { title: "Email sequence" };

export default async function SequencePage() {
  const { tdb } = await requireOwner();

  const [steps, templates, allStages] = await Promise.all([
    tdb.findMany(emailSequenceSteps, {
      orderBy: asc(emailSequenceSteps.position),
    }),
    tdb.findMany(emailTemplates, { orderBy: asc(emailTemplates.name) }),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email sequence"
        description="Decide when each template goes out: on a stage, or a number of days after the order."
        action={
          <Link
            href="/admin/emails/templates"
            className="text-sm font-medium text-ink-600 underline"
          >
            Templates
          </Link>
        }
      />

      <Alert tone="info" title="Delays only ever send email">
        A day-based delay schedules a message. It never moves an order to
        another stage — only a Shopify webhook or a person in this app can do
        that.
      </Alert>

      {templates.length === 0 ? (
        <Alert tone="warning">
          Create an email template first, then come back to schedule it.
        </Alert>
      ) : null}

      <SequenceBuilder
        steps={steps}
        templates={templates}
        stages={allStages}
      />

      <Card>
        <CardHeader title="Add a step" />
        <CardBody>
          <NewStepForm templates={templates} stages={allStages} />
        </CardBody>
      </Card>
    </div>
  );
}
