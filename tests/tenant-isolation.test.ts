import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  brandingSettings,
  emailSends,
  emailSequenceSteps,
  emailTemplates,
  orderStageHistory,
  orders,
  proofOfDelivery,
  stages,
  storeMemberships,
} from "@/lib/db/schema";
import { TenantDb } from "@/lib/db/tenant";

const dialect = new PgDialect();
const STORE_A = "11111111-1111-1111-1111-111111111111";
const STORE_B = "22222222-2222-2222-2222-222222222222";

function compile(sql: ReturnType<TenantDb["scope"]>) {
  return dialect.sqlToQuery(sql);
}

describe("tenant scoping", () => {
  const tdb = new TenantDb(STORE_A);

  it("requires a store id", () => {
    expect(() => new TenantDb("")).toThrow();
  });

  // Every store-owned table must be reachable only through the tenant filter.
  const tenantTables = [
    ["orders", orders],
    ["stages", stages],
    ["order_stage_history", orderStageHistory],
    ["proof_of_delivery", proofOfDelivery],
    ["email_templates", emailTemplates],
    ["email_sequence_steps", emailSequenceSteps],
    ["email_sends", emailSends],
    ["branding_settings", brandingSettings],
    ["store_memberships", storeMemberships],
  ] as const;

  it.each(tenantTables)(
    "%s is always filtered by store_id",
    (_name, table) => {
      const query = compile(tdb.scope(table));
      expect(query.sql).toContain('"store_id" =');
      expect(query.params).toContain(STORE_A);
    },
  );

  it("keeps the tenant predicate when extra conditions are added", () => {
    const query = compile(
      tdb.scope(orders, eq(orders.orderNumber, "#1042")),
    );
    expect(query.sql).toContain('"store_id" =');
    expect(query.sql).toContain('"order_number" =');
    expect(query.params).toEqual([STORE_A, "#1042"]);
  });

  it("scopes two clients to two different stores", () => {
    const a = compile(new TenantDb(STORE_A).scope(orders));
    const b = compile(new TenantDb(STORE_B).scope(orders));

    expect(a.params).toContain(STORE_A);
    expect(a.params).not.toContain(STORE_B);
    expect(b.params).toContain(STORE_B);
    expect(b.params).not.toContain(STORE_A);
  });

  it("cannot be tricked into dropping the filter by a falsy condition", () => {
    const query = compile(tdb.scope(orders, undefined));
    expect(query.sql).toContain('"store_id" =');
    expect(query.params).toEqual([STORE_A]);
  });
});

describe("tenant writes", () => {
  /**
   * Captures what the tenant client hands to Drizzle without touching a
   * database, so the storeId-injection and storeId-stripping rules can be
   * asserted directly.
   */
  function captureClient() {
    const calls: {
      insert?: unknown;
      update?: unknown;
    } = {};

    const fake = {
      insert: () => ({
        values: (rows: unknown) => {
          calls.insert = rows;
          return { returning: async () => [] };
        },
      }),
      update: () => ({
        set: (values: unknown) => {
          calls.update = values;
          return {
            where: () => ({ returning: async () => [] }),
          };
        },
      }),
    };

    const tdb = new TenantDb(STORE_A);
    // The private accessor is the single point where the driver is reached.
    Object.defineProperty(tdb, "db", { get: () => fake });
    return { tdb, calls };
  }

  it("stamps every inserted row with the caller's store id", async () => {
    const { tdb, calls } = captureClient();

    await tdb.insert(orders, [
      { orderNumber: "#1", trackingToken: "t1", orderDate: new Date(), shopifyOrderId: "1" },
      { orderNumber: "#2", trackingToken: "t2", orderDate: new Date(), shopifyOrderId: "2" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    expect(calls.insert).toHaveLength(2);
    for (const row of calls.insert as Array<{ storeId: string }>) {
      expect(row.storeId).toBe(STORE_A);
    }
  });

  it("overwrites a caller-supplied storeId on insert", async () => {
    const { tdb, calls } = captureClient();

    await tdb.insert(orders, {
      storeId: STORE_B,
      orderNumber: "#1",
      trackingToken: "t1",
      orderDate: new Date(),
      shopifyOrderId: "1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect((calls.insert as Array<{ storeId: string }>)[0].storeId).toBe(STORE_A);
  });

  it("refuses to move a row to another store on update", async () => {
    const { tdb, calls } = captureClient();

    await tdb.update(orders, {
      storeId: STORE_B,
      orderNumber: "#renamed",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(calls.update).toEqual({ orderNumber: "#renamed" });
    expect(calls.update).not.toHaveProperty("storeId");
  });
});
