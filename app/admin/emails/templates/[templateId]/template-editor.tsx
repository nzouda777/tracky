"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
  previewTemplateAction,
  updateTemplateAction,
} from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailTemplate } from "@/lib/db";

/**
 * Template editor with a live preview.
 *
 * The preview is produced by the same server-side renderer that sends the real
 * email, so what an owner approves here is what the customer receives.
 */
export function TemplateEditor({ template }: { template: EmailTemplate }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [previewText, setPreviewText] = useState(template.previewText);

  const [preview, setPreview] = useState<{
    subject: string;
    html: string;
    unknownTokens: string[];
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();

  const [saveState, saveAction] = useActionState<ActionResult, FormData>(
    updateTemplateAction,
    {},
  );
  const [dupState, dupAction] = useActionState<ActionResult, FormData>(
    duplicateTemplateAction,
    {},
  );
  const [delState, delAction] = useActionState<ActionResult, FormData>(
    deleteTemplateAction,
    {},
  );

  // Debounced so typing does not fire a render on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      startPreview(async () => {
        try {
          setPreviewError(null);
          setPreview(await previewTemplateAction({ subject, body, previewText }));
        } catch {
          setPreviewError("The preview could not be rendered.");
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [subject, body, previewText]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Content" />
        <CardBody>
          <form action={saveAction} className="space-y-4">
            <input type="hidden" name="templateId" value={template.id} />

            {saveState.error ? (
              <Alert tone="danger">{saveState.error}</Alert>
            ) : null}
            {saveState.ok ? (
              <Alert tone="success">{saveState.message}</Alert>
            ) : null}

            <Field
              label="Template name"
              htmlFor="edit-name"
              error={saveState.fieldErrors?.name}
              required
            >
              <Input id="edit-name" name="name" defaultValue={template.name} required />
            </Field>

            <Field
              label="Subject"
              htmlFor="edit-subject"
              error={saveState.fieldErrors?.subject}
              required
            >
              <Input
                id="edit-subject"
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.currentTarget.value)}
                required
              />
            </Field>

            <Field label="Preview text" htmlFor="edit-preview-text">
              <Input
                id="edit-preview-text"
                name="previewText"
                value={previewText}
                onChange={(event) => setPreviewText(event.currentTarget.value)}
              />
            </Field>

            <Field
              label="Body"
              htmlFor="edit-body"
              hint="HTML with merge variables. Your store's branding is applied automatically."
              error={saveState.fieldErrors?.body}
              required
            >
              <Textarea
                id="edit-body"
                name="body"
                rows={16}
                value={body}
                onChange={(event) => setBody(event.currentTarget.value)}
                className="font-mono text-xs"
                required
              />
            </Field>

            <Checkbox
              id="edit-active"
              name="isActive"
              label="Active"
              description="Inactive templates are never sent."
              defaultChecked={template.isActive}
            />

            <SubmitButton pendingLabel="Saving…">Save template</SubmitButton>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink-200 pt-4">
            <form action={dupAction}>
              <input type="hidden" name="templateId" value={template.id} />
              <SubmitButton variant="secondary" size="sm" pendingLabel="Copying…">
                Duplicate
              </SubmitButton>
            </form>

            <form action={delAction}>
              <input type="hidden" name="templateId" value={template.id} />
              <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                Delete
              </SubmitButton>
            </form>
          </div>

          {dupState.error ? (
            <Alert tone="danger" className="mt-3">
              {dupState.error}
            </Alert>
          ) : null}
          {dupState.ok ? (
            <Alert tone="success" className="mt-3">
              {dupState.message}
            </Alert>
          ) : null}
          {delState.error ? (
            <Alert tone="danger" className="mt-3">
              {delState.error}
            </Alert>
          ) : null}
        </CardBody>
      </Card>

      <Card className="lg:sticky lg:top-28 lg:self-start">
        <CardHeader
          title="Preview"
          description="Rendered with example data by the same engine used to send."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                startPreview(async () => {
                  setPreview(
                    await previewTemplateAction({ subject, body, previewText }),
                  );
                })
              }
            >
              Refresh
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {previewError ? <Alert tone="danger">{previewError}</Alert> : null}

          {preview?.unknownTokens.length ? (
            <Alert tone="warning" title="Unknown merge variables">
              {preview.unknownTokens.map((token) => `{{${token}}}`).join(", ")}{" "}
              will be sent as literal text.
            </Alert>
          ) : null}

          <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
            <p className="text-xs text-ink-500">Subject</p>
            <p className="text-sm font-medium text-ink-900">
              {preview?.subject ?? subject}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-ink-200">
            <iframe
              title="Email preview"
              srcDoc={preview?.html ?? ""}
              className="h-[32rem] w-full bg-white"
              sandbox=""
            />
          </div>

          <p className="text-xs text-ink-400" aria-live="polite">
            {isPreviewing ? "Rendering…" : "Up to date"}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
