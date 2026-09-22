import { describe, expect, it } from "vitest";

import { getPaidStage } from "@/lib/orders/stages";
import type { Stage } from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

/**
 * Which stage a paid order moves to.
 *
 * The only transition in the product that no person performs, so the rule
 * deciding *where* it lands has to be unambiguous — and driven by the flag,
 * not by a slug, so a store that renames "Confirmed" or builds its own ladder
 * keeps working.
 */

function stage(partial: Partial<Stage> & { id: string; position: number }): Stage {
  return {
    storeId: "store",
    key: partial.id,
    name: partial.id,
    description: "",
    icon: "circle",
    color: "#000000",
    isTerminal: false,
    triggersFulfillment: false,
    locksAddressEditing: false,
    advancesOnPayment: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as Stage;
}

/** Returns the given stages, in the order the real query would. */
function tdbWith(stages: Stage[]): TenantDb {
  return {
    storeId: "store",
    async findMany() {
      return [...stages].sort((a, b) => a.position - b.position);
    },
  } as unknown as TenantDb;
}

describe("getPaidStage", () => {
  it("finds the stage the store flagged, whatever it is called", async () => {
    const found = await getPaidStage(
      tdbWith([
        stage({ id: "placed", position: 0 }),
        stage({ id: "paiement-recu", position: 1, advancesOnPayment: true }),
        stage({ id: "delivered", position: 2, isTerminal: true }),
      ]),
    );
    expect(found?.id).toBe("paiement-recu");
  });

  it("returns nothing when no stage claims it", async () => {
    // A store that never named one simply gets no automatic advance, rather
    // than one guessed from a slug.
    expect(
      await getPaidStage(
        tdbWith([stage({ id: "a", position: 0 }), stage({ id: "b", position: 1 })]),
      ),
    ).toBeNull();
  });

  it("takes the earliest when more than one is flagged", async () => {
    // Two stages both claiming to be the paid one is a configuration mistake,
    // not a reason to refuse the transition.
    const found = await getPaidStage(
      tdbWith([
        stage({ id: "late", position: 3, advancesOnPayment: true }),
        stage({ id: "early", position: 1, advancesOnPayment: true }),
        stage({ id: "placed", position: 0 }),
      ]),
    );
    expect(found?.id).toBe("early");
  });
});
