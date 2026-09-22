import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import * as credentialModule from "@/lib/shopify/credentials";

/**
 * One deployment, many Shopify apps.
 *
 * The platform used to hold a single app in SHOPIFY_API_KEY/SECRET, which
 * capped how many stores it could ever reach: a public app has an install
 * ceiling. Every store now carries the credentials of the app it was connected
 * through, so the questions these tests answer are:
 *
 *   1. Does the right secret come back for a given store?
 *   2. Does a signature made by app A fail for a store on app B?
 *   3. Is the secret stored encrypted rather than in the clear?
 *   4. Do the obvious paste mistakes get caught before they reach Shopify?
 */

const ROOT = process.cwd();

/**
 * The credential module encrypts through `lib/crypto/secrets`, which demands a
 * real 32-byte key. It is set here, at module scope, because `lib/env.ts`
 * reads every variable lazily at the point of use rather than on import — so
 * the key only has to exist before the first call, not before the import.
 *
 * That is also why the module is imported statically. Loading it pulls in
 * Drizzle and the Neon driver, and behind a dynamic `import()` inside the
 * first test the whole cost was charged to that one test's 5s budget, which it
 * intermittently blew under a full parallel run. A static import spends it
 * once, before any timeout is running.
 */
process.env.ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

async function credentials() {
  return credentialModule;
}

/** A store row with only the columns the credential layer reads. */
function storeRow(overrides: Record<string, unknown> = {}) {
  return {
    shopDomain: "acme-supply.myshopify.com",
    apiKey: null,
    apiSecret: null,
    scopes: null,
    apiVersion: null,
    ...overrides,
  } as never;
}

describe("per-store app credentials", () => {
  it("returns the store's own key and secret", async () => {
    const { credentialsFromStore, credentialColumns } = await credentials();

    const columns = credentialColumns({
      apiKey: "client-id-a",
      apiSecret: "shpss_secret_a",
      scopes: "read_orders",
      apiVersion: "2025-01",
    });

    const resolved = credentialsFromStore(storeRow(columns));

    expect(resolved).not.toBeNull();
    expect(resolved?.apiKey).toBe("client-id-a");
    expect(resolved?.apiSecret).toBe("shpss_secret_a");
    expect(resolved?.scopes).toBe("read_orders");
    expect(resolved?.apiVersion).toBe("2025-01");
    expect(resolved?.source).toBe("store");
  });

  it("never stores the secret in the clear", async () => {
    const { credentialColumns } = await credentials();

    const columns = credentialColumns({
      apiKey: "client-id-a",
      apiSecret: "shpss_secret_a",
    });

    // The key is not a secret and stays readable; the secret must not be.
    expect(columns.apiKey).toBe("client-id-a");
    expect(columns.apiSecret).not.toContain("shpss_secret_a");
    expect(columns.apiSecret.startsWith("v1.")).toBe(true);
  });

  it("gives two stores on two apps two different secrets", async () => {
    const { credentialsFromStore, credentialColumns } = await credentials();

    const first = credentialsFromStore(
      storeRow(
        credentialColumns({ apiKey: "app-a", apiSecret: "secret-a" }),
      ),
    );
    const second = credentialsFromStore(
      storeRow(
        credentialColumns({ apiKey: "app-b", apiSecret: "secret-b" }),
      ),
    );

    expect(first?.apiSecret).toBe("secret-a");
    expect(second?.apiSecret).toBe("secret-b");
  });

  it("falls back to the environment only when the store carries no keys", async () => {
    const { credentialsForStore, credentialColumns } = await credentials();

    process.env.SHOPIFY_API_KEY = "platform-key";
    process.env.SHOPIFY_API_SECRET = "platform-secret";

    const bare = credentialsForStore(storeRow());
    expect(bare?.apiSecret).toBe("platform-secret");
    expect(bare?.source).toBe("environment");

    const own = credentialsForStore(
      storeRow(credentialColumns({ apiKey: "app-a", apiSecret: "secret-a" })),
    );
    expect(own?.apiSecret).toBe("secret-a");
    expect(own?.source).toBe("store");

    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
  });

  it("returns nothing when neither the store nor the environment has keys", async () => {
    const { credentialsForStore } = await credentials();

    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;

    expect(credentialsForStore(storeRow())).toBeNull();
  });
});

