import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db, stores } from "@/lib/db";
import { env } from "@/lib/env";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/hmac";
import { applyCustomerAddressChange } from "@/lib/tracking/address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Address change posted from the hosted tracking page.
 *
 * There is no App Proxy signature on this surface, so the order's own opaque
 * tracking token is the credential — the same model Shopify uses for its order
 * status page. The token is 18 random bytes and is only ever sent to the
 * customer who placed the order.
 *
 * The change itself goes through `applyCustomerAddressChange`, identical to the
 * proxy route: a cancelled order or one past the address-locking stage is
 * refused here exactly as it is there.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shop: string }> },
) {
  const { shop } = await params;
  const shopDomain = normalizeShopDomain(decodeURIComponent(shop));

  if (!isValidShopDomain(shopDomain)) {
    return NextResponse.json({ error: "Unknown store." }, { status: 404 });
  }

  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.shopDomain, shopDomain))
    .limit(1);

  if (!store || store.status !== "active") {
    return NextResponse.json({ error: "Unknown store." }, { status: 404 });
  }

  const form = await request.formData();
  const result = await applyCustomerAddressChange({
    store,
    token: String(form.get("token") ?? "").trim(),
    form,
  });

  if (result.status === "not-found") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  // Back to the hosted page, carrying the token so the order stays open.
  const url = new URL(`${env.appUrl}/track/${shopDomain}`);
  url.searchParams.set("token", result.trackingToken);
  url.searchParams.set("address", result.status);
  return NextResponse.redirect(url, 303);
}
