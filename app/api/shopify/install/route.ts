import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { resolveShop } from "@/lib/shopify/credentials";
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
 *
 * With several Shopify apps in play, the shop domain is also how we work out
 * *which* app to start the flow for: the store row created when its
 * credentials were entered carries them. A shop nobody has registered falls
 * back to the environment credentials, and fails with an explicit message when
 * there are none — rather than silently sending the merchant to the wrong app.
 */
export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get("shop");
  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;

  // Validating the shape before it reaches a URL closes off SSRF via `shop`.
  if (!shopDomain || !isValidShopDomain(shopDomain)) {
    return NextResponse.json(
      { error: "A valid myshopify.com store domain is required." },
      { status: 400 },
    );
  }

  const { store, credentials } = await resolveShop(shopDomain);

  if (!credentials) {
    return installError(
      `No Shopify app is configured for ${shopDomain}. Add the store in Tracky first, with its app's API key and secret key, then start the installation again.`,
    );
  }

  if (store?.authMode === "custom") {
    return installError(
      `${shopDomain} is connected through a custom app created in its own Shopify admin, which has no installation flow. Update its Admin API access token on the store instead.`,
    );
  }

  const state = generateOAuthState();
  const response = NextResponse.redirect(
    buildAuthorizeUrl({ shopDomain, state, credentials }),
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

function installError(message: string) {
  const url = new URL(`${env.appUrl}/install-failed`);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}
