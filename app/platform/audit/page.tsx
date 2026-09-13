import type { Metadata } from "next";

import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { AuditTable } from "@/components/platform/audit-table";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { listPlatformAudit } from "@/lib/platform/audit";

export const metadata: Metadata = { title: "Audit log" };

export default async function PlatformAuditPage() {
  await requirePlatformAdmin();
  const entries = await listPlatformAudit({ limit: 200 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every action an operator took across tenants, newest first."
      />

      <Card>
        <AuditTable entries={entries} />
      </Card>

      <Card>
        <CardHeader title="What is and is not recorded" />
        <CardBody className="space-y-2 text-sm text-ink-600">
          <p>
            Every write made from this panel lands here before it takes effect:
            suspensions, disconnections, account locks, permission changes and
            role changes, with the operator who made them and the reason they
            gave.
          </p>
          <p>
            The log is <strong>append-only</strong>. There is no edit or delete
            path anywhere in the application — a log an operator can rewrite
            proves nothing. Each row also copies in the actor&rsquo;s email and
            a label for the target, so it still reads correctly after that
            store or account is gone.
          </p>
          <p>
            Ordinary store activity is <em>not</em> here. Stage changes, emails
            and deliveries belong to each store&rsquo;s own history, which is
            what the customer sees.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
