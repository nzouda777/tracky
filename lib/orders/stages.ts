import { asc, eq } from "drizzle-orm";

import { stages, type Stage } from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";
import { STAGE_PHASES, phaseOf, type StagePhase } from "@/lib/stages/defaults";

/** Every stage of a store, in display order. */
export function listStages(tdb: TenantDb): Promise<Stage[]> {
  return tdb.findMany(stages, { orderBy: asc(stages.position) });
}

/** The stage a brand-new order is placed in. */
export async function getFirstStage(tdb: TenantDb): Promise<Stage | null> {
  return tdb.findFirst(stages, { orderBy: asc(stages.position) });
}

export function getStageById(
  tdb: TenantDb,
  stageId: string,
): Promise<Stage | null> {
  return tdb.findById(stages, stageId);
}

export function getStageByKey(
  tdb: TenantDb,
  key: string,
): Promise<Stage | null> {
  return tdb.findFirst(stages, { where: eq(stages.key, key) });
}

/**
 * Splits a stage list relative to the order's current stage, which is what the
 * public timeline renders: completed stages filled, current stage active, the
 * rest pending.
 */
export type TimelineEntry = {
  stage: Stage;
  state: "complete" | "current" | "upcoming";
};

export function buildTimeline(
  allStages: Stage[],
  currentStageId: string | null,
): TimelineEntry[] {
  const currentIndex = allStages.findIndex(
    (stage) => stage.id === currentStageId,
  );

  return allStages.map((stage, index) => ({
    stage,
    state:
      currentIndex === -1
        ? "upcoming"
        : index < currentIndex
          ? "complete"
          : index === currentIndex
            ? "current"
            : "upcoming",
  }));
}

/**
 * The same timeline folded into the four phases of the progress bar.
 *
 * A store's stage list can run to dozens of steps; the customer's bar shows
 * only Order Placed → Processing → In Transit → Delivered. A phase is passed
 * when the current stage sits in a later phase, current when it holds the
 * current stage, and upcoming otherwise — so the bar never claims more
 * progress than the recorded stage does.
 *
 * Each entry carries a synthetic stage (id `phase:<id>`) so every component
 * that draws a `TimelineEntry` can draw a phase unchanged. Only the delivered
 * phase is terminal.
 */
export function buildPhaseTimeline(
  allStages: Stage[],
  currentStageId: string | null,
): TimelineEntry[] {
  const current = allStages.find((stage) => stage.id === currentStageId);
  const currentPhase = current
    ? STAGE_PHASES.findIndex((phase) => phase.id === phaseOf(current))
    : -1;

  return STAGE_PHASES.map((phase, index) => {
    const first = allStages.find((stage) => phaseOf(stage) === phase.id);
    const delivered = phase.id === "delivered";

    return {
      stage: {
        ...(first ?? allStages[0]),
        id: `phase:${phase.id}`,
        key: `phase-${phase.id}`,
        name: phase.label,
        description: "",
        phase: phase.id,
        position: index,
        icon: PHASE_ICONS[phase.id],
        // Delivered is only "reached" when the order sits on the store's
        // real terminal stage, whatever else is filed under that phase.
        isTerminal: delivered && Boolean(current?.isTerminal),
      } as Stage,
      state:
        currentPhase === -1
          ? "upcoming"
          : index < currentPhase
            ? "complete"
            : index === currentPhase
              ? "current"
              : "upcoming",
    };
  });
}

const PHASE_ICONS: Record<StagePhase, string> = {
  placed: "receipt",
  processing: "package",
  transit: "truck",
  delivered: "home",
};

/**
 * Whether the customer may still edit their shipping address.
 *
 * Editing closes as soon as the order reaches the first stage flagged
 * `locksAddressEditing` — by default "Out for Delivery", because after that the
 * parcel is physically on a van and a new address would not reach the driver.
 */
export function isAddressEditable({
  allStages,
  currentStageId,
  allowedByBranding,
}: {
  allStages: Stage[];
  currentStageId: string | null;
  allowedByBranding: boolean;
}): boolean {
  if (!allowedByBranding) return false;

  const lockIndex = allStages.findIndex((stage) => stage.locksAddressEditing);
  if (lockIndex === -1) return true;

  const currentIndex = allStages.findIndex(
    (stage) => stage.id === currentStageId,
  );
  if (currentIndex === -1) return true;

  return currentIndex < lockIndex;
}

/**
 * The stage a paid order moves to, if the store has named one.
 *
 * Driven by a flag rather than a slug, like every other stage behaviour, so a
 * store that renames "Confirmed" or builds its own ladder keeps working. When
 * more than one stage carries the flag the earliest wins — two stages both
 * claiming to be the paid one is a configuration mistake, not a reason to
 * refuse the transition.
 */
export async function getPaidStage(tdb: TenantDb): Promise<Stage | null> {
  const all = await tdb.findMany(stages, { orderBy: asc(stages.position) });
  return all.find((stage) => stage.advancesOnPayment) ?? null;
}
