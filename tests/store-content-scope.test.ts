import { readFileSync } from "node:fs";
import path from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { brandingSettings } from "@/lib/db/schema";
import { TenantDb } from "@/lib/db/tenant";

/**
 * Store-owned settings belong to exactly one store.
 *
 * Branding is the clearest case: every store styles its own tracking page, and
 * the editor looks identical whichever store is open, so a write that reached
 * the wrong row — or every row — would not look like a bug from the inside. It
 * would look like "my changes did nothing", on the store you were checking.
 *
 * Two guarantees, asserted separately because they fail in different ways:
 *
 *   1. these modules never reach the unscoped client, so a `store_id`
 *      predicate cannot be forgotten;
 *   2. the tenant client's own writes carry the store id regardless.
 */

const ROOT = process.cwd();

/**
 * Action modules that edit one store's own content. Deliberately not the whole
 * of `lib/actions`: `platform.ts` is cross-tenant by design, and `stores.ts`
 * and `settings.ts` write the `stores` and membership rows that decide who may
 * reach a tenant at all — none of which can be expressed through a client that
 * is already bound to one store.
 */
const STORE_CONTENT_ACTIONS = [
  "lib/actions/branding.ts",
  "lib/actions/emails.ts",
  "lib/actions/orders.ts",
  "lib/actions/stages.ts",
  "lib/actions/store.ts",
  "lib/actions/sync.ts",
];

/**
 * Tables that hold one store's content. Every row carries a `store_id`, and
 * reaching any of them without that predicate is the bug this file exists to
 * prevent.
 *
 * `stores` itself is not on the list: it *is* the tenant, it has no `store_id`
 * of its own, and a client already bound to one store cannot express a read of
 * it. `lib/actions/sync.ts` legitimately re-reads its own row that way, keyed
 * by the id the session resolved.
 */
const TENANT_TABLES = [
  "brandingSettings",
  "stages",
  "orders",
  "orderStageHistory",
  "proofOfDelivery",
  "emailTemplates",
  "emailSequenceSteps",
  "emailSends",
  "fulfillmentRules",
];

/** The table names appearing in each unscoped `db.…` query chain. */
function unscopedTablesIn(source: string): string[] {
  const found: string[] = [];
  const opener = /(?<![A-Za-z0-9_.])db\s*\.\s*(?:select|insert|update|delete)\s*\(/g;

  for (const match of source.matchAll(opener)) {
    // The chain that follows, up to the statement's end. Long enough to carry
    // `.from(x)` / `.into(x)` and the where clause, short enough not to run
    // into the next statement.
    const chain = source.slice(match.index, match.index + 400).split(";")[0];
    for (const table of TENANT_TABLES) {
      if (new RegExp(`\\b${table}\\b`).test(chain)) found.push(table);
    }
  }
  return found;
}

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

describe("store content is written through the tenant client only", () => {
  it.each(STORE_CONTENT_ACTIONS)(
    "%s never reaches a store-owned table unscoped",
    (file) => {
      const leaked = unscopedTablesIn(read(file));

      expect(
        leaked,
        `${file} queries ${leaked.join(", ")} through the unscoped db client, so the store_id predicate depends on someone remembering it`,
      ).toEqual([]);
    },
  );

  it("catches an unscoped tenant query when one is introduced", () => {
    // The guard above only means something if it can fail. This is what a
    // regression looks like.
    const regression = `
      const rows = await db
        .select()
        .from(brandingSettings)
        .where(eq(brandingSettings.primaryColor, "#fff"));
    `;
    expect(unscopedTablesIn(regression)).toEqual(["brandingSettings"]);

    // And the shape that is fine: the tenant client, and the store row itself.
    const allowed = `
      const row = await tdb.findFirst(brandingSettings);
      const [fresh] = await db.select().from(stores).where(eq(stores.id, id));
    `;
    expect(unscopedTablesIn(allowed)).toEqual([]);
  });

  it("branding actions resolve their store from the session, not the form", () => {
    const source = read("lib/actions/branding.ts");

    // The store must come from the authenticated session. Taking it from the
    // submitted form would let one store's owner restyle another's page.
    expect(source).toContain("requireOwner()");
    expect(source).not.toMatch(/formData\.get\(\s*["']storeId["']\s*\)/);
  });
});

describe("the tenant client stamps the store on every branding write", () => {
  const dialect = new PgDialect();
  const STORE_A = "11111111-1111-1111-1111-111111111111";
  const STORE_B = "22222222-2222-2222-2222-222222222222";

  it("filters reads and updates by store id", () => {
    const a = dialect.sqlToQuery(new TenantDb(STORE_A).scope(brandingSettings));
    const b = dialect.sqlToQuery(new TenantDb(STORE_B).scope(brandingSettings));

    expect(a.sql).toContain('"store_id" =');
    expect(a.params).toContain(STORE_A);
    expect(a.params).not.toContain(STORE_B);

    expect(b.params).toContain(STORE_B);
    expect(b.params).not.toContain(STORE_A);
  });

  it("refuses to reassign a branding row to another store", async () => {
    const captured: Array<Record<string, unknown>> = [];

    // Stands in for Drizzle, so the values handed to it can be inspected
    // without a database.
    const fake = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          captured.push(values);
          return { where: () => ({ returning: async () => [] }) };
        },
      }),
    };

    const tdb = new TenantDb(STORE_A);
    Object.defineProperty(tdb, "db", { get: () => fake });

    await tdb.update(brandingSettings, {
      primaryColor: "#123456",
      // A caller trying to move the row to another tenant.
      storeId: STORE_B,
    } as never);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ primaryColor: "#123456" });
    expect(captured[0]).not.toHaveProperty("storeId");
  });
});
