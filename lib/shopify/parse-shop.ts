import { isValidShopDomain, normalizeShopDomain } from "./hmac";

/**
 * Turns whatever a merchant pastes into a canonical `*.myshopify.com` domain.
 *
 * Adding a store should be one paste, not a lesson in which part of the URL we
 * wanted. All of these resolve to `acme-supply.myshopify.com`:
 *
 *   acme-supply
 *   acme-supply.myshopify.com
 *   https://acme-supply.myshopify.com
 *   https://acme-supply.myshopify.com/admin/products
 *   https://admin.shopify.com/store/acme-supply
 *   https://admin.shopify.com/store/acme-supply/orders/123
 *   ACME-Supply.MyShopify.com/
 *   mailto-style junk around it, and surrounding whitespace
 */
export type ParsedShop =
  | { ok: true; shopDomain: string; handle: string }
  | { ok: false; reason: string };

const SUFFIX = ".myshopify.com";

export function parseShopInput(raw: string): ParsedShop {
  const input = raw.trim();

  if (!input) {
    return { ok: false, reason: "Enter your store's myshopify.com address." };
  }

  const candidate = extractCandidate(input);

  if (!candidate) {
    return {
      ok: false,
      reason:
        "That does not look like a Shopify store address. Paste the myshopify.com link or just the store handle.",
    };
  }

  const shopDomain = normalizeShopDomain(
    candidate.endsWith(SUFFIX) ? candidate : `${candidate}${SUFFIX}`,
  );

  if (!isValidShopDomain(shopDomain)) {
    return {
      ok: false,
      reason: `"${shopDomain}" is not a valid myshopify.com address.`,
    };
  }

  return {
    ok: true,
    shopDomain,
    handle: shopDomain.slice(0, -SUFFIX.length),
  };
}

/** Pulls the store handle or myshopify host out of the pasted text. */
function extractCandidate(input: string): string | null {
  const lower = input.toLowerCase();

  // A new-style admin link: admin.shopify.com/store/<handle>/…
  const adminMatch = lower.match(
    /admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/,
  );
  if (adminMatch) return adminMatch[1];

  // Any myshopify host appearing anywhere in the text.
  const hostMatch = lower.match(
    /([a-z0-9][a-z0-9-]*)\.myshopify\.com/,
  );
  if (hostMatch) return hostMatch[0];

  // Otherwise treat it as a bare handle, but only if it really is one: reject
  // anything carrying a scheme, a path, or another domain, so a typo becomes an
  // error rather than a silently wrong store.
  const stripped = lower
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\/+$/, "");

  if (/^[a-z0-9][a-z0-9-]*$/.test(stripped)) return stripped;

  return null;
}

/** The storefront URL, for an "open store" link. */
export function storefrontUrl(shopDomain: string): string {
  return `https://${shopDomain}`;
}

/** The Shopify admin URL for a store, using the handle-based admin host. */
export function shopifyAdminUrl(shopDomain: string): string {
  const handle = shopDomain.endsWith(SUFFIX)
    ? shopDomain.slice(0, -SUFFIX.length)
    : shopDomain;
  return `https://admin.shopify.com/store/${handle}`;
}
