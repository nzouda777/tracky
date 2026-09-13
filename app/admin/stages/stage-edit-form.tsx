"use client";

import { useActionState } from "react";

import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  deleteStageAction,
  updateStageAction,
} from "@/lib/actions/stages";
import type { ActionResult } from "@/lib/actions/result";
import type { Stage } from "@/lib/db";
import { STAGE_ICONS } from "@/lib/stages/defaults";

export function StageEditForm({
  stage,
  onDone,
}: {
  stage: Stage;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateStageAction,
    {},
  );
  const [deleteState, deleteAction] = useActionState<ActionResult, FormData>(
    deleteStageAction,
    {},
  );

  return (
    <div className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      {deleteState.error ? (
        <Alert tone="danger">{deleteState.error}</Alert>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="stageId" value={stage.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor={`name-${stage.id}`}
            error={state.fieldErrors?.name}
            required
          >
            <Input
              id={`name-${stage.id}`}
              name="name"
              defaultValue={stage.name}
              required
            />
          </Field>

          <Field
            label="Key"
            htmlFor={`key-${stage.id}`}
            hint="Stable identifier. Generated from the name and not editable."
          >
            <Input id={`key-${stage.id}`} value={stage.key} disabled readOnly />
          </Field>
        </div>

        <Field
          label="Customer-facing description"
          htmlFor={`description-${stage.id}`}
          hint="Shown under this stage on the tracking page."
        >
          <Textarea
            id={`description-${stage.id}`}
            name="description"
            defaultValue={stage.description}
            rows={2}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Icon" htmlFor={`icon-${stage.id}`}>
            <Select id={`icon-${stage.id}`} name="icon" defaultValue={stage.icon}>
              {STAGE_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Colour" htmlFor={`color-${stage.id}`}>
            <Input
              id={`color-${stage.id}`}
              name="color"
              type="color"
              defaultValue={stage.color}
              className="h-10 w-20 p-1"
            />
          </Field>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink-800">Behaviour</legend>
          <Checkbox
            id={`isTerminal-${stage.id}`}
            name="isTerminal"
            label="Terminal stage"
            description="The end of the journey, e.g. Delivered."
            defaultChecked={stage.isTerminal}
          />
          <Checkbox
            id={`triggersFulfillment-${stage.id}`}
            name="triggersFulfillment"
            label="Triggers Shopify fulfillment"
            description="Only fires once the delivery agency has confirmed the delivery."
            defaultChecked={stage.triggersFulfillment}
          />
          <Checkbox
            id={`locksAddressEditing-${stage.id}`}
            name="locksAddressEditing"
            label="Locks address editing"
            description="Customers can no longer change their address from this stage on."
            defaultChecked={stage.locksAddressEditing}
          />
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Saving…">Save stage</SubmitButton>
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-medium text-ink-600 underline"
          >
            Cancel
          </button>
        </div>
      </form>

      <form action={deleteAction} className="border-t border-ink-200 pt-4">
        <input type="hidden" name="stageId" value={stage.id} />
        <SubmitButton
          variant="danger"
          size="sm"
          pendingLabel="Deleting…"
        >
          Delete stage
        </SubmitButton>
        <p className="mt-1.5 text-xs text-ink-500">
          Stages that already appear in an order&rsquo;s history cannot be
          deleted — rename them instead so past timelines stay accurate.
        </p>
      </form>
    </div>
  );
}
