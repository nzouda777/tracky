import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Never redirect to add or remove a trailing slash.
   *
   * Next's default is to answer `/proxy/track-order/` with a 308 to
   * `/proxy/track-order`, carrying a *relative* `Location`. Inside a Shopify
   * App Proxy that is fatal: Shopify hands the redirect back to the customer's
   * browser, which resolves it against the merchant's own domain —
   * `https://shop.example/proxy/track-order` — where nothing exists. The
   * customer gets the storefront's 404 instead of their order, and by then
   * every clue that the redirect came from us is gone.
   *
   * Whether the slash arrives is decided by how the App Proxy URL was typed
   * into the Shopify dashboard: once per app, invisibly, with one such field
   * for every app the platform holds. A stray character there should not be
   * the difference between a working tracking page and a 404.
   *
   * The flag only suppresses the redirect — both spellings still resolve to
   * the same route, so nothing 404s that did not before. It is set globally
   * rather than for the proxy alone because per-path handling would mean
   * running the proxy middleware over every public route, which this app
   * deliberately avoids (see proxy.ts).
   */
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
