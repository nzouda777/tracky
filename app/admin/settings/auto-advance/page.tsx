import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { StageTimeline } from "@/app/admin/emails/sequence/stage-timeline";
import { requireOwner } from "@/lib/auth/session";
import {
  autoAdvanceSettings,
  emailSequenceSteps,
  emailTemplates,
  stages,
} from "@/lib/db";
import {
  AUTO_ADVANCE_DEFAULT_DELAY_HOURS,
  AUTO_ADVANCE_MAX_DELAY_HOURS,
  AUTO_ADVANCE_MIN_DELAY_HOURS,
  SUB_STAGE_DEFAULT_DELAY_HOURS,
} from "@/lib/orders/auto-advance";
import { arrivalHoursFor } from "@/lib/stages/progression";
import { emailsStart } from "@/lib/stores/tracking-window";
import { AutoAdvanceForm } from "./auto-advance-form";

export const metadata: Metadata = { title: "Progression & emails" };

export default async function AutoAdvanceSettingsPage() {
  const { tdb, store } = await requireOwner();

  const [settings, allStages, steps, templates] = await Promise.all([
    tdb.findFirst(autoAdvanceSettings),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
    tdb.findMany(emailSequenceSteps, {
      orderBy: asc(emailSequenceSteps.position),
    }),
    tdb.findMany(emailTemplates, { orderBy: asc(emailTemplates.name) }),
  ]);

  const start = emailsStart(store, settings);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progression & emails"
        description="How orders move through main stages and sub-stages, and which of them email the customer."
      />

      <Alert tone="info" title="How it works">
        Each main stage (Processing, In Transit, Delivered…) is made of
        sub-stages. While auto-advance is on, the scheduler checks every hour:
        an order moves to the next sub-stage after the sub-stage delay, and
        once it reaches the last sub-stage it waits the main-stage delay before
        entering the next main stage. Any agency or admin update restarts the
        clock. Moves are labelled &ldquo;Automatic&rdquo; in the order history;
        cancelled orders are never moved and no proof of delivery is created.
      </Alert>

      {!settings?.enabled ? (
        <Alert tone="warning" title="Turning it on affects existing orders">
          Orders already waiting longer than the delay move on at the next
          check, one stage at a time.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Settings" />
        <CardBody>
          <AutoAdvanceForm
            settings={settings}
            stages={allStages}
            defaultDelayHours={AUTO_ADVANCE_DEFAULT_DELAY_HOURS}
            defaultSubStageDelayHours={SUB_STAGE_DEFAULT_DELAY_HOURS}
            minDelayHours={AUTO_ADVANCE_MIN_DELAY_HOURS}
            maxDelayHours={AUTO_ADVANCE_MAX_DELAY_HOURS}
            emailsStartDate={start ? start.toISOString().slice(0, 10) : ""}
          />
        </CardBody>
      </Card>

      <StageTimeline
        title="Route overview"
        stages={allStages}
        steps={steps}
        templates={templates}
        arrivalHours={arrivalHoursFor(allStages, settings)}
        mainStagesOnly={settings?.emailsMainStagesOnly ?? true}
      />
    </div>
  );
}
