"use client";

import { useActionState, useState } from "react";

import { Alert, Badge, Button, Card, CardHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSequenceStepAction } from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailSequenceStep, EmailTemplate, Stage } from "@/lib/db";
import { formatArrival, groupStages } from "@/lib/stages/phases";

/**
 * Every stage an order goes through, grouped under its main stage (phase),
 * with the emails attached to each and, when auto-advance is on, when an
 * order gets there.
 *
 * With "main stages only" on, emails are attached to main stages; any email
 * still attached to a sub-stage is flagged as not being sent.
 */
export function StageTimeline({
  stages,
  steps,
  templates,
  arrivalHours,
  mainStagesOnly,
  title = "Stages and emails",
}: {
  stages: Stage[];
  steps: EmailSequenceStep[];
  templates: EmailTemplate[];
  /** Hours after the order each stage is reached; null when auto-advance is off. */
  arrivalHours: Record<string, number> | null;
  mainStagesOnly: boolean;
  title?: string;
}) {
  const templateById = new Map(templates.map((row) => [row.id, row]));
  const stepsByStage = new Map<string, EmailSequenceStep[]>();
  for (const step of steps) {
    if (step.triggerType !== "on_stage" || !step.stageId) continue;
    stepsByStage.set(step.stageId, [
      ...(stepsByStage.get(step.stageId) ?? []),
      step,
    ]);
  }

  const groups = groupStages(stages);
  const timing = (stageId: string) => {
    const hours = arrivalHours?.[stageId];
    return hours === undefined ? null : formatArrival(hours);
  };

  return (
    <Card>
      <CardHeader
        title={title}
        description={`${groups.length} main stages · ${stages.length} stages in total. ${
          mainStagesOnly
            ? "Emails go out only when an order enters a main stage."
            : "Emails go out on every stage they are attached to."
        }`}
      />
      <div className="space-y-4 p-4">
        {groups.map((group, groupIndex) => (
          <section
            key={group.phase}
            className="overflow-hidden rounded-xl border border-ink-200"
          >
            <div className="bg-ink-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                  {groupIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {group.label}
                    <span className="font-normal text-ink-500">
                      {" "}
                      · starts at &ldquo;{group.main.name}&rdquo;
                    </span>
                  </p>
                  <p className="text-xs text-ink-500">
                    {group.subStages.length} sub-stage
                    {group.subStages.length === 1 ? "" : "s"}
                    {timing(group.main.id) ? ` · ${timing(group.main.id)}` : ""}
                  </p>
                </div>
                <EmailCell
                  stageId={group.main.id}
                  steps={stepsByStage.get(group.main.id) ?? []}
                  templates={templates}
                  templateById={templateById}
                  canAdd
                />
              </div>
            </div>

            {group.subStages.length > 0 ? (
              <ol className="divide-y divide-ink-100">
                {group.subStages.map((stage) => (
                  <li key={stage.id} className="py-2 pl-14 pr-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-800">
                          {stage.name}
                        </p>
                        {timing(stage.id) ? (
                          <p className="text-xs text-ink-500">
                            {timing(stage.id)}
                          </p>
                        ) : null}
                      </div>
                      <EmailCell
                        stageId={stage.id}
                        steps={stepsByStage.get(stage.id) ?? []}
                        templates={templates}
                        templateById={templateById}
                        canAdd={!mainStagesOnly}
                        notSent={mainStagesOnly}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ))}
      </div>
    </Card>
  );
}

function EmailCell({
  stageId,
  steps,
  templates,
  templateById,
  canAdd,
  notSent = false,
}: {
  stageId: string;
  steps: EmailSequenceStep[];
  templates: EmailTemplate[];
  templateById: Map<string, EmailTemplate>;
  canAdd: boolean;
  /** Attached emails here are skipped (sub-stage under "main stages only"). */
  notSent?: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {steps.length === 0 ? (
          canAdd ? (
            <span className="text-xs text-ink-400">No email</span>
          ) : null
        ) : (
          steps.map((step) => (
            <Badge
              key={step.id}
              tone={notSent ? "warning" : step.isActive ? "success" : "neutral"}
            >
              {templateById.get(step.templateId)?.name ?? "Deleted template"}
              {notSent
                ? " · not sent (sub-stage)"
                : step.isActive
                  ? ""
                  : " (paused)"}
            </Badge>
          ))
        )}
        {canAdd && templates.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
            {adding ? "Close" : "+ Email"}
          </Button>
        ) : null}
      </div>
      {adding ? (
        <AddStageEmail
          stageId={stageId}
          templates={templates}
          onDone={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

function AddStageEmail({
  stageId,
  templates,
  onDone,
}: {
  stageId: string;
  templates: EmailTemplate[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (previous, formData) => {
      const result = await createSequenceStepAction(previous, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="triggerType" value="on_stage" />
      <input type="hidden" name="stageId" value={stageId} />
      <Select
        name="templateId"
        defaultValue=""
        required
        aria-label="Template"
        className="max-w-xs"
      >
        <option value="" disabled>
          Choose a template…
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
            {template.isActive ? "" : " (inactive)"}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" pendingLabel="Adding…">
        Send on this stage
      </SubmitButton>
      {state.error || state.fieldErrors ? (
        <Alert tone="danger" className="w-full">
          {state.error ?? Object.values(state.fieldErrors ?? {})[0]}
        </Alert>
      ) : null}
    </form>
  );
}
