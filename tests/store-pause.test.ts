import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { storeStatusEnum } from "@/lib/db/schema";

/**
 * Pausing a store is not the same as losing it.
 *
 * An owner pauses a store to stop talking to customers for a while — a
 * holiday, a stock-out, a quiet spell. Everything else must survive: the
 * Shopify connection, the incoming webhooks, and above all the owner's own
 * access to the screen holding the button that undoes it.
 *
 * That last one is the trap these tests exist for. The codebase already has
 * two ways to take a store out of circulation, and both are read as access
 * gates in `lib/auth/session.ts`:
 *
 *   status = uninstalled   Shopify's doing, the app was removed
 *   suspendedAt            a platform operator's doing, a hold on the account
 *
 * Reusing either one for a self-service pause would lock the owner out of
 * their own backoffice, leaving no way back in. So the pause is a third,
 * separate thing, and it must stay separate.
 */

const ROOT = process.cwd();

/**
 * Line endings are normalised because this repo is checked out with
 * `core.autocrlf=true`: a file straight from git arrives with CRLF, while one
 * a tool has rewritten is LF. Any assertion spanning a newline would pass or
 * fail depending on which of the two a given checkout produced.
 */
function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8").replace(/\r\n/g, "\n");
}

describe("a pause never becomes an access gate", () => {
  it("is not consulted when resolving what a user may open", () => {
    // `getMemberships` and `requireStoreById` both live here and both already
    // filter on `status` and `suspendedAt`. Adding `pausedAt` alongside them
    // would be a one-way door: the owner pauses the store, the store drops out
    // of their membership list, and the Resume button becomes unreachable.
    const session = read("lib/auth/session.ts");
    expect(
      session,
      "lib/auth/session.ts must not filter on pausedAt — it would lock the owner out of their own Resume button",
    ).not.toMatch(/pausedAt/);
  });

  it("is not a store status", () => {
    // A `paused` member of this enum would be caught by every
    // `status !== "active"` check in the codebase, which is the same trap by
    // another route.
    expect(storeStatusEnum.enumValues).not.toContain("paused");
    expect(storeStatusEnum.enumValues).toContain("active");
  });

  it("is a column of its own, not a reuse of the operator suspension", () => {
    const schema = read("lib/db/schema.ts");
    expect(schema).toMatch(/pausedAt:\s*timestamp\("paused_at"/);
    // Still present and still distinct: an operator hold and an owner's pause
    // answer to different people and have different consequences.
    expect(schema).toMatch(/suspendedAt:\s*timestamp\("suspended_at"/);
  });
});

describe("a paused store stops facing outward", () => {
  it("sends no customer email", () => {
    const send = read("lib/email/send.ts");
    expect(send).toMatch(/store\.pausedAt/);
    // A skip, not a failure: nothing went wrong, and the row stays in the
    // store's history as a record of what the customer was not told.
    expect(send).toMatch(/if \(store\.pausedAt\) return \{ skip:/);
  });

  it("writes no fulfillment back to Shopify", () => {
    const fulfillment = read("lib/fulfillment/index.ts");
    expect(fulfillment).toMatch(/store\.pausedAt/);
    expect(fulfillment).toMatch(/status: "skipped"/);
  });
});

describe("the pause itself is authorised", () => {
  it("proves ownership of the store named in the form", () => {
    const source = read("lib/actions/stores.ts");
    const action = source.slice(source.indexOf("export async function setStorePausedAction"));
    expect(action).toBeTruthy();

    // The store id arrives from the client, so it is authorised rather than
    // trusted. `requireStoreById` is what ties this caller to that store;
    // without it any signed-in user could pause anyone's store.
    const body = action.slice(0, action.indexOf("\n}\n") + 1);
    expect(body).toMatch(/requireStoreById\(\s*storeId,\s*\["owner"\]\s*\)/);
  });
});
