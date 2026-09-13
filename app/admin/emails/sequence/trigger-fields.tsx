"use client";

import { useState } from "react";

import { Field, Input, Select } from "@/components/ui";
import type { Stage } from "@/lib/db";

export type TriggerType =
  | "on_stage"
  | "delay_after_order"
  | "delay_after_previous";

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  on_stage: "When the order reaches a stage",
  delay_after_order: "A number of days after the order was placed",
  delay_after_previous: "A number of days after the previous delayed step",
};

/**
 * Trigger picker shared by the "add step" and "edit step" forms: choosing a
 * trigger swaps in the field that trigger actually needs, so a step can never
 * be saved with both a stage and a delay.
 */
export function TriggerFields({
  idPrefix,
  stages,
  defaultTriggerType = "on_stage",
  defaultStageId,
  defaultDelayDays,
  errors,
}: {
  idPrefix: string;
  stages: Stage[];
  defaultTriggerType?: TriggerType;
  defaultStageId?: string | null;
  defaultDelayDays?: number | null;
  errors?: Record<string, string>;
}) {
  const [triggerType, setTriggerType] =
    useState<TriggerType>(defaultTriggerType);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Trigger"
        htmlFor={`${idPrefix}-trigger`}
        error={errors?.triggerType}
        required
      >
        <Select
          id={`${idPrefix}-trigger`}
          name="triggerType"
          value={triggerType}
          onChange={(event) =>
            setTriggerType(event.currentTarget.value as TriggerType)
          }
        >
          {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((type) => (
            <option key={type} value={type}>
              {TRIGGER_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>

      {triggerType === "on_stage" ? (
        <Field
          label="Stage"
          htmlFor={`${idPrefix}-stage`}
          error={errors?.stageId}
          required
        >
          <Select
            id={`${idPrefix}-stage`}
            name="stageId"
            defaultValue={defaultStageId ?? ""}
            required
          >
            <option value="" disabled>
              Choose a stage…
            </option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field
          label="Delay (days)"
          htmlFor={`${idPrefix}-delay`}
          error={errors?.delayDays}
          hint="0 sends immediately."
          required
        >
          <Input
            id={`${idPrefix}-delay`}
            name="delayDays"
            type="number"
            min={0}
            max={365}
            step={1}
            defaultValue={defaultDelayDays ?? 3}
            required
          />
        </Field>
      )}
    </div>
  );
}
