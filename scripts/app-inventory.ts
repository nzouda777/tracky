/**
 * Which Shopify app is each store running on, and is it fully wired up?
 *
 *   npm run apps:inventory
 *
 * Tracky runs many Shopify apps at once, because one app is capped in how
 * widely it can be installed. That makes "which app is this store on?" the
 * first question behind a whole family of confusing symptoms:
 *
 *   - the thank-you block is missing from the checkout editor
 *     → the extension was never deployed under *that* app
 *   - /apps/track-order returns 404
 *     → that app has no App Proxy configured
 *
 * Both are invisible from the Shopify admin, which shows only the one app you
 * happen to be looking at. This prints the whole picture at once.
 *
 * Read-only. It queries the database and makes one GET per storefront.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { trackingPath } from "../lib/tracking/links";

type LocalApp = { file: string; name: string; clientId: string; hasProxy: boolean };

/**
 * The app configurations checked into this repo.
 *
 * A store whose `api_key` matches none of these is the interesting case: there
 * is no `shopify.app.<name>.toml` to deploy the extension from, so it almost
 * certainly never received one.
 */
function localApps(): LocalApp[] {
  const found: LocalApp[] = [];

  for (const file of readdirSync(process.cwd())) {
    if (!/^shopify\.app\..*\.toml$/.test(file) && file !== "shopify.app.toml") {
      continue;
    }
    const raw = readFileSync(path.join(process.cwd(), file), "utf8");
    const clientId = raw.match(/^\s*client_id\s*=\s*"([^"]+)"/m)?.[1] ?? "";
    const name = raw.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] ?? "(unnamed)";
    // The root file is a placeholder template, never a real app.
    if (!clientId || clientId.startsWith("REPLACE_WITH")) continue;
    found.push({ file, name, clientId, hasProxy: /\[app_proxy\]/.test(raw) });
  }

  return found;
}

/** Whether the tracking page actually answers on this storefront. */
async function proxyAnswers(host: string): Promise<string> {
  const url = `https://${host}${trackingPath()}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return `HTTP ${response.status}`;
    const body = await response.text();
    // The embedded stylesheet scopes everything under this id, so its presence
    // means our page rendered rather than the theme's 404.
    return /tracky-tracking/.test(body) ? "ok" : `HTTP 200 but not our page`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function main(): Promise<void> {
  const apps = localApps();
  console.log(`App configurations in this repo: ${apps.length}`);
  for (const app of apps) {
    console.log(
      `  ${app.clientId}  ${app.file.padEnd(30)} ${app.hasProxy ? "app_proxy ✓" : "app_proxy MISSING"}`,
    );
  }
  console.log();

  const { db, stores } = await import("../lib/db");
  const { asc } = await import("drizzle-orm");
  const rows = await db.select().from(stores).orderBy(asc(stores.createdAt));

  const orphans: string[] = [];

  for (const store of rows) {
    const app = apps.find((entry) => entry.clientId === store.apiKey);
    const host = store.primaryDomain ?? store.shopDomain;

    console.log(`${store.name ?? store.shopDomain}  (${store.shopDomain})`);
    console.log(
      `  status        ${store.status}${store.pausedAt ? ", PAUSED" : ""}${store.suspendedAt ? ", SUSPENDED" : ""}`,
    );

    if (!store.apiKey) {
      console.log("  app           (none — falls back to this deployment's env keys)");
    } else if (app) {
      console.log(`  app           ${store.apiKey}  → ${app.file}`);
    } else {
      console.log(`  app           ${store.apiKey}  → NO LOCAL CONFIG`);
      orphans.push(`${store.shopDomain} (${store.apiKey})`);
    }

    console.log(
      `  tracking page ${store.status === "active" ? await proxyAnswers(host) : "skipped, store not active"}`,
    );
    console.log();
  }

  if (orphans.length) {
    console.log("─".repeat(72));
    console.log(
      `${orphans.length} store(s) run on an app with no configuration in this repo:\n` +
        orphans.map((line) => `  ${line}`).join("\n") +
        "\n\nThe thank-you block is almost certainly missing for them. Fix with:\n" +
        "  shopify app config link            # pick that app\n" +
        "  shopify app deploy -c <name>\n" +
        "\nSee docs/new-shopify-app.md.",
    );
  } else {
    console.log("Every store's app has a configuration in this repo.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
