import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { resolveBranding } from "@/components/tracking/branding";
import { TrackingPage } from "@/components/tracking/tracking-page";
import { db, stores } from "@/lib/db";
import { TenantDb } from "@/lib/db/tenant";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/hmac";
import {
  buildPublicOrderView,
  CUSTOMER_LOOKUP_MODE,
  findPublicOrder,
  getBranding,
  resolveLookupParams,
} from "@/lib/tracking/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track your order",
  // Never indexed: these pages are reached from an email or a storefront link,
  // and a search engine crawling order lookups serves nobody.
  robots: { index: false, follow: false },
};

/**
 * Hosted tracking page: `/track/<shop>.myshopify.com`.
 *
 * The brief's primary route is the App Proxy page at `/proxy/track-order`,
 * which Shopify signs and serves on the merchant's own domain — that stays the
 * canonical customer experience and is unchanged. This is the same page served
 * from Tracky's own domain, for the cases the proxy cannot cover:
 *
 *   - the store has not finished configuring its App Proxy;
 *   - the merchant wants to link tracking from somewhere other than their
 *     storefront (a receipt, a support reply, an SMS);
 *   - you need to see the real customer page while setting a store up.
 *
 * **This surface asks for the order number and nothing else.** A shopper who
 * arrives here has no signed storefront session and often no email to hand, so
 * a second question is where they give up. The order number opens the order.
 *
 * Order numbers are sequential, so that is a lookup anyone can guess their way
 * through, and the page is built on that assumption rather than against it:
 * an order opened this way carries `access: "order-number"` and renders the
 * delivery progress only. The full name, the street address and the
 * address-change form — which embeds the order's token, and so would grant
 * write access — stay behind `?verify=1`, which asks for the email on the
 * order. The emailed token link and the order+email pair both still land on
 * the full view directly.
 *
 * Everything rendered comes from `buildPublicOrderView`, the same function the
 * proxy page uses, so the two surfaces cannot drift apart.
 */
export default async function HostedTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ shop: string }>;
  searchParams: Promise<{
    token?: string;
    order?: string;
    email?: string;
    q?: string;
    confirm?: string;
    verify?: string;
    address?: string;
  }>;
}) {
  const { shop } = await params;
  const query = await searchParams;

  const shopDomain = normalizeShopDomain(decodeURIComponent(shop));
  if (!isValidShopDomain(shopDomain)) notFound();

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.shopDomain, shopDomain))
    .limit(1);

  // A store that is not connected gets the same answer as one that never
  // existed, so this route cannot be used to enumerate Tracky's customers.
  if (!store || store.status !== "active") notFound();

  const tdb = new TenantDb(store.id);

  // Same resolver and the same policy as the proxy page: a customer should
  // not have to present more here than on the merchant's own domain. `?verify=1`
  // still turns this into the two-step form.
  const lookup = resolveLookupParams({
    token: query.token,
    order: query.order,
    email: query.email,
    q: query.q,
    confirm: query.confirm,
    verify: query.verify,
    mode: CUSTOMER_LOOKUP_MODE,
  });

  // Independent reads, issued together — see the proxy page for the rationale.
  const [brandingRow, order] = await Promise.all([
    getBranding(tdb),
    lookup.attempted
      ? findPublicOrder({
          tdb,
          token: lookup.token,
          orderNumber: lookup.orderNumber,
          email: lookup.email,
          // Each opt-in is tied to the access level that produced it, so a
          // surface cannot reach a relaxed query it did not ask for.
          allowOrderNumberOnly: lookup.access === "order-number",
          allowEmailOnly: lookup.access === "email",
        })
      : Promise.resolve(null),
  ]);

  const branding = resolveBranding(brandingRow);
  const view =
    order && (await buildPublicOrderView({ tdb, order, branding: brandingRow }));

  return (
    <TrackingPage
      branding={branding}
      store={store}
      view={view || null}
      // Posts and searches stay on this hosted path rather than the proxy one.
      proxyPath={`/track/${shopDomain}`}
      lookupStep={lookup.formStep}
      lookupMode={query.verify?.trim() ? "two-factor" : CUSTOMER_LOOKUP_MODE}
      access={order ? lookup.access : "none"}
      lookupError={
        lookup.inputError ??
        (lookup.attempted && !order
          ? lookup.access === "order-number"
            ? "We could not find that order number. Check it against your order confirmation email."
            : "We could not find an order with those details. Check the order number and the email address used at checkout."
          : null)
      }
      addressMessage={
        query.address === "updated"
          ? "Your delivery address has been updated."
          : null
      }
      addressError={
        query.address === "locked"
          ? "Your order has already left for delivery, so the address can no longer be changed."
          : query.address === "failed"
            ? "We could not save that address. Please check the details and try again."
            : null
      }
    />
  );
}
