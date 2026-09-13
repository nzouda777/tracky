import { NextResponse, type NextRequest } from "next/server";

import { OAUTH_STATE_COOKIE, buildAuthorizeUrl, generateOAuthState } from "@/lib/shopify/oauth";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/hmac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Installation entry point: `/api/shopify/install?shop=<shop>.myshopify.com`.
 *
 * Shopify also calls this URL itself when a merchant opens an app that is not
 * yet installed, which is why it accepts the `shop` parameter rather than a
 * form submission.
 */
export function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;

  // Validating the shape before it reaches a URL closes off SSRF via `shop`.
  if (!shopDomain || !isValidShopDomain(shopDomain)) {
    return NextResponse.json(
      { error: "A valid myshopify.com store domain is required." },
      { status: 400 },
    );
  }

  const state = generateOAuthState();
  const response = NextResponse.redirect(
    buildAuthorizeUrl({ shopDomain, state }),
  );

  // The state cookie is compared in the callback to block CSRF on install.
  response.cookies.set(OAUTH_STATE_COOKIE, `${state}:${shopDomain}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return response;
}
