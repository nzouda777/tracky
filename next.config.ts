import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * The origin the browser should load `/_next/...` assets from.
 *
 * Everything the Shopify App Proxy serves is rendered by us but *displayed* on
 * the merchant's domain, and the browser resolves every root-relative URL in
 * our HTML against that domain. `/_next/static/…/app.css` therefore becomes
 * `https://shop.example/_next/static/…/app.css`, which Shopify answers with a
 * 404 — so the tracking page arrives with no stylesheet and no JavaScript, as
 * raw unstyled markup. Nothing in the page is wrong; the browser simply asked
 * the wrong host for it.
 *
 * Naming the origin explicitly makes those URLs absolute and points them back
 * here. Vercel already serves `/_next/static` with `Access-Control-Allow-Origin: *`,
 * so the cross-origin stylesheet, scripts and webfonts all load.
 */
function assetOrigin(isDev: boolean): string | undefined {
  // In development the app is its own origin and the proxy is not in play.
  if (isDev) return undefined;

  const candidate =
    process.env.NEXT_PUBLIC_ASSET_PREFIX ??
    // A preview deployment must serve its own assets: the chunk names in its
    // HTML do not exist on the production domain, so borrowing that origin
    // would break every preview.
    (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined) ??
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);

  if (!candidate) return undefined;

  // A wrong prefix breaks every page, so it has to be a real remote origin.
  // Anything else — a localhost build, a stray path, a typo — falls back to
  // the relative URLs, which are correct everywhere except behind the proxy.
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return undefined;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export default function config(phase: string): NextConfig {
  return {
    assetPrefix: assetOrigin(phase === PHASE_DEVELOPMENT_SERVER),

    /**
     * Never redirect to add or remove a trailing slash.
     *
     * Next's default is to answer `/proxy/track-order/` with a 308 to
     * `/proxy/track-order`, carrying a *relative* `Location`. Inside a Shopify
     * App Proxy that is fatal, for the same reason as the assets above:
     * Shopify hands the redirect back to the customer's browser, which
     * resolves it against the merchant's own domain — where nothing exists.
     * The customer gets the storefront's 404 instead of their order.
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
}
