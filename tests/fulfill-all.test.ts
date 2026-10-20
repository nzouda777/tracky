import { describe, expect, it } from "vitest";

import type { Order } from "@/lib/db";
import type { TenantDb } from "@/lib/db/tenant";
import { fulfillAllOpenOrders } from "@/lib/fulfillment";

/**
 * The bulk "fulfil every open order" loop, against a fake query builder.
 * Each case stops before any per-order work, so no Shopify call is possible.
 */

/** A tdb whose every select resolves to the next queued result. */
function fakeTdb(results: unknown[][]): TenantDb {
  const queue = [...results];
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (resolve: (rows: unknown[]) => unknown) => resolve(queue.shift() ?? []),
  };
  return {
    storeId: "store-1",
    scope: () => undefined,
    raw: { select: () => chain },
  } as unknown as TenantDb;
}

describe("fulfillAllOpenOrders", () => {
  it("does nothing when every order is fulfilled", async () => {
    const result = await fulfillAllOpenOrders(fakeTdb([[]]));
    expect(result).toMatchObject({ attempted: 0, remaining: 0 });
  });

  it("stops at the time budget and reports what is left", async () => {
    const order = { id: "o1", orderDate: new Date() } as Order;
    const result = await fulfillAllOpenOrders(
      fakeTdb([[{ order }], [{ value: 7 }]]),
      { budgetMs: 0 },
    );
    expect(result).toMatchObject({ attempted: 0, remaining: 7 });
  });
});
