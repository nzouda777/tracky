import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { emailSequenceSteps, emailTemplates } from "@/lib/db";
import { MERGE_VARIABLES } from "@/lib/email/merge";
import { env } from "@/lib/env";
import { NewTemplateForm } from "./new-template-form";

export const metadata: Metadata = { title: "Email templates" };

export default async function TemplatesPage() {
  const { tdb } = await requireOwner();

  const [templates, steps] = await Promise.all([
    tdb.findMany(emailTemplates, { orderBy: asc(emailTemplates.name) }),
    tdb.findMany(emailSequenceSteps),
  ]);

  const usage = new Map<string, number>();
  for (const step of steps) {
    usage.set(step.templateId, (usage.get(step.templateId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        description="The emails your customers receive. Fully editable, with merge variables."
        action={
          <Link
            href="/admin/emails/sequence"
            className="text-sm font-medium text-ink-600 underline"
          >
            Email sequence
          </Link>
        }
      />

      {!env.resend.configured ? (
        <Alert tone="warning" title="Email sending is not configured">
          Set RESEND_API_KEY and RESEND_FROM_EMAIL to start sending. You can
          still write and preview templates without them.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Your templates"
          description={`${templates.length} template${templates.length === 1 ? "" : "s"} in this store.`}
        />
        {templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            description="Create your first template below, then attach it to a stage or a delay in the sequence builder."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {templates.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/admin/emails/templates/${template.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {template.name}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {template.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                    <Badge tone="info">
                      {usage.get(template.id) ?? 0} sequence step
                      {(usage.get(template.id) ?? 0) === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="New template" />
        <CardBody>
          <NewTemplateForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Merge variables"
          description="Type these into a subject or body; they are replaced when the email is sent."
        />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MERGE_VARIABLES.map((variable) => (
              <li key={variable.token} className="text-sm">
                <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-800">
                  {`{{${variable.token}}}`}
                </code>
                <span className="ml-2 text-ink-600">{variable.label}</span>
                <span className="block text-xs text-ink-400">
                  e.g. {variable.example}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
