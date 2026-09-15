import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guardrails for the product's core rule:
 *
 *   "An order only ever moves forward on a real event — a Shopify webhook or
 *    an authenticated human action. Never on a timer."
 *
 * These tests read the source tree rather than run code, so a future change
 * that quietly wires a scheduler into stage progression fails here even if it
 * type-checks and passes every behavioural test.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function walk(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  const entries: string[] = [];
  for (const name of readdirSync(absolute)) {
    const full = path.join(absolute, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(path.join(dir, name)));
    } else if (/\.(ts|tsx)$/.test(name)) {
      entries.push(path.join(dir, name));
    }
  }
  return entries;
}

/** Source files (outside `tests/`) that mention a given call, repo-relative. */
function callersOf(needle: string): string[] {
  return [...walk("lib"), ...walk("app"), ...walk("components")]
    .filter((file) => read(file).includes(needle))
    .map((file) => file.split(path.sep).join("/"))
    .sort();
}

describe("stage transitions are event-driven only", () => {
  it("the only stage-event sources are webhooks and authenticated humans", () => {
    const schema = read("lib/db/schema.ts");
    const enumBlock = schema.slice(
      schema.indexOf('pgEnum("stage_event_source"'),
      schema.indexOf('pgEnum("fulfillment_status"'),
    );

    expect(enumBlock).toContain("shopify_webhook");
    expect(enumBlock).toContain("agency");
    expect(enumBlock).toContain("admin");

    for (const forbidden of ["timer", "scheduler", "cron", "system", "auto"]) {
      expect(enumBlock).not.toContain(`"${forbidden}"`);
    }
  });

  it("recordStageTransition is only reachable from authenticated actions", () => {
    const callers = callersOf("recordStageTransition(").filter(
      (file) => file !== "lib/orders/transitions.ts",
    );

    expect(callers).toEqual([
      // Human actions. Every function in this file starts with a role check
      // (requireOwner / requireAgency / requireStoreAccess).
      "lib/actions/orders.ts",
      // The manual "Sync orders" backfill. Not a scheduler: it only ever runs
      // because an owner pressed a button, and it records the import with
      // `source = shopify_sync` against the order's real Shopify date. The
      // test below pins that it stays behind that guard.
      "lib/shopify/sync.ts",
    ]);
  });

  it("the order sync is reachable only from a guarded action", () => {
    const callers = callersOf("syncOrdersFromShopify(").filter(
      (file) => file !== "lib/shopify/sync.ts",
    );
    expect(callers).toEqual(["lib/actions/sync.ts"]);

    // And that action is owner-only.
    expect(read("lib/actions/sync.ts")).toContain("requireOwner()");
  });

  it("the sync refreshes Shopify's own fields and nothing the agency owns", () => {
    const sync = read("lib/shopify/sync.ts");
    const updateBlock = sync.slice(
      sync.indexOf("await tdb.updateById(orders, existing.id, {"),
      sync.indexOf("return { kind: \"updated\" };"),
    );

    // An existing order must never have its delivery state rewritten by a
    // re-sync: those belong to real events and to the agency.
    for (const owned of [
      "currentStageId",
      "fulfillmentStatus",
      "shopifyFulfillmentId",
      "assignedDriverName",
      "trackingToken",
    ]) {
      expect(updateBlock, `sync must not overwrite ${owned}`).not.toContain(
        `${owned}:`,
      );
    }
  });

  it("placeOrderInFirstStage is only reachable from the Shopify webhook path", () => {
    const callers = callersOf("placeOrderInFirstStage(").filter(
      (file) => file !== "lib/orders/transitions.ts",
    );

    expect(callers).toEqual(["lib/shopify/handlers.ts"]);
  });

  it("the scheduled-email paths never touch stage progression", () => {
    const scheduledPaths = [
      "lib/email/scheduler.ts",
      "lib/email/send.ts",
      "lib/email/sweep.ts",
      "lib/queue/qstash.ts",
      "app/api/cron/sweep-emails/route.ts",
      "app/api/jobs/send-email/route.ts",
    ];

    for (const file of scheduledPaths) {
      const source = read(file);
      // Calls, not mentions: a doc comment may legitimately name the function.
      expect(source, `${file} must not move orders`).not.toContain(
        "recordStageTransition(",
      );
      expect(source, `${file} must not write history`).not.toContain(
        "orderStageHistory",
      );
      expect(source, `${file} must not set a current stage`).not.toContain(
        "currentStageId:",
      );
    }
  });

  it("delays are documented as email-only in the scheduler", () => {
    const scheduler = read("lib/email/scheduler.ts");
    expect(scheduler).toMatch(/delay[\s\S]{0,200}email/i);
  });
});

describe("webhook idempotency is enforced by the database", () => {
  const migration = read("drizzle/0000_init.sql");

  it("has a unique index on the Shopify event id", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events".*"shopify_event_id"/,
    );
  });

  it("schedules each sequence step at most once per order", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "email_sends_order_step_key" ON "email_sends".*"order_id","sequence_step_id"/,
    );
  });

  it("records at most one proof of delivery per order", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "proof_of_delivery_order_key" ON "proof_of_delivery".*"order_id"/,
    );
  });

  it("keeps one order row per Shopify order per store", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "orders_store_shopify_order_key" ON "orders".*"store_id","shopify_order_id"/,
    );
  });

  it("claims the event id before doing any work", () => {
    // Compare call sites, so the import block at the top does not skew the
    // ordering: HMAC check → claim the event id → only then do the work.
    const route = read("app/api/shopify/webhooks/route.ts");
    const hmacAt = route.indexOf("verifyWebhookHmac({");
    const claimAt = route.indexOf("onConflictDoNothing(");
    const handleAt = route.indexOf("handleWebhook({");

    expect(hmacAt).toBeGreaterThan(-1);
    expect(claimAt).toBeGreaterThan(hmacAt);
    expect(handleAt).toBeGreaterThan(claimAt);
  });
});

describe("no digital signature capture anywhere", () => {
  it("the proof of delivery is a paper note, not a canvas", () => {
    const files = [...walk("lib"), ...walk("app"), ...walk("components")];
    for (const file of files) {
      const source = read(file).toLowerCase();
      expect(source, `${file} must not capture a signature`).not.toContain(
        "signaturepad",
      );
      expect(source, `${file} must not capture a signature`).not.toContain(
        "getcontext(\"2d\")",
      );
    }
  });
});
