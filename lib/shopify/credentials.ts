import { eq } from "drizzle-orm";

import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { db, stores, type Store } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Which Shopify app a given store runs on.
 *
 * The platform is multi-tenant in two directions at once: many stores, and now
 * many Shopify apps. A public app in the Partner dashboard is capped in how
 * widely it can be installed, so distributing across several stores means
 * distributing across several apps — and every Shopify signature that reaches
 * this application (webhook HMAC, OAuth callback HMAC, App Proxy signature) is
 * computed with *that app's* secret, not a platform-wide one.
 *
 * Everything that needs an app credential resolves it here, so there is one
 * answer to "which secret verifies this request" rather than one per call
 * site.
 */

export type ShopifyCredentials = {
  /** Client ID (OAuth app) or API key (custom app). */
  apiKey: string;
  /** Client secret / API secret key, in plaintext. Never log or render it. */
  apiSecret: string;
  scopes: string;
  apiVersion: string;
  /** Where the values came from, for diagnostics and health screens. */
  source: "store" | "environment";
};

/** The credentials stored on a store row, or null when it carries none. */
export function credentialsFromStore(
  store: Pick<Store, "apiKey" | "apiSecret" | "scopes" | "apiVersion">,
): ShopifyCredentials | null {
  if (!store.apiKey || !store.apiSecret) return null;

  return {
    apiKey: store.apiKey,
    apiSecret: decryptSecret(store.apiSecret),
    scopes: store.scopes ?? env.shopify.scopes,
    apiVersion: store.apiVersion ?? env.shopify.apiVersion,
    source: "store",
  };
}

/**
 * The legacy single-app credentials from the environment.
 *
 * Kept so stores connected before per-store credentials existed keep working
 * untouched: their rows have no `api_key`, and they fall back to here.
 */
export function environmentCredentials(): ShopifyCredentials | null {
  const apiKey = env.shopify.fallbackApiKey;
  const apiSecret = env.shopify.fallbackApiSecret;
  if (!apiKey || !apiSecret) return null;

  return {
    apiKey,
    apiSecret,
    scopes: env.shopify.scopes,
    apiVersion: env.shopify.apiVersion,
    source: "environment",
  };
}

/** Credentials for a store: its own first, then the environment fallback. */
export function credentialsForStore(
  store: Pick<Store, "apiKey" | "apiSecret" | "scopes" | "apiVersion">,
): ShopifyCredentials | null {
  return credentialsFromStore(store) ?? environmentCredentials();
}

export class MissingShopifyCredentialsError extends Error {
  constructor(shopDomain: string) {
    super(
      `No Shopify app credentials are configured for ${shopDomain}. Add the app's API key and secret key on the store, or set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.`,
    );
    this.name = "MissingShopifyCredentialsError";
  }
}

export function requireCredentialsForStore(
  store: Pick<Store, "shopDomain" | "apiKey" | "apiSecret" | "scopes" | "apiVersion">,
): ShopifyCredentials {
  const credentials = credentialsForStore(store);
  if (!credentials) throw new MissingShopifyCredentialsError(store.shopDomain);
  return credentials;
}

/**
 * Resolves a shop domain to its store row and the app it runs on.
 *
 * Used by the request paths where Shopify names the shop but nothing has been
 * authenticated yet — the OAuth callback, the webhook endpoint and the App
 * Proxy. The shop domain arrives unverified in all three, which is fine: it
 * only selects *which* secret to check the signature against, and a wrong
 * guess simply fails that check. Authenticity still rests entirely on the
 * signature.
 */
export async function resolveShop(shopDomain: string): Promise<{
  store: Store | null;
  credentials: ShopifyCredentials | null;
}> {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.shopDomain, shopDomain))
    .limit(1);

  return {
    store: store ?? null,
    credentials: store ? credentialsForStore(store) : environmentCredentials(),
  };
}

/** The column values to persist for a set of credentials. */
export function credentialColumns(credentials: {
  apiKey: string;
  apiSecret: string;
  scopes?: string | null;
  apiVersion?: string | null;
}) {
  return {
    apiKey: credentials.apiKey,
    apiSecret: encryptSecret(credentials.apiSecret),
    scopes: credentials.scopes ?? null,
    apiVersion: credentials.apiVersion ?? null,
  };
}

/** `shpss_1234…cdef` — enough to recognise a key, never enough to use it. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Form input
// ---------------------------------------------------------------------------

export type CredentialInput = {
  authMode: "oauth" | "custom";
  apiKey: string;
  apiSecret: string;
  /** Custom apps only: the Admin API access token, pasted by hand. */
  accessToken: string;
  scopes: string | null;
  apiVersion: string | null;
};

export type CredentialInputResult =
  | { ok: true; value: CredentialInput }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Validates the credential half of the connect-a-store form.
 *
 * The checks are shape-only and deliberately narrow — Shopify is the authority
 * on whether a key works, and it answers that on the very next request. What
 * they do catch is the paste that is obviously the wrong field, which is the
 * mistake that otherwise surfaces much later as an unverifiable webhook.
 */
export function parseCredentialInput(
  formData: FormData,
  options: { allowPlatformFallback?: boolean } = {},
): CredentialInputResult {
  const text = (name: string) => String(formData.get(name) ?? "").trim();

  const authMode = text("authMode") === "custom" ? "custom" : "oauth";
  const apiKey = text("apiKey");
  const apiSecret = text("apiSecret");
  const accessToken = text("accessToken");
  const scopes = text("scopes");
  const apiVersion = text("apiVersion");

  const fieldErrors: Record<string, string> = {};

  // Leaving both blank means "use whatever this deployment is configured
  // with", which only makes sense while a platform-wide app still exists.
  const blank = !apiKey && !apiSecret;
  if (blank && authMode === "oauth" && options.allowPlatformFallback) {
    return {
      ok: true,
      value: {
        authMode,
        apiKey: "",
        apiSecret: "",
        accessToken: "",
        scopes: scopes || null,
        apiVersion: apiVersion || null,
      },
    };
  }

  if (!apiKey) {
    fieldErrors.apiKey =
      authMode === "custom"
        ? "Copy the API key from the app's API credentials tab."
        : "Copy the Client ID from the app's configuration.";
  }
  if (!apiSecret) {
    fieldErrors.apiSecret =
      authMode === "custom"
        ? "Copy the API secret key from the app's API credentials tab."
        : "Copy the Client secret from the app's configuration.";
  }

  // The token and the secret sit next to each other in the Shopify admin and
  // get swapped constantly. Each has an unmistakable prefix, so say so.
  if (apiSecret.startsWith("shpat_") || apiSecret.startsWith("shpca_")) {
    fieldErrors.apiSecret =
      "That is an Admin API access token, not the API secret key. The secret key does not start with shpat_.";
  }
  if (authMode === "custom") {
    if (!accessToken) {
      fieldErrors.accessToken =
        "A custom app has no installation flow, so its Admin API access token has to be pasted here.";
    } else if (!/^shp(at|ca)_[A-Za-z0-9]+$/.test(accessToken)) {
      fieldErrors.accessToken =
        "An Admin API access token starts with shpat_ (or shpca_ for a collaborator app).";
    }
  }
  if (apiVersion && !/^\d{4}-\d{2}$/.test(apiVersion)) {
    fieldErrors.apiVersion = "An API version looks like 2025-07.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      authMode,
      apiKey,
      apiSecret,
      accessToken,
      scopes: scopes || null,
      apiVersion: apiVersion || null,
    },
  };
}
