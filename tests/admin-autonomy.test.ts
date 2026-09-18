import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An admin can take an order all the way through on their own.
 *
 * The product's one hard rule is that nothing is fulfilled in Shopify without
 * a confirmed delivery. That is about the *record*, not about who makes it —
 * a store that runs its own deliveries has no agency to wait for. When the
 * only form writing that record lived in the agency area, the rule quietly
 * became "an admin cannot finish an order alone", which is a different rule
 * and not one anybody chose.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

describe("the admin needs nobody", () => {
  it("can move an order to any stage, with no proof required", () => {
    const actions = read("lib/actions/orders.ts");
    const override = actions.slice(
      actions.indexOf("export async function overrideStageAction"),
      actions.indexOf("export async function advanceStageAction"),
    );

    expect(override).toContain("requireOwner()");
    // The agency path gates terminal stages behind a proof; the admin's
    // override deliberately does not.
    expect(override).not.toContain("proofOfDelivery");
  });

  it("can record the delivery from their own order screen", () => {
    const page = read("app/admin/orders/[orderId]/page.tsx");
    expect(page).toContain("MarkDeliveredForm");
  });

  it("records who really declared it", () => {
    const actions = read("lib/actions/orders.ts");
    const marked = actions.slice(
      actions.indexOf("export async function markDeliveredAction"),
    );

    // Attribution follows the role, not the screen the form happened to be on.
    expect(marked).toMatch(/source:\s*role === "owner" \? "admin" : "agency"/);
  });

  it("explains the block in terms of a record, not a party", () => {
    const fulfillment = read("lib/fulfillment/index.ts");
    const gate = fulfillment.slice(
      fulfillment.indexOf("requiresProof && !proof"),
    );
    const reason = gate.slice(0, gate.indexOf("}"));

    expect(reason).not.toMatch(/delivery agency/i);
    expect(reason).toMatch(/Mark as delivered/);
  });
});
