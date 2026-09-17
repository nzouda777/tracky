/**
 * Asks Shopify, with one store's own credentials, why it is not behaving.
 *
 *   npm run shopify:diagnose -- crueltokind.myshopify.com
 *
 * `shopify:check` reads local configuration; this one reads the store row and
 * then makes the same calls the app makes, reporting exactly what Shopify said.
 * That is the difference between "no orders appeared" and knowing whether the
 * token was refused, the scope is missing, the window was too short, or the
 * webhooks point at an origin Shopify cannot reach.
 *
 * Read-only: it creates nothing and changes nothing, in the database or in
 * Shopify. Secrets are masked in everything it prints.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const PASS = "✓";
const FAIL = "✗";
const WARN = "!";
const INFO = "·";

function line(mark: string, text: string) {
  console.log(`${mark} ${text}`);
}

function mask(value: string | null): string {
  if (!value) return "(none)";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

type StoreRow = {
  id: string;
  shop_domain: string;
  primary_domain: string | null;
  status: string;
  auth_mode: string | null;
  api_key: string | null;
  api_secret: string | null;
  access_token: string | null;
  scope: string | null;
  scopes: string | null;
  api_version: string | null;
  installed_at: string | null;
};

async function main() {
  const shopArg = process.argv[2]?.trim();

  const shop = (shopArg ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");

  const { neon, neonConfig } = await import("@neondatabase/serverless");
  if (process.env.NEON_HTTP_ENDPOINT) {
    neonConfig.fetchEndpoint = process.env.NEON_HTTP_ENDPOINT;
  }
  const sql = neon(url);

  // Matching the customer-facing domain too, because that is the one people
  // have in front of them when something looks wrong on the storefront.
  const rows = (await sql`
    SELECT id, shop_domain, primary_domain, status, auth_mode, api_key,
           api_secret, access_token, scope, scopes, api_version, installed_at
    FROM stores
    WHERE shop_domain = ${shop} OR primary_domain = ${shop}
    LIMIT 1
  `) as unknown as StoreRow[];

  const store = rows[0];
  if (!store) {
    if (shop) line(FAIL, `${shop} is not in the database.\n`);
    const all = (await sql`
      SELECT shop_domain, primary_domain, status FROM stores ORDER BY created_at
    `) as unknown as Array<{
      shop_domain: string;
      primary_domain: string | null;
      status: string;
    }>;

    if (all.length === 0) {
      line(FAIL, "No stores are connected yet. Add one in /admin/stores.");
    } else {
      console.log("Stores in this database:\n");
      for (const row of all) {
        console.log(
          `  ${row.shop_domain.padEnd(36)} ${row.status.padEnd(12)} ${row.primary_domain ?? ""}`,
        );
      }
      console.log("\nRun again with one of them.");
    }
    process.exitCode = 1;
    return;
  }

  // --- what the database holds ---------------------------------------------
  console.log(`Store ${store.shop_domain}\n`);
  line(store.status === "active" ? PASS : FAIL, `status           ${store.status}`);
  line(INFO, `auth mode        ${store.auth_mode ?? "oauth"}`);
  line(
    store.api_key ? PASS : WARN,
    `app key          ${store.api_key ?? "(none — using the environment fallback)"}`,
  );
  line(
    store.api_secret ? PASS : WARN,
    `app secret       ${store.api_secret ? "stored, encrypted" : "(none — using the environment fallback)"}`,
  );
  line(
    store.access_token ? PASS : FAIL,
    `access token     ${store.access_token ? "stored, encrypted" : "MISSING — nothing can be read from Shopify"}`,
  );
  line(INFO, `granted scopes   ${store.scope ?? "(not recorded)"}`);
  line(INFO, `api version      ${store.api_version ?? process.env.SHOPIFY_API_VERSION ?? "2025-07"}`);
  line(INFO, `installed at     ${store.installed_at ?? "(never)"}`);
  console.log();

  const primaryDomain = store.primary_domain;

  /**
   * The origin Shopify actually talks to.
   *
   * Not APP_URL: this script is usually run from a developer's checkout, whose
   * .env points at localhost, while the store is installed against a
   * deployment. The webhooks Shopify holds name that deployment, so they are
   * the honest source — advice built on APP_URL would tell you to paste
   * `http://localhost:3000` into the Partner dashboard.
   */
  let deploymentOrigin = (process.env.APP_URL ?? "").replace(/\/+$/, "");

  if (!store.access_token) return;

  // --- decrypt the token, the same way the app does -------------------------
  const { decryptSecret } = await import("../lib/crypto/secrets");
  let token: string;
  try {
    token = decryptSecret(store.access_token);
  } catch (error) {
    line(
      FAIL,
      `The stored access token could not be decrypted: ${error instanceof Error ? error.message : error}.\n` +
        "  ENCRYPTION_KEY does not match the one the token was stored with.",
    );
    process.exitCode = 1;
    return;
  }
  line(INFO, `token            ${mask(token)}`);

  const version =
    store.api_version ?? process.env.SHOPIFY_API_VERSION ?? "2025-07";
  const base = `https://${store.shop_domain}/admin/api/${version}`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // --- 1. does the token work at all? --------------------------------------
  console.log("\nShopify says:\n");

  const shopResponse = await fetch(`${base}/shop.json`, { headers });
  if (shopResponse.ok) {
    const body = (await shopResponse.json()) as { shop?: { name?: string } };
    line(PASS, `shop.json        ${body.shop?.name ?? "(no name)"} — the token works.`);
  } else {
    line(
      FAIL,
      `shop.json        ${shopResponse.status} ${shopResponse.statusText}\n` +
        `  ${(await shopResponse.text()).slice(0, 300)}`,
    );
    return;
  }

  // --- 2. the scopes Shopify actually granted ------------------------------
  const scopeResponse = await fetch(
    `https://${store.shop_domain}/admin/oauth/access_scopes.json`,
    { headers },
  );
  let granted: string[] = [];
  if (scopeResponse.ok) {
    const body = (await scopeResponse.json()) as {
      access_scopes?: Array<{ handle: string }>;
    };
    granted = (body.access_scopes ?? []).map((entry) => entry.handle);
    line(PASS, `granted scopes   ${granted.join(", ") || "(none)"}`);
  } else {
    line(WARN, `access_scopes    ${scopeResponse.status} — could not read them.`);
  }

  for (const needed of ["read_orders", "write_orders", "write_fulfillments"]) {
    if (granted.length > 0 && !granted.includes(needed)) {
      line(
        FAIL,
        `  missing scope  ${needed} — reinstall the app with it in its configuration.`,
      );
    }
  }

  // --- 3. the exact call "Sync orders" makes -------------------------------
  for (const days of [7, 60]) {
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const response = await fetch(
      `${base}/orders.json?limit=50&status=any&created_at_min=${encodeURIComponent(since)}`,
      { headers },
    );

    if (!response.ok) {
      const text = await response.text();
      line(
        FAIL,
        `orders (${days}d)     ${response.status} ${response.statusText}\n  ${text.slice(0, 400)}`,
      );
      if (response.status === 403 && text.includes("customer")) {
        line(
          WARN,
          "  This is Shopify's protected customer data gate. In the Partner\n" +
            "  dashboard, open the app → API access → Protected customer data\n" +
            "  access, and request it. A custom app created inside the store's\n" +
            "  own admin has it by default; a Partner app does not.",
        );
      }
      continue;
    }

    const body = (await response.json()) as { orders?: unknown[] };
    const count = body.orders?.length ?? 0;
    line(
      count > 0 ? PASS : WARN,
      `orders (${days}d)     ${count} order${count === 1 ? "" : "s"} returned`,
    );
  }

  // --- 4. where this store's webhooks point --------------------------------
  const webhookResponse = await fetch(`${base}/webhooks.json?limit=250`, {
    headers,
  });
  if (webhookResponse.ok) {
    const body = (await webhookResponse.json()) as {
      webhooks?: Array<{ topic: string; address: string }>;
    };
    const hooks = body.webhooks ?? [];
    if (hooks.length === 0) {
      line(FAIL, "webhooks         none registered — no order will arrive on its own.");
    } else {
      line(PASS, `webhooks         ${hooks.length} registered`);
      for (const hook of hooks) {
        console.log(`    ${hook.topic.padEnd(22)} ${hook.address}`);
      }
      const registeredOrigin = originOf(hooks[0]?.address);
      if (registeredOrigin) deploymentOrigin = registeredOrigin;

      const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
      if (appUrl && registeredOrigin && registeredOrigin !== appUrl) {
        line(
          INFO,
          `  They point at ${registeredOrigin}, not the APP_URL in this\n` +
            `  checkout (${appUrl}). Expected when running this from a dev\n` +
            "  machine; a problem only if that is not where the app is deployed.",
        );
      }
    }
  } else {
    line(WARN, `webhooks         ${webhookResponse.status} — could not read them.`);
  }

  // --- 5. is there an App Proxy on this app? -------------------------------
  //
  // The tracking page on the merchant's own domain is served through one, and
  // a missing proxy is exactly what a 404 on /apps/track-order looks like.
  // Redirects are followed: a storefront on a custom domain answers the
  // myshopify host with a 301 to it, and stopping there would report a pass
  // for a path that 404s one hop later.
  console.log();
  let missingProxy = false;
  let escapedRedirect = false;

  for (const host of [
    store.shop_domain,
    ...(primaryDomain && primaryDomain !== store.shop_domain
      ? [primaryDomain]
      : []),
  ]) {
    const requested = `https://${host}/apps/track-order`;
    const probe = await fetch(requested, { redirect: "follow" });

    // A redirect the proxied app emitted is passed back to the browser, which
    // resolves it against the *merchant's* domain — so it lands on a path the
    // storefront has never heard of. The tell is a final URL still on the
    // storefront but no longer under /apps.
    const landedOffProxy =
      !new URL(probe.url).pathname.startsWith("/apps/track-order");
    if (landedOffProxy) escapedRedirect = true;
    else if (probe.status === 404) missingProxy = true;

    line(
      probe.status === 404 ? FAIL : PASS,
      `${requested.padEnd(50)} ${probe.status}${landedOffProxy ? `\n  ended at ${probe.url}` : ""}`,
    );
  }

  if (escapedRedirect) {
    line(
      FAIL,
      "  The app answered the proxied request with a redirect, and Shopify\n" +
        "  passed it back to the browser, which resolved it against the\n" +
        "  merchant's domain — where that path does not exist. Hence a 404 on\n" +
        "  the storefront rather than the tracking page.\n" +
        "  Almost always a trailing slash on the App Proxy URL in the Shopify\n" +
        "  dashboard. Set it to exactly, with no slash at the end:\n" +
        `      ${deploymentOrigin || "https://your-app"}/proxy/track-order\n` +
        "  `skipTrailingSlashRedirect` in next.config.ts also stops the app\n" +
        "  from redirecting at all — check that deployment carries it.",
    );
  }

  if (missingProxy) {
    line(
      WARN,
      "  Shopify is not forwarding that path, which means this app has no App\n" +
        "  Proxy configured — the tracking page cannot be served on the\n" +
        "  merchant's domain until it is.\n" +
        "    Partner app: app → Configuration → App proxy →\n" +
        `      prefix "apps", subpath "track-order", URL ${deploymentOrigin || "https://your-app"}/proxy/track-order\n` +
        "    Custom app (created in the store's own admin): App Proxies are not\n" +
        "      available at all. Use the hosted page instead:\n" +
        `      ${deploymentOrigin || "https://your-app"}/track/${store.shop_domain}`,
    );
  }
}

/** The scheme and host of a URL, or null when it is not one. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
