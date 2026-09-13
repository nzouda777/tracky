import { asc, eq } from "drizzle-orm";

import { stages, type Stage } from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

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
