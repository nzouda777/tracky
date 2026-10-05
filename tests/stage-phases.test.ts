import { describe, expect, it } from "vitest";

import type { Stage } from "@/lib/db";
import { buildPhaseTimeline } from "@/lib/orders/stages";
import { DEFAULT_STAGES, STAGE_PHASES, phaseOf } from "@/lib/stages/defaults";

const STAGES: Stage[] = DEFAULT_STAGES.map((preset, index) => ({
  id: preset.key,
  storeId: "store",
  key: preset.key,
  name: preset.name,
  description: preset.description,
  position: index,
  icon: preset.icon,
  color: preset.color,
  phase: preset.phase,
  isTerminal: preset.isTerminal ?? false,
  triggersFulfillment: preset.triggersFulfillment ?? false,
  locksAddressEditing: preset.locksAddressEditing ?? false,
  advancesOnPayment: preset.advancesOnPayment ?? false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}));

describe("default delivery sequence", () => {
  it("has 37 steps with unique keys, in phase order", () => {
    expect(DEFAULT_STAGES).toHaveLength(37);
    expect(new Set(DEFAULT_STAGES.map((s) => s.key)).size).toBe(37);

    const order = STAGE_PHASES.map((phase) => phase.id);
    const indices = DEFAULT_STAGES.map((s) => order.indexOf(s.phase));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it("starts at Order Placed and ends on the only terminal stage", () => {
    expect(DEFAULT_STAGES[0].name).toBe("Order Placed");
    expect(DEFAULT_STAGES.at(-1)?.isTerminal).toBe(true);
    expect(DEFAULT_STAGES.filter((s) => s.isTerminal)).toHaveLength(1);
    expect(DEFAULT_STAGES.filter((s) => s.advancesOnPayment)).toHaveLength(1);
  });
});

describe("buildPhaseTimeline", () => {
  const states = (currentId: string | null) =>
    buildPhaseTimeline(STAGES, currentId).map((entry) => entry.state);

  it("always has the four phases", () => {
    expect(buildPhaseTimeline(STAGES, null).map((e) => e.stage.name)).toEqual([
      "Order Placed",
      "Processing",
      "In Transit",
      "Delivered",
    ]);
  });

  it("marks the phase holding the current stage", () => {
    expect(states(null)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(states("order-placed")).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(states("ready-to-ship")).toEqual(["complete", "current", "upcoming", "upcoming"]);
    expect(states("customs-verification")).toEqual(["complete", "complete", "current", "upcoming"]);
    expect(states("delivered")).toEqual(["complete", "complete", "complete", "current"]);
  });

  it("only reads Delivered as terminal once the order is on the terminal stage", () => {
    const atDoor = buildPhaseTimeline(STAGES, "out-for-delivery-5");
    expect(atDoor.some((e) => e.stage.isTerminal)).toBe(false);

    const done = buildPhaseTimeline(STAGES, "delivered");
    expect(done[3].stage.isTerminal).toBe(true);
  });
});

describe("phaseOf", () => {
  it("treats a terminal stage as delivered and an unknown phase as processing", () => {
    expect(phaseOf({ phase: "transit", isTerminal: true })).toBe("delivered");
    expect(phaseOf({ phase: "nonsense", isTerminal: false })).toBe("processing");
    expect(phaseOf({ phase: "transit", isTerminal: false })).toBe("transit");
  });
});
