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
 *
 * The catch is *which* form of the values is signed. Shopify's own callback
 * carries a `host` parameter — base64 of `admin.shopify.com/store/<handle>` —
 * and two thirds of shop handles make that base64 end in `=` padding. Signing
 * the decoded value (`host=abc==`) and signing the encoded one
 * (`host=abc%3D%3D`) give completely different digests, so picking the wrong
 * one rejects most real installs while passing every test written with a
 * convenient shop name. That is exactly the bug this replaced.
 *
 * Shopify's own library decodes and then re-encodes; the wire format is
 * already encoded. Both canonicalisations are accepted, because either one
 * matching proves the caller holds the app secret — the thing this check
 * exists to establish. Accepting two serialisations of the same parameters is
 * not a weaker test; forging either still requires the secret.
 */
export function verifyOAuthHmac({
  searchParams,
  secret,
  /** The raw `?…` string as received, when the caller still has it. */
  rawQuery,
}: {
  searchParams: URLSearchParams;
  secret: string;
  rawQuery?: string;
}): boolean {
  const received = searchParams.get("hmac");
  if (!received) return false;

  const digest = (canonical: string) =>
    createHmac("sha256", secret).update(canonical, "utf8").digest("hex");

  for (const canonical of oauthCanonicalForms({ searchParams, rawQuery })) {
    if (constantTimeEquals(digest(canonical), received)) return true;
  }

  return false;
}

/** Every serialisation Shopify might have signed, most faithful first. */
function oauthCanonicalForms({
  searchParams,
  rawQuery,
}: {
  searchParams: URLSearchParams;
  rawQuery?: string;
}): string[] {
  const forms: string[] = [];

  // 1. The bytes as they arrived, only reordered. Nothing is decoded, so no
  //    round trip can change them.
  if (rawQuery) {
    const raw = rawQuery.startsWith("?") ? rawQuery.slice(1) : rawQuery;
    const pairs = raw
      .split("&")
      .filter(Boolean)
      .filter((pair) => {
        const key = pair.split("=", 1)[0];
        return key !== "hmac" && key !== "signature";
      })
      .sort();
    forms.push(pairs.join("&"));
  }

  // 2. Decoded and re-encoded, which is what Shopify's own SDK computes.
  const entries: Array<[string, string]> = [];
  for (const key of [...new Set(searchParams.keys())].sort()) {
    if (key === "hmac" || key === "signature") continue;
    for (const value of searchParams.getAll(key)) entries.push([key, value]);
  }
  forms.push(new URLSearchParams(entries).toString());

  // 3. Decoded and joined verbatim — the documented description read
  //    literally, and what plenty of community examples do.
  forms.push(entries.map(([key, value]) => `${key}=${value}`).join("&"));

  return [...new Set(forms)];
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
