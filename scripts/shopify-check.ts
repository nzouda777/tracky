/**
 * Checks the Shopify app configuration before you spend another OAuth round
 * trip on it.
 *
 *   npm run shopify:check
 *   npm run shopify:check -- luneaz.myshopify.com
 *
 * Everything here is read-only. It reports what this deployment will send to
 * Shopify and what must match on the Shopify side, because almost every failed
 * first install is one of those two disagreeing — not a bug in the app.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const PASS = "✓";
const FAIL = "✗";
const WARN = "!";

let problems = 0;

function line(mark: string, text: string) {
  if (mark === FAIL) problems += 1;
  console.log(`${mark} ${text}`);
}

async function main() {
  const shopArg = process.argv[2]?.trim();

  console.log("Shopify configuration\n");

  const appUrl = (process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.SHOPIFY_API_KEY ?? "").trim();
  const apiSecret = (process.env.SHOPIFY_API_SECRET ?? "").trim();
  const scopes = (process.env.SHOPIFY_SCOPES ?? "").trim();

  // --- the three values that must be set -----------------------------------
  if (appUrl) line(PASS, `APP_URL            ${appUrl}`);
  else line(FAIL, "APP_URL is not set. OAuth cannot build a redirect URL.");

  if (apiKey) line(PASS, `SHOPIFY_API_KEY    ${apiKey}`);
  else line(FAIL, "SHOPIFY_API_KEY is not set.");

  if (apiSecret) line(PASS, `SHOPIFY_API_SECRET ${mask(apiSecret)}`);
  else line(FAIL, "SHOPIFY_API_SECRET is not set.");

  console.log(`  scopes           ${scopes || "(default)"}`);
  console.log();

  // --- which kind of app the credentials came from -------------------------
  if (apiSecret.startsWith("shpss_")) {
    line(
      WARN,
      "The API secret starts with `shpss_`, which is the shape Shopify issues\n" +
        "  for an app created inside a store's admin (Settings → Apps and sales\n" +
        "  channels → Develop apps). Those apps are installed by clicking Install\n" +
        "  and are used with an Admin API access token (`shpat_…`). They have no\n" +
        "  redirect URLs and do not support the OAuth flow this app uses.\n" +
        "  Check the app you took these keys from: if its page shows an\n" +
        "  \"Admin API access token\" and no \"Allowed redirection URL(s)\", it is\n" +
        "  that kind, and OAuth will keep failing. Create the app in the Shopify\n" +
        "  Partner dashboard instead and use those credentials.",
    );
    console.log();
  }

  if (apiSecret.startsWith("shpat_")) {
    line(
      FAIL,
      "SHOPIFY_API_SECRET holds an Admin API access token (`shpat_…`), not the\n" +
        "  app's secret key. OAuth and webhook verification will both fail.",
    );
    console.log();
  }

  // --- what Shopify has to be told ----------------------------------------
  if (appUrl) {
    console.log("These must appear in the Shopify app, exactly:\n");
    console.log(`  App URL                    ${appUrl}`);
    console.log(`  Allowed redirection URL    ${appUrl}/api/shopify/callback`);
    console.log(`  App Proxy URL              ${appUrl}/proxy/track-order`);
    console.log();

    if (/^http:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl)) {
      line(FAIL, "APP_URL is plain http. Shopify requires https off localhost.");
    }

    if (/localhost|127\.0\.0\.1/.test(appUrl)) {
      line(
        WARN,
        "APP_URL points at localhost. The OAuth redirect works, because your own\n" +
          "  browser follows it — but Shopify cannot reach localhost, so webhooks\n" +
          "  will not be delivered and the App Proxy page will not load on the\n" +
          "  storefront. Use a tunnel (`cloudflared tunnel --url http://localhost:3000`)\n" +
          "  or a deployment, and set APP_URL to that origin.",
      );
    }
  }

  // --- does the shop exist -------------------------------------------------
  if (shopArg) {
    console.log();
    const shop = shopArg.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const authorize =
      `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(apiKey)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(`${appUrl}/api/shopify/callback`)}` +
      `&state=preflight`;

    try {
      const response = await fetch(authorize, { redirect: "manual" });
      const location = response.headers.get("location") ?? "";

      if (location.includes("/admin/auth/login")) {
        line(
          PASS,
          `${shop} exists and accepted the authorize request (it asked for a login).`,
        );
        console.log(
          "  Shopify only checks the redirect URL against the allowlist after you\n" +
            "  sign in, so this cannot confirm that part. Open it yourself:\n" +
            `  ${authorize}`,
        );
      } else if (response.status === 404) {
        line(FAIL, `${shop} does not exist, or is not reachable.`);
      } else {
        line(
          WARN,
          `${shop} answered ${response.status}${location ? ` → ${location}` : ""}.`,
        );
      }
    } catch (error) {
      line(
        FAIL,
        `Could not reach ${shop}: ${error instanceof Error ? error.message : error}`,
      );
    }
  } else {
    console.log("\nPass a shop to probe it: npm run shopify:check -- acme.myshopify.com");
  }

  console.log();
  console.log(
    problems === 0
      ? "No blocking problems found in the local configuration."
      : `${problems} problem${problems === 1 ? "" : "s"} to fix.`,
  );
}

function mask(secret: string): string {
  if (secret.length <= 10) return "…";
  return `${secret.slice(0, 8)}…${secret.slice(-4)} (${secret.length} chars)`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
