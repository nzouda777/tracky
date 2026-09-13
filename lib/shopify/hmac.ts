import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The three distinct Shopify signature schemes. They look similar and are
 * easy to confuse, so each one lives in its own function with the exact
 * canonicalisation Shopify documents.
 */

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Webhook authenticity: base64 HMAC-SHA256 over the **raw** request body,
 * compared against the `X-Shopify-Hmac-Sha256` header.
 *
 * The body must be the exact bytes received — never a re-serialised object.
 */
export function verifyWebhookHmac({
  rawBody,
  headerHmac,
  secret,
}: {
  rawBody: string;
  headerHmac: string | null;
  secret: string;
}): boolean {
  if (!headerHmac) return false;
  const digest = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return constantTimeEquals(digest, headerHmac);
}

/**
 * OAuth callback authenticity: hex HMAC-SHA256 over the query string with
 * `hmac` and `signature` removed, keys sorted, joined as `k=v` with `&`.
 */
export function verifyOAuthHmac({
  searchParams,
  secret,
}: {
  searchParams: URLSearchParams;
  secret: string;
}): boolean {
  const received = searchParams.get("hmac");
  if (!received) return false;

  const pairs: string[] = [];
  const keys = [...new Set([...searchParams.keys()])].sort();
  for (const key of keys) {
    if (key === "hmac" || key === "signature") continue;
    for (const value of searchParams.getAll(key)) {
      pairs.push(`${key}=${value}`);
    }
  }

  const digest = createHmac("sha256", secret)
    .update(pairs.join("&"), "utf8")
    .digest("hex");
  return constantTimeEquals(digest, received);
}

/**
 * App Proxy authenticity: hex HMAC-SHA256 over the query string with
 * `signature` removed, keys sorted, joined as `k=v` with **no separator**.
 * Repeated parameters are comma-joined.
 *
 * This is what proves a request for the public tracking page really came
 * through the merchant's storefront and not from an attacker hitting our
 * origin directly.
 */
export function verifyAppProxySignature({
  searchParams,
  secret,
}: {
  searchParams: URLSearchParams;
  secret: string;
}): boolean {
  const received = searchParams.get("signature");
  if (!received) return false;

  const keys = [...new Set([...searchParams.keys()])]
    .filter((key) => key !== "signature")
    .sort();

  const canonical = keys
    .map((key) => `${key}=${searchParams.getAll(key).join(",")}`)
    .join("");

  const digest = createHmac("sha256", secret)
    .update(canonical, "utf8")
    .digest("hex");
  return constantTimeEquals(digest, received);
}

/**
 * Shopify only issues tokens for `*.myshopify.com` hosts. Validating the shape
 * before using the value in a URL closes off SSRF through the `shop` param.
 */
export function isValidShopDomain(shop: string | null | undefined): boolean {
  if (!shop) return false;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

export function normalizeShopDomain(shop: string): string {
  return shop.trim().toLowerCase();
}
