import type { Stage } from "@/lib/db";
import { STAGE_PHASES, phaseOf, type StagePhase } from "./defaults";

/**
 * Main stages and sub-stages.
 *
 * The four phases (Order Placed, Processing, In Transit, Delivered) are the
 * main stages. Within a phase, the first stage in route order is where an
 * order enters that main stage; every later stage of the phase is one of its
 * sub-stages.
 */

export type StageGroup<T extends StageLike = Stage> = {
  phase: StagePhase;
  label: string;
  /** The stage an order enters the main stage on. */
  main: T;
  subStages: T[];
};

type StageLike = Pick<Stage, "id" | "phase" | "isTerminal">;

/** Stages (already in route order) grouped by main stage, empty phases left out. */
export function groupStages<T extends StageLike>(stages: T[]): StageGroup<T>[] {
  return STAGE_PHASES.flatMap(({ id, label }) => {
    const inPhase = stages.filter((stage) => phaseOf(stage) === id);
    if (inPhase.length === 0) return [];
    const [main, ...subStages] = inPhase;
    return [{ phase: id, label, main, subStages }];
  });
}

/** The first stage of `stage`'s phase, i.e. the main stage it belongs to. */
export function mainStageOf<T extends StageLike>(
  stages: T[],
  stage: StageLike,
): T | undefined {
  const phase = phaseOf(stage);
  return stages.find((candidate) => phaseOf(candidate) === phase);
}

/** True when `stage` is the stage an order enters its main stage on. */
export function isMainStage(stages: StageLike[], stage: StageLike): boolean {
  return mainStageOf(stages, stage)?.id === stage.id;
}

export type ProgressionDelays = {
  /** Wait before entering the next main stage. */
  delayHours: number;
  /** Wait between two sub-stages of the same main stage. */
  subStageDelayHours: number;
};

/**
 * How long an order waits at `from` before auto-advance moves it to `next`:
 * the sub-stage delay inside a phase, the main-stage delay when `next` opens
 * a new phase.
 */
export function stepDelayHours(
  from: Pick<Stage, "phase" | "isTerminal">,
  next: Pick<Stage, "phase" | "isTerminal"> | undefined,
  delays: ProgressionDelays,
): number {
  if (!next || phaseOf(from) !== phaseOf(next)) return delays.delayHours;
  return delays.subStageDelayHours;
}

/**
 * Hours after the order at which auto-advance brings an order to each stage,
 * assuming nobody updates it by hand. The paid stage is reached at checkout.
 * Stages past `stopAtStageId` are left out: the agency moves those.
 */
export function estimateArrivalHours(
  stages: Array<Pick<Stage, "id" | "phase" | "isTerminal" | "advancesOnPayment">>,
  delays: ProgressionDelays & { stopAtStageId: string | null },
): Map<string, number> {
  const result = new Map<string, number>();
  const paidIndex = stages.findIndex((stage) => stage.advancesOnPayment);
  const start = paidIndex === -1 ? 0 : paidIndex;
  const stopIndex = delays.stopAtStageId
    ? stages.findIndex((stage) => stage.id === delays.stopAtStageId)
    : -1;
  const last = stopIndex === -1 ? stages.length - 1 : stopIndex;

  let hours = 0;
  stages.forEach((stage, index) => {
    if (index > last) return;
    if (index > start) {
      hours += stepDelayHours(stages[index - 1], stage, delays);
    }
    result.set(stage.id, index <= start ? 0 : hours);
  });
  return result;
}

/** "3 days", "36 h", "at checkout". */
export function formatArrival(hours: number): string {
  if (hours === 0) return "at checkout";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"} after the order`;
  }
  return `${hours} h after the order`;
}
