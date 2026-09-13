import { eq } from "drizzle-orm";

import { db, stores, type Store } from "@/lib/db";
import { env, isConfigured } from "@/lib/env";
import {
  isValidShopDomain,
  normalizeShopDomain,
  verifyAppProxySignature,
} from "./hmac";

export type ProxyAuthResult =
  | { ok: true; store: Store; loggedInCustomerId: string | null }
  | { ok: false; reason: string };

/**
 * Authenticates a request that arrived through the Shopify App Proxy.
 *
 * Shopify signs every forwarded request, including the query parameters the
 * storefront added, so a valid signature proves the request really came through
 * the merchant's storefront. Without this check anyone could hit our origin
 * directly and read another customer's order.
 */
export async function authenticateProxyRequest(
  searchParams: URLSearchParams,
): Promise<ProxyAuthResult> {
  const shopParam = searchParams.get("shop");
  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;

  if (!shopDomain || !isValidShopDomain(shopDomain)) {
    return { ok: false, reason: "missing-shop" };
  }

  const signatureOk = verifyAppProxySignature({
    searchParams,
    secret: env.shopify.apiSecret,
  });

  if (!signatureOk && !allowUnsignedInDevelopment()) {
    return { ok: false, reason: "bad-signature" };
  }

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.shopDomain, shopDomain))
    .limit(1);

  if (!store) return { ok: false, reason: "unknown-store" };
  if (store.status !== "active") return { ok: false, reason: "uninstalled" };

  return {
    ok: true,
    store,
    loggedInCustomerId: searchParams.get("logged_in_customer_id") || null,
  };
}

/**
 * Local-development escape hatch so the tracking page can be opened without a
 * live Shopify tunnel. It requires BOTH a non-production build and an explicit
 * opt-in variable, so a production deployment cannot enable it even by
 * accident.
 */
function allowUnsignedInDevelopment(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    isConfigured("ALLOW_UNSIGNED_APP_PROXY")
  );
}
