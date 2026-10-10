import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import {
  autoAdvanceSettings,
  emailSequenceSteps,
  emailTemplates,
  stages,
} from "@/lib/db";
import { arrivalHoursFor } from "@/lib/stages/progression";
import { SequenceBuilder } from "./sequence-builder";
import { NewStepForm } from "./new-step-form";
import { StageTimeline } from "./stage-timeline";

export const metadata: Metadata = { title: "Email sequence" };

export default async function SequencePage() {
  const { tdb } = await requireOwner();

  const [steps, templates, allStages, settings] = await Promise.all([
    tdb.findMany(emailSequenceSteps, {
      orderBy: asc(emailSequenceSteps.position),
    }),
    tdb.findMany(emailTemplates, { orderBy: asc(emailTemplates.name) }),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
    tdb.findFirst(autoAdvanceSettings),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email sequence"
        description="Decide when each template goes out: on a main stage, or a number of days after the order."
        action={
          <div className="flex items-center gap-4">
            <Link
              href="/admin/settings/auto-advance"
              className="text-sm font-medium text-ink-600 underline"
            >
              Progression & emails
            </Link>
            <Link
              href="/admin/emails/templates"
              className="text-sm font-medium text-ink-600 underline"
            >
              Templates
            </Link>
          </div>
        }
      />

      <Alert tone="info" title="Delays only ever send email">
        A day-based delay schedules a message. It never moves an order to
        another stage — only a Shopify webhook, auto-advance or a person in
        this app can do that.
      </Alert>

      {templates.length === 0 ? (
        <Alert tone="warning">
          Create an email template first, then come back to schedule it.
        </Alert>
      ) : null}

      <StageTimeline
        stages={allStages}
        steps={steps}
        templates={templates}
        arrivalHours={arrivalHoursFor(allStages, settings)}
        mainStagesOnly={settings?.emailsMainStagesOnly ?? true}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-900">
          All sequence steps
        </h2>
        <SequenceBuilder
          steps={steps}
          templates={templates}
          stages={allStages}
        />
      </div>

      <Card>
        <CardHeader title="Add a step" />
        <CardBody>
          <NewStepForm templates={templates} stages={allStages} />
        </CardBody>
      </Card>
    </div>
  );
}
