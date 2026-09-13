import { NextResponse, type NextRequest } from "next/server";

import { authenticateProxyRequest } from "@/lib/shopify/app-proxy";
import { applyCustomerAddressChange } from "@/lib/tracking/address";
import { buildTrackingLink } from "@/lib/tracking/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Address change posted from the App Proxy tracking page.
 *
 * This route's job is authenticating the *request* — the Shopify App Proxy
 * signature proves it came through the merchant's storefront. Authorising the
 * order and performing the change is `applyCustomerAddressChange`, shared with
 * the hosted tracking page so the two surfaces cannot drift apart.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateProxyRequest(request.nextUrl.searchParams);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const form = await request.formData();
  const result = await applyCustomerAddressChange({
    store: auth.store,
    token: String(form.get("token") ?? "").trim(),
    form,
  });

  if (result.status === "not-found") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const url = new URL(
    buildTrackingLink(auth.store, { trackingToken: result.trackingToken }),
  );
  url.searchParams.set("address", result.status);
  // 303 so the browser follows with GET after the POST.
  return NextResponse.redirect(url, 303);
}
