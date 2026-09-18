import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every server action that touches store data must authorise on the server.
 *
 * This is a structural test: it reads each exported action and asserts it
 * begins with one of the role guards. Hiding a button in the UI is never the
 * control, and a new action added without a guard fails here.
 */

const ROOT = process.cwd();
const ACTIONS_DIR = "lib/actions";

const GUARDS = [
  "requireOwner(",
  "requireAgency(",
  "requireStoreAccess(",
  "requireStoreById(",
  "requireUser(",
  // Cross-tenant operator commands. Narrower than the rest, not wider: it
  // 404s for anyone who is not a platform operator.
  "requirePlatformAdmin(",
];

/**
 * Public entry points that are unauthenticated by design: signing in,
 * claiming a freshly installed store, and accepting an invitation. Each
 * authorises on its own single-use, signed credential instead of a session.
 */
const UNAUTHENTICATED_BY_DESIGN = [
  "app/login/actions.ts",
  "app/claim/actions.ts",
  "app/invite/actions.ts",
];

function walk(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  const entries: string[] = [];
  for (const name of readdirSync(absolute)) {
    const full = path.join(absolute, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(path.join(dir, name)));
    } else if (/.(ts|tsx)$/.test(name)) {
      entries.push(path.join(dir, name));
    }
  }
  return entries;
}

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

/** Splits a module into `export async function name(...) { … }` chunks. */
function exportedFunctions(source: string): Array<{ name: string; body: string }> {
  const parts = source.split(/export async function /).slice(1);
  return parts.map((part) => ({
    name: part.slice(0, part.indexOf("(")).trim(),
    body: part,
  }));
}

