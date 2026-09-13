import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A signed session cookie proves only that *we* minted it. It can still name
 * a user who has since been deleted, or whose database was restored from a
 * backup — and it can carry a value that is not a uuid at all.
 *
 * Both cases used to be broken:
 *   - a non-uuid id reached Postgres and raised `invalid input syntax for
 *     type uuid`, turning "not signed in" into a 500;
 *   - a deleted user was bounced /admin → /login by the page guard and
 *     /login → /admin by the middleware, so the visitor could not reach the
 *     form to sign in again.
 *
 * These are structural tests because the failure only shows up with a real
 * signed cookie, which a unit test cannot mint.
 */
const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

describe("a session that no longer resolves", () => {
  it("getCurrentUser checks the id is a uuid before querying", () => {
    const session = read("lib/auth/session.ts");
    const body = session.slice(
      session.indexOf("export async function getCurrentUser"),
      session.indexOf("export async function getMemberships"),
    );

    // The guard must run before the query, not after it throws.
    const guardAt = body.indexOf("UUID.test");
    const queryAt = body.indexOf("db.select()");
    expect(guardAt).toBeGreaterThan(-1);
    expect(queryAt).toBeGreaterThan(guardAt);
  });

  it("the middleware does not redirect away from /login", () => {
    const proxy = read("proxy.ts");
    // Middleware has no database, so it cannot tell a live session from a
    // stale one. A bounce here recreates the loop.
    expect(proxy).not.toMatch(/pathname === ["']\/login["']/);
  });

  it("the login page makes that call instead, after resolving the user", () => {
    const page = read("app/login/page.tsx");
    expect(page).toContain("getCurrentUser()");
    // Redirects only inside the branch where a user was actually found.
    const guarded = page.slice(page.indexOf("const user = await getCurrentUser()"));
    expect(guarded).toMatch(/if \(user\)/);
    expect(guarded).toContain("redirect(");
  });

  it("page guards send an unresolvable session to /login, not in a circle", () => {
    const session = read("lib/auth/session.ts");
    const requireUser = session.slice(
      session.indexOf("export async function requireUser"),
      session.indexOf("export async function requireStoreAccess"),
    );
    expect(requireUser).toContain('redirect("/login")');
  });
});
