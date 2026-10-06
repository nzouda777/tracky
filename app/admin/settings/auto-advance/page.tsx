import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { autoAdvanceSettings, stages } from "@/lib/db";
import {
  AUTO_ADVANCE_DEFAULT_DELAY_HOURS,
  AUTO_ADVANCE_MAX_DELAY_HOURS,
  AUTO_ADVANCE_MIN_DELAY_HOURS,
} from "@/lib/orders/auto-advance";
import { AutoAdvanceForm } from "./auto-advance-form";

export const metadata: Metadata = { title: "Auto-advance" };

export default async function AutoAdvanceSettingsPage() {
  const { tdb } = await requireOwner();

  const [settings, allStages] = await Promise.all([
    tdb.findFirst(autoAdvanceSettings),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auto-advance"
        description="Move orders along their stages on a fixed delay."
      />

      <Alert tone="info" title="How auto-advance works">
        For a delivery network that guarantees a stage change within a set
        delay. While it is on, the scheduler checks every hour and moves each
        order that has gone the full delay without an update to the next stage,
        one stage at a time. Customers see the new stage and get its emails as
        usual. In the order history these moves are labelled
        &ldquo;Automatic&rdquo;. Cancelled orders are never moved, and no proof
        of delivery is created.
      </Alert>

      {!settings?.enabled ? (
        <Alert tone="warning" title="Turning it on affects existing orders">
          Orders already waiting longer than the delay move on at the next
          check, one stage per delay.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Settings" />
        <CardBody>
          <AutoAdvanceForm
            settings={settings}
            stages={allStages}
            defaultDelayHours={AUTO_ADVANCE_DEFAULT_DELAY_HOURS}
            minDelayHours={AUTO_ADVANCE_MIN_DELAY_HOURS}
            maxDelayHours={AUTO_ADVANCE_MAX_DELAY_HOURS}
          />
        </CardBody>
      </Card>
    </div>
  );
}
