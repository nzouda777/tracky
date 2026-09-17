/**
 * Checks a Shopify app's configuration before you spend another OAuth round
 * trip on it.
 *
 *   npm run shopify:check
 *   npm run shopify:check -- luneaz.myshopify.com
 *   npm run shopify:check -- luneaz.myshopify.com <client-id> <client-secret>
 *
 * App credentials live on each store row, not in this deployment's
 * environment, so there is usually nothing here to read: pass the keys of the
 * app you are about to add as the second and third arguments to preflight it.
 * The environment variables are still checked, because a store connected
 * before per-store credentials existed falls back to them.
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
  const keyArg = process.argv[3]?.trim();
  const secretArg = process.argv[4]?.trim();

  console.log("Shopify configuration\n");

  const appUrl = (process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  const scopes = (process.env.SHOPIFY_SCOPES ?? "").trim();

  // Credentials passed on the command line win: they are the app you are about
  // to add. The environment is only the fallback stores may still be using.
  const apiKey = keyArg || (process.env.SHOPIFY_API_KEY ?? "").trim();
  const apiSecret = secretArg || (process.env.SHOPIFY_API_SECRET ?? "").trim();
  const fromArgs = Boolean(keyArg || secretArg);

  if (appUrl) line(PASS, `APP_URL            ${appUrl}`);
  else line(FAIL, "APP_URL is not set. OAuth cannot build a redirect URL.");

  const origin = fromArgs ? "argument" : "environment fallback";

  if (apiKey) line(PASS, `client id          ${apiKey} (${origin})`);
  if (apiSecret) line(PASS, `client secret      ${mask(apiSecret)} (${origin})`);

  if (!apiKey || !apiSecret) {
    // Not a failure: every store carries the keys of the app it runs on, so an
    // empty environment is the normal state of a current deployment.
    line(
      WARN,
      "No app credentials to check.\n" +
        "  Stores carry their own, entered in the backoffice under Stores →\n" +
        "  Connect a store, so nothing has to be set here. To preflight an app\n" +
        "  before adding it, pass its keys:\n" +
        "    npm run shopify:check -- acme.myshopify.com <client-id> <client-secret>",
    );
  }

  console.log(`  scopes           ${scopes || "(default)"}`);
  console.log();

  // --- which kind of app the credentials came from -------------------------
  if (apiSecret.startsWith("shpat_") || apiSecret.startsWith("shpca_")) {
    line(
      FAIL,
      "That is an Admin API access token (`shpat_…`), not an app secret key.\n" +
        "  The token goes in the \"Admin API access token\" field when adding a\n" +
        "  store as a custom app; the secret key is the separate value on the\n" +
        "  same page, and is what verifies webhooks.",
    );
    console.log();
  } else if (apiSecret.startsWith("shpss_")) {
    line(
      WARN,
      "The secret starts with `shpss_`, the shape Shopify issues for an app\n" +
        "  created inside a store's admin (Settings → Apps and sales channels →\n" +
        "  Develop apps). Those apps have no redirect URL and no OAuth flow, so\n" +
        "  the authorize probe below will fail for them — that is expected.\n" +
        "  Add such a store with the \"Custom app\" option instead, pasting its\n" +
        "  Admin API access token. Everything else (webhooks, the tracking page)\n" +
        "  works the same way afterwards.",
    );
    console.log();
  }

  // --- what Shopify has to be told ----------------------------------------
  if (appUrl) {
    console.log("These must appear in EVERY Partner app you add, exactly:\n");
    console.log(`  App URL                    ${appUrl}`);
    console.log(`  Allowed redirection URL    ${appUrl}/api/shopify/callback`);
    console.log(`  App Proxy URL              ${appUrl}/proxy/track-order`);
    console.log();
    console.log(
      "  They are the same for every app, because each request identifies its\n" +
        "  own app from the shop domain it names.\n",
    );

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
  if (shopArg && apiKey) {
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
    console.log(
      "\nPass a shop and an app's keys to probe them:\n" +
        "  npm run shopify:check -- acme.myshopify.com <client-id> <client-secret>",
    );
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
