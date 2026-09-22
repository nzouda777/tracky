import { describe, expect, it } from "vitest";

import { attemptFulfillment } from "@/lib/fulfillment";
import type { Order, ProofOfDelivery, Stage } from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";

/**
 * These tests exercise the product's central promise: an order is never
 * fulfilled in Shopify unless a real delivery was confirmed.
 *
 * Each case stops before any network or database access, so the guard order
 * itself is what is being asserted — if a future change moved the Shopify call
 * ahead of a guard, these would fail by attempting a real request.
 */

const STORE_ID = "11111111-1111-1111-1111-111111111111";

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: "stage-delivered",
    storeId: STORE_ID,
    key: "delivered",
    name: "Delivered",
    description: "",
    position: 4,
    icon: "home",
    color: "#059669",
    isTerminal: true,
    triggersFulfillment: true,
    locksAddressEditing: false,
    advancesOnPayment: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    storeId: STORE_ID,
    shopifyOrderId: "9001",
    orderNumber: "#1042",
    customerName: "Sarah Jenkins",
    customerEmail: "sarah@example.com",
    customerPhone: null,
    shippingAddress: null,
    lineItems: [],
    orderDate: new Date(),
    total: "100.00",
    currency: "AUD",
    currentStageId: "stage-delivered",
    fulfillmentStatus: "unfulfilled",
    shopifyFulfillmentId: null,
    fulfilledAt: null,
    fulfillmentError: null,
    assignedDriverName: null,
    trackingToken: "tok",
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Minimal tenant client: returns canned rows, records nothing else. */
function makeTdb(options: {
  rules?: { enabled: boolean; requireDeliveryConfirmation: boolean } | null;
  proof?: Partial<ProofOfDelivery> | null;
}): TenantDb {
  const updates: Array<Record<string, unknown>> = [];

  const stub = {
    storeId: STORE_ID,
    updates,
    async findFirst(table: { [k: string]: unknown }) {
      // Distinguish the two tables this function reads by a marker column.
      if ("requireDeliveryConfirmation" in table) {
        return options.rules === undefined
          ? { enabled: true, requireDeliveryConfirmation: true }
          : options.rules;
      }
      if ("deliveredAt" in table) return options.proof ?? null;
      return null;
    },
    async findById() {
      return null;
    },
    async update(_table: unknown, values: Record<string, unknown>) {
      updates.push(values);
      return [];
    },
  };

  return stub as unknown as TenantDb;
}

describe("no fulfillment without a confirmed delivery", () => {
  it("skips when the stage does not trigger fulfillment", async () => {
    const result = await attemptFulfillment({
      tdb: makeTdb({}),
      order: makeOrder(),
      stage: makeStage({ triggersFulfillment: false }),
    });

    expect(result.status).toBe("skipped");
  });

  it("skips when there is no proof of delivery", async () => {
    const result = await attemptFulfillment({
      tdb: makeTdb({
        rules: { enabled: true, requireDeliveryConfirmation: true },
        proof: null,
      }),
      order: makeOrder(),
      stage: makeStage(),
    });

    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") throw new Error("expected a skip");

    // The reason names the missing record, not a missing party: a store that
    // delivers its own orders has no agency to wait for, and can declare the
    // delivery itself from the order screen.
    expect(result.reason).toMatch(/deliver(y|ed)/i);
    expect(result.reason).not.toMatch(/delivery agency/i);
  });

  it("skips when auto-fulfillment is turned off for the store", async () => {
    const result = await attemptFulfillment({
      tdb: makeTdb({
        rules: { enabled: false, requireDeliveryConfirmation: true },
        proof: { deliveredAt: new Date() },
      }),
      order: makeOrder(),
      stage: makeStage(),
    });

    expect(result.status).toBe("skipped");
    expect(result).toMatchObject({
      reason: expect.stringContaining("turned off"),
    });
  });

  it("defaults to requiring proof when a store has no rules row", async () => {
    const result = await attemptFulfillment({
      tdb: makeTdb({ rules: null, proof: null }),
      order: makeOrder(),
      stage: makeStage(),
    });

    expect(result.status).toBe("skipped");
  });
});

describe("fulfillment is idempotent", () => {
  it("does not fulfil an order that is already fulfilled", async () => {
    const result = await attemptFulfillment({
      tdb: makeTdb({ proof: { deliveredAt: new Date() } }),
      order: makeOrder({ fulfillmentStatus: "fulfilled" }),
      stage: makeStage(),
    });

    expect(result.status).toBe("already-fulfilled");
  });

  it("does not fulfil an order that already carries a Shopify fulfillment id", async () => {
    const result = await attemptFulfillment({
      tdb: makeTdb({ proof: { deliveredAt: new Date() } }),
      order: makeOrder({
        shopifyFulfillmentId: "gid://shopify/Fulfillment/1",
      }),
      stage: makeStage(),
    });

    expect(result.status).toBe("already-fulfilled");
    expect(result).toMatchObject({
      fulfillmentId: "gid://shopify/Fulfillment/1",
    });
  });

  it("checks idempotence before it checks the store's rules", async () => {
    // A store with fulfillment disabled must still report "already fulfilled"
    // rather than "skipped", proving the duplicate check comes first.
    const result = await attemptFulfillment({
      tdb: makeTdb({ rules: { enabled: false, requireDeliveryConfirmation: true } }),
      order: makeOrder({ fulfillmentStatus: "fulfilled" }),
      stage: makeStage(),
    });

    expect(result.status).toBe("already-fulfilled");
  });
});
