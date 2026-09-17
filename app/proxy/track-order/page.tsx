import type { Metadata } from "next";

import { TrackingPage } from "@/components/tracking/tracking-page";
import { resolveBranding } from "@/components/tracking/branding";
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

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The public tracking page, served through the Shopify App Proxy at
 * `https://<merchant domain>/apps/track-order`.
 *
 * The customer never leaves the merchant's domain, and every request is
 * signature-verified before a single order field is read.
 */
export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = toURLSearchParams(params);

  const auth = await authenticateProxyRequest(query);
  if (!auth.ok) {
    return <ProxyError reason={auth.reason} />;
  }

  const { store } = auth;
  const tdb = new TenantDb(store.id);

  const addressStatus = single(params.address);

  // One resolver shared with the hosted page, and one policy — see
  // CUSTOMER_LOOKUP_MODE for what each setting costs.
  const lookup = resolveLookupParams({
    token: single(params.token),
    order: single(params.order),
    email: single(params.email),
    q: single(params.q),
    confirm: single(params.confirm),
    verify: single(params.verify),
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

  const branding = resolveBranding(brandingRow);
  const view =
    order && (await buildPublicOrderView({ tdb, order, branding: brandingRow }));

  return (
    <TrackingPage
      branding={branding}
      store={store}
      view={view || null}
      proxyPath={trackingPath()}
      lookupStep={lookup.formStep}
      lookupMode={
        single(params.verify)?.trim() ? "two-factor" : CUSTOMER_LOOKUP_MODE
      }
      access={order ? lookup.access : "none"}
      lookupError={
        lookup.inputError ??
        (lookup.attempted && !order
          ? lookup.access === "email"
            ? "We could not find an order for that email address. Check it is the one you used at checkout."
            : "We could not find an order with those details. Check the order number and the email address used at checkout."
          : null)
      }
      addressMessage={
        addressStatus === "updated"
          ? "Your delivery address has been updated."
          : null
      }
      addressError={
        addressStatus === "locked"
          ? "Your order has already left for delivery, so the address can no longer be changed."
          : addressStatus === "failed"
            ? "We could not save that address. Please check the details and try again."
            : null
      }
    />
  );
}

/**
 * Shown when the request did not come through the App Proxy. Kept deliberately
 * vague: it should not tell a prober whether a shop exists.
 */
function ProxyError({ reason }: { reason: string }) {
  const message =
    reason === "uninstalled"
      ? "Order tracking is not available for this store right now."
      : "This page can only be opened from the store it belongs to.";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-lg font-semibold text-ink-900">
        Order tracking unavailable
      </h1>
      <p className="mt-2 text-sm text-ink-500">{message}</p>
    </main>
  );
}

function toURLSearchParams(params: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) query.append(key, entry);
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  return query;
}

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