describe("server-side authorisation", () => {
  const files = readdirSync(path.join(ROOT, ACTIONS_DIR))
    .filter((name) => name.endsWith(".ts") && name !== "result.ts")
    .map((name) => `${ACTIONS_DIR}/${name}`);

  it("finds the action modules", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files)("%s guards every exported action", (file) => {
    const functions = exportedFunctions(read(file));
    expect(functions.length).toBeGreaterThan(0);

    for (const fn of functions) {
      const guarded = GUARDS.some((guard) => fn.body.includes(guard));
      expect(guarded, `${file} → ${fn.name} has no role guard`).toBe(true);
    }
  });

  it("only the owner may edit stages, templates, branding and settings", () => {
    for (const file of [
      "lib/actions/stages.ts",
      "lib/actions/emails.ts",
      "lib/actions/branding.ts",
      "lib/actions/settings.ts",
    ]) {
      const functions = exportedFunctions(read(file));
      for (const fn of functions) {
        expect(
          fn.body.includes("requireOwner("),
          `${file} → ${fn.name} must be owner-only`,
        ).toBe(true);
      }
    }
  });

  it("agency actions never reach owner-only areas", () => {
    const orders = read("lib/actions/orders.ts");

    // The agency can update a stage and confirm a delivery…
    expect(orders).toContain("requireAgency()");
    // …and the manual override stays owner-only.
    const overrideBlock = orders.slice(
      orders.indexOf("export async function overrideStageAction"),
      orders.indexOf("export async function advanceStageAction"),
    );
    expect(overrideBlock).toContain("requireOwner()");
    expect(overrideBlock).not.toContain("requireAgency()");
  });

  it("documents the unauthenticated entry points explicitly", () => {
    for (const file of UNAUTHENTICATED_BY_DESIGN) {
      const source = read(file);
      // Each must verify something other than a session before granting access.
      const verifies =
        source.includes("signIn(") ||
        source.includes("readInstallClaim(") ||
        source.includes("inviteToken");
      expect(verifies, `${file} must verify a credential`).toBe(true);
    }
  });

  it("the App Proxy tracking surfaces verify the Shopify signature", () => {
    for (const file of [
      "app/proxy/track-order/route.ts",
      "app/proxy/track-order/address/route.ts",
    ]) {
      expect(read(file)).toContain("authenticateProxyRequest(");
    }
  });

  /**
   * The hosted tracking page has no App Proxy signature, so the lookup rules
   * are the whole of its protection. If someone ever relaxes them there, this
   * fails.
   */
  it("the hosted tracking page reuses the shared lookup, never its own query", () => {
    const page = read("app/track/[shop]/page.tsx");

    expect(page).toContain("findPublicOrder(");
    expect(page).toContain("buildPublicOrderView(");
    // It must not hand-roll a query against orders, which could skip the
    // "order number AND email" requirement.
    expect(page).not.toContain("tdb.findMany(orders");
    expect(page).not.toContain("tdb.findFirst(orders");
    // An unconnected store is indistinguishable from one that never existed.
    expect(page).toContain("notFound()");
  });

  /**
   * Opening an order on less than the full pair is a privilege a route has to
   * ask for in writing.
   *
   * There are two such relaxations — an order number alone, and an email alone
   * — and the rule is the same for both: the parameter defaults to off, the
   * query is unreachable without it, and a caller that wants it has to say so.
   * Which one a surface enables is a product decision that has changed before
   * and will change again; that it stays a decision is what this pins down.
   */
  it("findPublicOrder refuses a partial lookup unless asked", () => {
    const lookup = read("lib/tracking/lookup.ts");
    const body = lookup.slice(
      lookup.indexOf("export async function findPublicOrder"),
    );

    // Both relaxations are off unless the caller opts in.
    expect(body).toMatch(/allowOrderNumberOnly = false/);
    expect(body).toMatch(/allowEmailOnly = false/);

    // An order number alone reaches nothing without its opt-in.
    expect(body).toMatch(/if \(!mail && !allowOrderNumberOnly\) return null;/);

    // An email alone reaches nothing without its own, and an empty email
    // reaches nothing at all — otherwise the query would match whichever
    // order happened to come back first.
    expect(body).toMatch(/if \(!mail \|\| !allowEmailOnly\) return null;/);
  });

  it("both customer surfaces share one lookup policy", () => {
    // The two pages are the same product to a customer, so they must not
    // disagree about what proves an order is theirs — a surface quietly
    // accepting less than the other is how the weaker one becomes the way in.
    const proxy = read("app/proxy/track-order/route.ts");
    const hosted = read("app/track/[shop]/page.tsx");

    for (const page of [proxy, hosted]) {
      expect(page).toContain("mode: CUSTOMER_LOOKUP_MODE");
      // Never a literal mode alongside the shared constant.
      expect(page).not.toMatch(/mode: "(two-factor|email-only|order-only)"/);
    }

    // And every opt-in is tied to the access level that produced it, never
    // passed unconditionally.
    for (const page of [proxy, hosted]) {
      for (const [flag, level] of [
        ["allowEmailOnly", "email"],
        ["allowOrderNumberOnly", "order-number"],
      ]) {
        if (page.includes(`${flag}:`)) {
          expect(page).toContain(`${flag}: lookup.access === "${level}"`);
        }
      }
    }
  });

  /**
   * Whatever the current policy is, the levels that reveal a delivery address
   * are decided in exactly one predicate, so tightening or relaxing it is a
   * single edit rather than a hunt through the surfaces.
   */
  it("one predicate decides what reveals personal details", () => {
    const lookup = read("lib/tracking/lookup.ts");

    expect(lookup).toContain("export function isVerifiedAccess");

    const body = lookup.slice(
      lookup.indexOf("export function isVerifiedAccess"),
    );
    const firstReturn = body.slice(0, body.indexOf(";"));

    // A guessed order number never counts as proof, under any policy.
    expect(firstReturn).not.toContain("order-number");
    expect(firstReturn).toContain("token");
  });

  /**
   * The address form posts the order's tracking token in a hidden field, and
   * that token is a permanent credential for the order. Rendering it for a
   * visitor who only guessed an order number would turn a read into a write.
   */
  it("the restricted view never renders the address form", () => {
    const page = read("components/tracking/tracking-page.tsx");
    expect(page).toContain('const unverified = access === "order-number"');

    // There is exactly one <EditAddressForm>, and the condition immediately
    // guarding it tests `unverified`. Checking the guard rather than a
    // particular phrasing keeps this from failing on a harmless reshuffle
    // while still failing if the gate is dropped.
    expect(page.split("<EditAddressForm")).toHaveLength(2);

    const guard = page.slice(
      Math.max(0, page.indexOf("<EditAddressForm") - 120),
      page.indexOf("<EditAddressForm"),
    );
    expect(guard).toContain("unverified");

    // The street address is masked on the same condition.
    // Matched as a pattern rather than an exact slice of source. The previous
    // form pinned the indentation of a ternary, so merely reformatting the
    // file failed a security guardrail while the protection it guards was
    // untouched — a check that cries wolf gets deleted by the next person.
    const shipTo = page.slice(
      page.indexOf("const shipTo"),
      page.indexOf("formatAddressLines(address)"),
    );
    expect(shipTo).toMatch(/const shipTo\s*=\s*unverified\s*\?/);
    // The masked branch gives the locality, never the doorstep.
    expect(shipTo).toContain("address?.city");
    expect(shipTo).not.toContain("address?.address1");
  });

  it("both address handlers share one implementation", () => {
    // A security-relevant rule duplicated in two routes is a rule that will
    // drift, so both must delegate to the same function.
    for (const file of [
      "app/proxy/track-order/address/route.ts",
      "app/track/[shop]/address/route.ts",
    ]) {
      expect(read(file)).toContain("applyCustomerAddressChange(");
    }

    const shared = read("lib/tracking/address.ts");
    expect(shared).toContain("isAddressEditable(");
    // Editing an address is not delivery progress.
    expect(shared).not.toContain("orderStageHistory");
  });

  it("the cron sweep and the QStash job both authenticate their caller", () => {
    const sweep = read("app/api/cron/sweep-emails/route.ts");
    // The sweep answers to two schedulers, so it needs both checks.
    expect(sweep).toContain("safeEqual(");
    expect(sweep).toContain("verifyQstashSignature(");

    expect(read("app/api/jobs/send-email/route.ts")).toContain(
      "verifyQstashSignature(",
    );

    // …and the shared verifier really verifies, rather than waving it through.
    const verifier = read("lib/queue/qstash.ts");
    expect(verifier).toContain("Receiver");
    expect(verifier).toContain("receiver.verify(");
  });

  /**
   * Every entry point of the sweep must authenticate. It deletes nothing and
   * sends only what is already due, but an open endpoint would still let
   * anyone drain the queue at a time of their choosing.
   */
  it("no sweep handler runs before it has checked the caller", () => {
    const sweep = read("app/api/cron/sweep-emails/route.ts");
    const handlers = sweep.match(/export async function (GET|POST)/g) ?? [];
    expect(handlers.length).toBeGreaterThan(0);

    for (const handler of handlers) {
      const body = sweep.slice(sweep.indexOf(handler));
      const firstSweep = body.indexOf("sweepDueEmails()");
      const firstCheck = Math.min(
        ...[body.indexOf("hasCronSecret("), body.indexOf("verifyQstashSignature(")]
          .filter((index) => index >= 0)
          .concat(Number.MAX_SAFE_INTEGER),
      );
      expect(firstCheck, `${handler} must authenticate first`).toBeLessThan(
        firstSweep,
      );
    }
  });

  /**
   * The platform panel is the single sanctioned exception to tenant scoping.
   * These tests keep that exception narrow and visible: it must be one
   * directory, behind one guard, read-only, and never reachable by a store
   * owner who is not an operator.
   */
  describe("the cross-tenant platform panel", () => {
    const platformPages = [
      "app/platform/page.tsx",
      "app/platform/stores/page.tsx",
      "app/platform/users/page.tsx",
      "app/platform/health/page.tsx",
      "app/platform/layout.tsx",
    ];

    it.each(platformPages)("%s is behind requirePlatformAdmin", (file) => {
      expect(read(file)).toContain("requirePlatformAdmin()");
    });

    it("is the only place that queries across stores without TenantDb", () => {
      /**
       * `lib/email/send.ts` runs from a QStash callback and a cron sweep,
       * where there is no signed-in user and therefore no ambient tenant: it
       * is handed an `email_sends` row and must load the order it points at.
       * It compensates by asserting `order.storeId === send.storeId` and
       * skipping the send otherwise — the check just below pins that.
       */
      const backgroundJobs = ["lib/email/send.ts"];

      const offenders = [...walk("app"), ...walk("lib")]
        .map((file) => file.split(path.sep).join("/"))
        .filter((file) => !file.startsWith("lib/platform/"))
        .filter((file) => !file.startsWith("app/platform/"))
        .filter((file) => !backgroundJobs.includes(file))
        .filter((file) => {
          const source = read(file);
          // A direct `db.select().from(orders)` outside the platform module
          // and outside the tenant layer itself would be unscoped.
          return /\bdb\s*\n?\s*\.select\([^)]*\)\s*\n?\s*\.from\(\s*orders\s*\)/.test(
            source,
          );
        });

      expect(offenders).toEqual([]);
    });

    it("the one background job without a tenant re-checks the store itself", () => {
      const send = read("lib/email/send.ts");
      // Defence in depth: a send row must never be used to email a customer
      // of a different store.
      expect(send).toContain("order.storeId !== send.storeId");
    });

    it("refuses access by 404, so it does not announce itself", () => {
      const guard = read("lib/auth/platform.ts");
      expect(guard).toContain("notFound()");
      // Never a redirect to a sign-in or an explicit permission error.
      expect(guard).not.toContain("ForbiddenError");
    });

    it("only an existing operator can grant the role", () => {
      const guard = read("lib/auth/platform.ts");
      expect(guard).toContain("PLATFORM_ADMIN_EMAILS");
      expect(guard).toContain("isPlatformAdmin");

      // The one action that sets the flag lives in the platform action module
      // and is itself behind requirePlatformAdmin — a store owner has no path
      // to it.
      const setters = readdirSync(path.join(ROOT, ACTIONS_DIR))
        .map((name) => `${ACTIONS_DIR}/${name}`)
        .filter((file) => read(file).includes("isPlatformAdmin"));

      expect(setters).toEqual(["lib/actions/platform.ts"]);
      expect(read("lib/actions/platform.ts")).toContain("requirePlatformAdmin()");
    });

    /**
     * The panel can now write, so reads and commands are split across two
     * modules. Keeping `queries.ts`/`detail.ts` read-only means "can the
     * platform panel change this?" is answered by which module a function
     * lives in, not by reading every function body.
     */
    it("the read models stay strictly read-only", () => {
      for (const file of ["lib/platform/queries.ts", "lib/platform/detail.ts"]) {
        const source = read(file);
        for (const write of [".insert(", ".update(", ".delete("]) {
          expect(source, `${file} must not ${write}`).not.toContain(write);
        }
      }
    });

    it("every platform command is guarded and audited", () => {
      const actions = read("lib/actions/platform.ts");
      const functions = exportedFunctions(actions);
      expect(functions.length).toBeGreaterThan(5);

      for (const fn of functions) {
        expect(
          fn.body.includes("requirePlatformAdmin()"),
          `${fn.name} has no platform guard`,
        ).toBe(true);
        expect(
          fn.body.includes("recordPlatformAction("),
          `${fn.name} does not write an audit entry`,
        ).toBe(true);
      }
    });

    it("the audit log is append-only", () => {
      const audit = read("lib/platform/audit.ts");
      // A log an operator can edit proves nothing.
      expect(audit).toContain("db.insert(platformAuditLog)");
      expect(audit).not.toContain("update(platformAuditLog");
      expect(audit).not.toContain("delete(platformAuditLog");

      const everywhere = [...walk("app"), ...walk("lib")]
        .map((file) => file.split(path.sep).join("/"))
        .filter((file) => {
          const source = read(file);
          return (
            /\.update\(\s*platformAuditLog/.test(source) ||
            /\.delete\(\s*platformAuditLog/.test(source)
          );
        });
      expect(everywhere).toEqual([]);
    });

    it("refuses the moves that would lock the platform out of itself", () => {
      const actions = read("lib/actions/platform.ts");

      // Disabling or de-admining yourself has no in-app recovery.
      expect(actions).toContain("You cannot disable your own account.");
      expect(actions).toMatch(/cannot revoke your own platform access/);
      // Never zero operators, never a store with no owner.
      expect(actions).toMatch(/last platform operator/);
      expect(actions).toMatch(/no owner/);
    });

    it("a disabled account loses access on the next request", () => {
      const session = read("lib/auth/session.ts");
      // Checked on every session resolution, not only at sign-in — otherwise
      // an existing JWT keeps working for up to two weeks.
      expect(session).toContain("if (user.disabledAt) return null;");
      expect(read("auth.ts")).toContain("user?.disabledAt");
    });

    it("a suspended store is unreachable from either guard", () => {
      const session = read("lib/auth/session.ts");
      const occurrences = session.split("isNull(stores.suspendedAt)").length - 1;
      // getMemberships and requireStoreById both have to check it.
      expect(occurrences).toBe(2);
    });
  });

  it("Shopify access tokens are encrypted before they are stored", () => {
    const callback = read("app/api/shopify/callback/route.ts");
    expect(callback).toContain("encryptSecret(accessToken)");
    expect(callback).not.toMatch(/accessToken:\s*accessToken/);
  });

  it("uninstalling a store destroys its access token", () => {
    const handlers = read("lib/shopify/handlers.ts");
    const uninstall = handlers.slice(handlers.indexOf("handleAppUninstalled"));
    expect(uninstall).toContain("accessToken: null");
    expect(uninstall).toContain('status: "uninstalled"');
  });
});
