"use client";

import { useActionState, useState, useTransition } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Select,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  deleteSequenceStepAction,
  reorderSequenceStepsAction,
  toggleSequenceStepAction,
  updateSequenceStepAction,
} from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import type { EmailSequenceStep, EmailTemplate, Stage } from "@/lib/db";
import { TriggerFields, type TriggerType } from "./trigger-fields";

/**
 * The sequence: which template goes out, and when.
 *
 * Order matters for `delay_after_previous`, which chains off the previously
 * scheduled delayed step, so reordering is a first-class action here.
 */
export function SequenceBuilder({
  steps,
  templates,
  stages,
}: {
  steps: EmailSequenceStep[];
  templates: EmailTemplate[];
  stages: Stage[];
}) {
  const [items, setItems] = useState(steps);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync from the server copy when it changes, adjusting state during
  // render rather than in an effect.
  const [serverSteps, setServerSteps] = useState(steps);
  if (steps !== serverSteps) {
    setServerSteps(steps);
    setItems(steps);
  }

  const templateById = new Map(templates.map((row) => [row.id, row]));
  const stageById = new Map(stages.map((row) => [row.id, row]));

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);

    const formData = new FormData();
    formData.set("order", next.map((row) => row.id).join(","));
    startTransition(async () => {
      const result = await reorderSequenceStepsAction({}, formData);
      if (result.error) {
        setError(result.error);
        setItems(steps);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No sequence steps yet"
          description="Add a step below to start sending automated email for this store."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <ol className="space-y-2">
        {items.map((step, index) => (
          <li
            key={step.id}
            className="rounded-xl border border-ink-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-ink-400">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">
                  {templateById.get(step.templateId)?.name ?? "Deleted template"}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {describeTrigger(step, stageById)}
                </p>
              </div>

              {step.isActive ? (
                <Badge tone="success">Active</Badge>
              ) : (
                <Badge tone="neutral">Paused</Badge>
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move step up"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move step down"
                >
                  ↓
                </Button>
                <ToggleStep stepId={step.id} isActive={step.isActive} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setEditingId(editingId === step.id ? null : step.id)
                  }
                >
                  {editingId === step.id ? "Close" : "Edit"}
                </Button>
              </div>
            </div>

            {editingId === step.id ? (
              <div className="border-t border-ink-200 px-4 py-4">
                <StepEditForm
                  step={step}
                  templates={templates}
                  stages={stages}
                  onDone={() => setEditingId(null)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ToggleStep({
  stepId,
  isActive,
}: {
  stepId: string;
  isActive: boolean;
}) {
  const [, formAction] = useActionState<ActionResult, FormData>(
    toggleSequenceStepAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="stepId" value={stepId} />
      <SubmitButton
        variant="ghost"
        size="sm"
        pendingLabel="…"
      >
        {isActive ? "Pause" : "Activate"}
      </SubmitButton>
    </form>
  );
}

function StepEditForm({
  step,
  templates,
  stages,
  onDone,
}: {
  step: EmailSequenceStep;
  templates: EmailTemplate[];
  stages: Stage[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateSequenceStepAction,
    {},
  );
  const [delState, delAction] = useActionState<ActionResult, FormData>(
    deleteSequenceStepAction,
    {},
  );

  return (
    <div className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      {delState.error ? <Alert tone="danger">{delState.error}</Alert> : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="stepId" value={step.id} />

        <Field
          label="Template"
          htmlFor={`step-template-${step.id}`}
          error={state.fieldErrors?.templateId}
          required
        >
          <Select
            id={`step-template-${step.id}`}
            name="templateId"
            defaultValue={step.templateId}
            required
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </Field>

        <TriggerFields
          idPrefix={`step-${step.id}`}
          stages={stages}
          defaultTriggerType={step.triggerType as TriggerType}
          defaultStageId={step.stageId}
          defaultDelayDays={step.delayDays}
          errors={state.fieldErrors}
        />

        <Checkbox
          id={`step-active-${step.id}`}
          name="isActive"
          label="Active"
          defaultChecked={step.isActive}
        />

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Saving…">Save step</SubmitButton>
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-medium text-ink-600 underline"
          >
            Cancel
          </button>
        </div>
      </form>

      <form action={delAction} className="border-t border-ink-200 pt-4">
        <input type="hidden" name="stepId" value={step.id} />
        <SubmitButton variant="danger" size="sm" pendingLabel="Removing…">
          Remove step
        </SubmitButton>
        <p className="mt-1.5 text-xs text-ink-500">
          Emails already sent stay in the log; only future sends stop.
        </p>
      </form>
    </div>
  );
}

function describeTrigger(
  step: EmailSequenceStep,
  stageById: Map<string, Stage>,
): string {
  if (step.triggerType === "on_stage") {
    const stage = step.stageId ? stageById.get(step.stageId) : null;
    return `Sends when the order reaches "${stage?.name ?? "a deleted stage"}"`;
  }
  const days = step.delayDays ?? 0;
  const unit = days === 1 ? "day" : "days";
  return step.triggerType === "delay_after_order"
    ? `Sends ${days} ${unit} after the order was placed`
    : `Sends ${days} ${unit} after the previous delayed step`;
}
