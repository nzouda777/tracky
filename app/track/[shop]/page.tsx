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
 * **It deliberately shares the lookup rules rather than relaxing them.** There
 * is no App Proxy signature here, so the only way in is the same as before:
 * the per-order token from an email link, or the order number *and* the email
 * address used at checkout. Both are required together — an order number alone
 * never resolves, which is what keeps this from becoming an order-enumeration
 * endpoint. Everything rendered comes from `buildPublicOrderView`, the same
 * function the proxy page uses, so the two can never drift apart.
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

  // Same resolver as the proxy page, so both accept the same three ways in.
  const lookup = resolveLookupParams({
    token: query.token,
    order: query.order,
    email: query.email,
    q: query.q,
    confirm: query.confirm,
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
      lookupError={
        lookup.attempted && !order
          ? "We could not find an order with those details. Check the order number and the email address used at checkout."
          : null
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
