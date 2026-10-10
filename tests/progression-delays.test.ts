import { describe, expect, it } from "vitest";

import {
  estimateArrivalHours,
  groupStages,
  isMainStage,
  mainStageOf,
  stepDelayHours,
} from "@/lib/stages/phases";

type TestStage = {
  id: string;
  phase: string;
  isTerminal: boolean;
  advancesOnPayment: boolean;
};

function stage(id: string, phase: string, extra: Partial<TestStage> = {}): TestStage {
  return { id, phase, isTerminal: false, advancesOnPayment: false, ...extra };
}

// Placed (1) → Processing (confirmed + 2 sub-stages) → Transit (3) → Delivered.
const route: TestStage[] = [
  stage("placed", "placed"),
  stage("confirmed", "processing", { advancesOnPayment: true }),
  stage("packing", "processing"),
  stage("ready", "processing"),
  stage("picked-up", "transit"),
  stage("customs", "transit"),
  stage("out", "transit"),
  stage("delivered", "delivered", { isTerminal: true }),
];

const delays = { delayHours: 48, subStageDelayHours: 24 };

describe("main stages and sub-stages", () => {
  it("groups stages under their main stage, the first one being the entry", () => {
    const groups = groupStages(route);
    expect(groups.map((group) => [group.main.id, group.subStages.map((s) => s.id)])).toEqual([
      ["placed", []],
      ["confirmed", ["packing", "ready"]],
      ["picked-up", ["customs", "out"]],
      ["delivered", []],
    ]);
  });

  it("maps any stage to the main stage it belongs to", () => {
    expect(mainStageOf(route, route[6])?.id).toBe("picked-up");
    expect(isMainStage(route, route[4])).toBe(true);
    expect(isMainStage(route, route[5])).toBe(false);
  });

  it("waits the sub-stage delay inside a phase and the main delay across phases", () => {
    expect(stepDelayHours(route[2], route[3], delays)).toBe(24);
    expect(stepDelayHours(route[3], route[4], delays)).toBe(48);
  });

  it("estimates arrival from checkout: 24 h per sub-stage, 48 h per main stage", () => {
    const hours = estimateArrivalHours(route, { ...delays, stopAtStageId: null });
    expect(Object.fromEntries(hours)).toEqual({
      placed: 0,
      confirmed: 0,
      packing: 24,
      ready: 48,
      "picked-up": 96,
      customs: 120,
      out: 144,
      delivered: 192,
    });
  });

  it("leaves stages past the stop stage to the agency", () => {
    const hours = estimateArrivalHours(route, { ...delays, stopAtStageId: "customs" });
    expect(hours.has("customs")).toBe(true);
    expect(hours.has("out")).toBe(false);
  });
});
