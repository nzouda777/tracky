import { describe, expect, it } from "vitest";

import type { Stage } from "@/lib/db";
import { buildOrderFacts } from "@/lib/email/order-facts";
import { DEFAULT_STAGES, phaseOf } from "@/lib/stages/defaults";

const STAGES = DEFAULT_STAGES.map(
  (stage, index) => ({ ...stage, id: `s${index}`, position: index }) as unknown as Stage,
);
const inPhase = (phase: string) => STAGES.filter((stage) => phaseOf(stage) === phase);

const order = {
  lineItems: [{ title: "Vase", quantity: 1, price: "10.00", imageUrl: " https://cdn/x.jpg " }],
  total: "10.00",
  currency: "AUD",
  orderDate: new Date("2025-09-22T01:00:00Z"),
  shippingAddress: null,
};

describe("buildOrderFacts", () => {
  it("dates each phase by the first time the order reached it", () => {
    const processing = inPhase("processing")[0];
    const transit = inPhase("transit")[0];
    const facts = buildOrderFacts(
      { ...order, currentStageId: transit.id },
      {
        stages: STAGES,
        history: [
          { stageId: transit.id, occurredAt: new Date("2025-09-24T01:00:00Z"), note: "Sydney NSW" },
          { stageId: processing.id, occurredAt: new Date("2025-09-23T01:00:00Z"), note: null },
        ],
      },
    );

    expect(facts.progress.map((step) => step.state)).toEqual(["done", "done", "now", "next"]);
    expect(facts.progress[1].date).toBe("Sep 23, 2025");
    expect(facts.progress[2].date).toBe("Sep 24, 2025");
    expect(facts.progress[3].date).toBe("");

    // Newest first, with the note as detail.
    expect(facts.events.map((event) => event.title)).toEqual([transit.name, processing.name]);
    expect(facts.events[0].detail).toBe("Sydney NSW");
    expect(facts.items[0].imageUrl).toBe("https://cdn/x.jpg");
  });

  it("leaves progress and events empty without the journey", () => {
    const facts = buildOrderFacts({ ...order, currentStageId: null });
    expect(facts.progress).toEqual([]);
    expect(facts.events).toEqual([]);
  });
});