describe("a webhook signed by one app is not valid for a store on another", () => {
  it("verifies only against that store's secret", async () => {
    const { credentialsFromStore, credentialColumns } = await credentials();
    const { verifyWebhookHmac } = await import("@/lib/shopify/hmac");

    const body = JSON.stringify({ id: 1234 });
    const signedByAppA = createHmac("sha256", "secret-a")
      .update(body, "utf8")
      .digest("base64");

    const storeOnAppA = credentialsFromStore(
      storeRow(credentialColumns({ apiKey: "app-a", apiSecret: "secret-a" })),
    )!;
    const storeOnAppB = credentialsFromStore(
      storeRow(credentialColumns({ apiKey: "app-b", apiSecret: "secret-b" })),
    )!;

    expect(
      verifyWebhookHmac({
        rawBody: body,
        headerHmac: signedByAppA,
        secret: storeOnAppA.apiSecret,
      }),
    ).toBe(true);

    // The whole point of resolving per store: the same payload aimed at a
    // store on a different app must not verify.
    expect(
      verifyWebhookHmac({
        rawBody: body,
        headerHmac: signedByAppA,
        secret: storeOnAppB.apiSecret,
      }),
    ).toBe(false);
  });
});

describe("credential input validation", () => {
  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  it("accepts a complete Partner app", async () => {
    const { parseCredentialInput } = await credentials();

    const result = parseCredentialInput(
      form({ authMode: "oauth", apiKey: "abc123", apiSecret: "shpss_xyz" }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authMode).toBe("oauth");
      expect(result.value.accessToken).toBe("");
    }
  });

  it("requires an access token for a custom app", async () => {
    const { parseCredentialInput } = await credentials();

    const result = parseCredentialInput(
      form({ authMode: "custom", apiKey: "abc123", apiSecret: "shpss_xyz" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.accessToken).toBeTruthy();
  });

  it("catches the access token pasted into the secret key field", async () => {
    const { parseCredentialInput } = await credentials();

    // These two sit next to each other in the Shopify admin and get swapped
    // constantly; the mistake otherwise surfaces much later, as a webhook that
    // cannot be verified.
    const result = parseCredentialInput(
      form({
        authMode: "custom",
        apiKey: "abc123",
        apiSecret: "shpat_0123456789abcdef",
        accessToken: "shpat_0123456789abcdef",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.apiSecret).toMatch(/access token/i);
    }
  });

  it("rejects a malformed API version", async () => {
    const { parseCredentialInput } = await credentials();

    const result = parseCredentialInput(
      form({
        authMode: "oauth",
        apiKey: "abc123",
        apiSecret: "shpss_xyz",
        apiVersion: "July 2025",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.apiVersion).toBeTruthy();
  });

  it("allows blank keys only when a platform-wide app still exists", async () => {
    const { parseCredentialInput } = await credentials();

    const blank = form({ authMode: "oauth" });

    expect(
      parseCredentialInput(blank, { allowPlatformFallback: true }).ok,
    ).toBe(true);
    expect(parseCredentialInput(blank).ok).toBe(false);
  });
});

describe("no Shopify signature is verified against a platform-wide secret", () => {
  const paths = [
    "app/api/shopify/callback/route.ts",
    "app/api/shopify/webhooks/route.ts",
    "lib/shopify/app-proxy.ts",
    "lib/auth/install-claim.ts",
  ];

  it.each(paths)("%s resolves its secret per store", (relative) => {
    const source = readFileSync(path.join(ROOT, relative), "utf8");

    // A single platform-wide secret here is the bug this change removes: it
    // would mean only one Shopify app could ever reach this deployment.
    expect(source).not.toContain("env.shopify.apiSecret");
  });
});
