import { NextResponse, type NextRequest } from "next/server";
// `react-dom/server` is refused inside the App Router; the edge build exposes
// the same renderer through a stream, which is what this reads back.
import { renderToReadableStream } from "react-dom/server.edge";

import { TrackingPage } from "@/components/tracking/tracking-page";
import { resolveBranding, resolveFontStack } from "@/components/tracking/branding";
import { TRACKING_EMBED_CSS } from "@/components/tracking/embed-styles";
import { TenantDb } from "@/lib/db/tenant";
import { authenticateProxyRequest } from "@/lib/shopify/app-proxy";
import {
  buildPublicOrderView,
  CUSTOMER_LOOKUP_MODE,
  findPublicOrder,
  getBranding,
  resolveLookupParams,
} from "@/lib/tracking/lookup";
import { trackingPath } from "@/lib/tracking/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The public tracking page, served through the Shopify App Proxy at
 * `https://<merchant domain>/apps/track-order`.
 *
 * It answers with `Content-Type: application/liquid`, which is what makes the
 * page part of the merchant's shop rather than a bare document on their
 * domain: Shopify runs the response through Liquid and drops it into the
 * theme's own layout, so the customer gets the store's header, navigation,
 * footer and fonts around our content, and never leaves the site.
 *
 * That is also why this is a route handler rather than a page — a page cannot
 * choose its own content type — and why the markup is rendered to static HTML.
 * The tracking page has no client components and no state: every control on it
 * is a plain HTML form, so there is nothing to hydrate and nothing is lost.
 *
 * Every request is signature-verified before a single order field is read.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;

  const auth = await authenticateProxyRequest(query);
  if (!auth.ok) {
    return liquid(proxyErrorMarkup(auth.reason), auth.reason === "uninstalled" ? 200 : 403);
  }

  const { store } = auth;
  const tdb = new TenantDb(store.id);

  const addressStatus = query.get("address");

  // One resolver shared with the hosted page, and one policy — see
  // CUSTOMER_LOOKUP_MODE for what each setting costs.
  const lookup = resolveLookupParams({
    token: query.get("token"),
    order: query.get("order"),
    email: query.get("email"),
    q: query.get("q"),
    confirm: query.get("confirm"),
    verify: query.get("verify"),
    mode: CUSTOMER_LOOKUP_MODE,
  });

  // Branding and the order lookup do not depend on each other, so they go out
  // together rather than costing two sequential round trips.
  const [brandingRow, order] = await Promise.all([
    getBranding(tdb),
    lookup.attempted
      ? findPublicOrder({
          tdb,
          token: lookup.token,
          orderNumber: lookup.orderNumber,
          email: lookup.email,
          // Only ever true for the `email` access level, so a surface that has
          // not opted in cannot reach the email-only query by accident.
          allowEmailOnly: lookup.access === "email",
        })
      : Promise.resolve(null),
  ]);

  // The theme is not our document, so a font stack naming one of next/font's
  // custom properties would resolve to nothing there and hand the page to the
  // theme's own typeface.
  const resolved = resolveBranding(brandingRow);
  const branding = {
    ...resolved,
    fontFamily: resolveFontStack(resolved.fontFamily),
  };
  const view =
    order && (await buildPublicOrderView({ tdb, order, branding: brandingRow }));

  const markup = await renderToString(
    TrackingPage({
      branding,
      store,
      view: view || null,
      proxyPath: trackingPath(),
      lookupStep: lookup.formStep,
      lookupMode: query.get("verify")?.trim()
        ? "two-factor"
        : CUSTOMER_LOOKUP_MODE,
      access: order ? lookup.access : "none",
      lookupError:
        lookup.inputError ??
        (lookup.attempted && !order
          ? lookup.access === "email"
            ? "We could not find an order for that email address. Check it is the one you used at checkout."
            : "We could not find an order with those details. Check the order number and the email address used at checkout."
          : null),
      addressMessage:
        addressStatus === "updated"
          ? "Your delivery address has been updated."
          : null,
      addressError:
        addressStatus === "locked"
          ? "Your order has already left for delivery, so the address can no longer be changed."
          : addressStatus === "failed"
            ? "We could not save that address. Please check the details and try again."
            : null,
    }),
  );

  return liquid(`<style>${TRACKING_EMBED_CSS}</style>${markup}`);
}

/** The element as one HTML string. */
async function renderToString(element: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

/**
 * Shown when the request did not come through the App Proxy. Kept deliberately
 * vague: it should not tell a prober whether a shop exists.
 */
function proxyErrorMarkup(reason: string): string {
  const message =
    reason === "uninstalled"
      ? "Order tracking is not available for this store right now."
      : "This page can only be opened from the store it belongs to.";

  return (
    `<div style="max-width:32rem;margin:0 auto;padding:3rem 1.25rem;text-align:center">` +
    `<h1 style="font-size:1.0625rem;font-weight:600;margin:0">Order tracking unavailable</h1>` +
    `<p style="margin:.5rem 0 0;opacity:.7">${message}</p>` +
    `</div>`
  );
}

/**
 * Hands Shopify a Liquid document.
 *
 * The body is run through Liquid before it reaches the browser, so `{{ … }}`
 * and `{% … %}` in it are *executed by the merchant's store*. Nothing on this
 * page is meant to be — and some of it is written by strangers: a customer
 * controls their own name and, until the order ships, their delivery address.
 * A name of `{{ shop.email }}` would otherwise be rendered by Shopify with the
 * merchant's own data.
 *
 * So every brace outside the stylesheet is emitted as an entity. Liquid parses
 * the raw bytes and never sees a tag; the browser decodes the entity and shows
 * the character. The stylesheet is exempt because CSS is not HTML — entities
 * inside `<style>` are not decoded, and its braces are ours, not a visitor's.
 */
function liquid(body: string, status = 200): NextResponse {
  return new NextResponse(neutraliseLiquid(body), {
    status,
    headers: {
      "Content-Type": "application/liquid; charset=utf-8",
      // The page carries one customer's order. It is theirs alone, and it is
      // rebuilt on every request.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** Entity-encodes Liquid's delimiters everywhere except inside `<style>`. */
export function neutraliseLiquid(html: string): string {
  return html
    .split(/(<style[\s\S]*?<\/style>)/i)
    .map((chunk, index) =>
      // Odd indices are the captured <style> blocks, left verbatim.
      index % 2 === 1
        ? chunk
        : chunk.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;"),
    )
    .join("");
}
