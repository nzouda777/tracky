import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { emailTemplates } from "@/lib/db";
import { MERGE_VARIABLES } from "@/lib/email/merge";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Edit template" };

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { tdb } = await requireOwner();

  const template = await tdb.findById(emailTemplates, templateId);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description="Edit the copy, then preview it exactly as the customer will receive it."
        action={
          <Link
            href="/admin/emails/templates"
            className="text-sm font-medium text-ink-600 underline"
          >
            ← All templates
          </Link>
        }
      />

      <TemplateEditor template={template} />

      <Card>
        <CardHeader title="Merge variables" />
        <CardBody>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {MERGE_VARIABLES.map((variable) => (
              <li key={variable.token} className="text-sm text-ink-600">
                <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-800">
                  {`{{${variable.token}}}`}
                </code>{" "}
                {variable.label}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
